#!/usr/bin/env python3
import json
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup

DATA = Path('data/furniture.json')

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (compatible; NoktenaCatalogSync/4.1; +https://noktena.ru/)',
    'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.6',
})

IMAGE_EXT_RE = re.compile(r'\.(?:jpe?g|png|webp)(?:$|\?)', re.I)


def clean(value):
    return re.sub(r'\s+', ' ', str(value or '').replace('\xa0', ' ')).strip()


def canonical(url):
    p = urlparse(str(url or ''))
    return urlunparse((p.scheme, p.netloc, p.path, '', '', ''))


def filename_key(url):
    path = urlparse(str(url or '')).path
    return path.rsplit('/', 1)[-1].lower()


def is_product_image(url, product_id):
    url = canonical(url)
    if not url or not IMAGE_EXT_RE.search(url):
        return False
    path = urlparse(url).path
    if '/files/eshop/' not in path:
        return False
    name = path.rsplit('/', 1)[-1]
    return bool(re.match(rf'^{re.escape(str(product_id))}(?:[_\-.]|$)', name, re.I))


def source_base_gallery(product):
    source_url = clean(product.get('sourceUrl'))
    product_id = clean(product.get('sourceId'))
    if not source_url or not product_id:
        return []

    r = session.get(source_url, timeout=40)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or r.encoding
    soup = BeautifulSoup(r.text, 'html.parser')

    out = []
    seen_urls = set()
    seen_names = set()

    def add(raw):
        if not raw:
            return
        url = canonical(urljoin(r.url, raw))
        if not is_product_image(url, product_id):
            return
        name = filename_key(url)
        if not name or name in seen_names or url in seen_urls:
            return
        seen_names.add(name)
        seen_urls.add(url)
        out.append(url)

    # Keep only the true/base product gallery. Berhouse uses anchors like
    # color12345 for size/color combinations; those are deliberately excluded
    # here because one representative image per color is added from colorImages.
    for anchor in soup.select('.thumbs a[href], .gallery a[href]'):
        ident = clean(anchor.get('id'))
        if ident.startswith('color') and ident != 'color0':
            continue
        add(anchor.get('href'))

    # Fallback to the primary OpenGraph image when the page has no base anchor.
    if not out:
        og = soup.find('meta', attrs={'property': 'og:image'})
        if og:
            add(og.get('content'))

    return out


def unique_color_photos(product):
    out = []
    seen_urls = set()
    seen_names = set()
    for url in (product.get('colorImages') or {}).values():
        url = canonical(url)
        if not url:
            continue
        name = filename_key(url)
        if url in seen_urls or (name and name in seen_names):
            continue
        seen_urls.add(url)
        if name:
            seen_names.add(name)
        out.append(url)
    return out


def merge_clean(base, colors):
    out = []
    seen_urls = set()
    seen_names = set()
    for url in list(base) + list(colors):
        url = canonical(url)
        if not url:
            continue
        name = filename_key(url)
        if url in seen_urls or (name and name in seen_names):
            continue
        seen_urls.add(url)
        if name:
            seen_names.add(name)
        out.append(url)
    return out


def main():
    data = json.loads(DATA.read_text(encoding='utf-8'))
    products = list(data.get('beds') or []) + list(data.get('sofas') or [])
    changed = 0
    removed = 0
    failures = []

    for idx, product in enumerate(products, 1):
        before = list(product.get('images') or [])
        try:
            base = source_base_gallery(product)
        except Exception as exc:
            failures.append((product.get('sourceId'), str(exc)))
            base = []

        colors = unique_color_photos(product)
        cleaned = merge_clean(base, colors)

        # If source lookup failed, still collapse the existing gallery by file
        # identity rather than leaving a duplicated list in place.
        if not cleaned:
            cleaned = merge_clean([], before)

        if cleaned != before:
            product['images'] = cleaned
            changed += 1
            removed += max(0, len(before) - len(cleaned))

        print(
            f'[{idx}/{len(products)}] {product.get("title")}: '
            f'before={len(before)} base={len(base)} colors={len(colors)} after={len(cleaned)}'
        )

    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Products={len(products)} changed={changed} duplicate_or_variant_images_removed={removed} failures={len(failures)}')
    if failures:
        print('Source lookup failures:', failures[:20])


if __name__ == '__main__':
    main()
