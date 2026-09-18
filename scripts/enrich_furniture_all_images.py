#!/usr/bin/env python3
import json
import re
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup

DATA = Path('data/furniture.json')
IMAGE_EXT_RE = re.compile(r'\.(?:jpe?g|png|webp)(?:$|\?)', re.I)

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (compatible; NoktenaCatalogSync/4.1; +https://noktena.ru/)',
    'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.6',
})


def clean(value):
    return re.sub(r'\s+', ' ', str(value or '').replace('\xa0', ' ')).strip()


def canonical(url):
    p = urlparse(url)
    return urlunparse((p.scheme, p.netloc, p.path, '', '', ''))


def image_key(url):
    """Treat the same Berhouse file in /big/, /small/, etc. as one photo."""
    path = urlparse(canonical(url)).path
    return path.rsplit('/', 1)[-1].lower()


def is_product_image(url, product_id):
    if not url or not IMAGE_EXT_RE.search(url):
        return False
    path = urlparse(url).path
    if '/files/eshop/' not in path:
        return False
    name = path.rsplit('/', 1)[-1]
    return bool(re.match(rf'^{re.escape(str(product_id))}(?:[_\-.]|$)', name, re.I))


def collect_gallery_images(product):
    """Collect only customer-visible Berhouse gallery photos.

    Do not crawl every <img>/<a> on the page: variant/specification blocks can
    contain dozens of technical duplicates that are not part of the product
    gallery shown to a customer.
    """
    source_url = product.get('sourceUrl')
    product_id = clean(product.get('sourceId'))
    if not source_url or not product_id:
        return []

    r = session.get(source_url, timeout=40)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or r.encoding
    soup = BeautifulSoup(r.text, 'html.parser')

    found = []
    seen = set()

    def add(raw):
        raw = clean(raw)
        if not raw or raw.startswith('data:'):
            return
        candidate = raw.split(',')[0].strip().split(' ')[0]
        url = canonical(urljoin(r.url, candidate))
        if not is_product_image(url, product_id):
            return
        key = image_key(url)
        if not key or key in seen:
            return
        seen.add(key)
        found.append(url)

    # Actual product gallery / thumbnails on Berhouse.
    for a in soup.select('.thumbs a[href], .gallery a[href], .product-gallery a[href], .photos a[href]'):
        add(a.get('href'))

    # Exact color photos already verified from Berhouse variant/color mapping.
    for url in (product.get('colorImages') or {}).values():
        add(url)

    # If the page markup changed and no gallery was detected, keep one genuine
    # product photo instead of replacing the gallery with an empty list.
    if not found:
        for url in product.get('images') or []:
            url = canonical(url)
            if is_product_image(url, product_id):
                add(url)
                if found:
                    break

    return found


def main():
    data = json.loads(DATA.read_text(encoding='utf-8'))
    products = list(data.get('beds') or []) + list(data.get('sofas') or [])
    changed = 0
    removed = 0
    failures = []

    for idx, product in enumerate(products, 1):
        existing = [u for u in (product.get('images') or []) if u]
        try:
            trusted = collect_gallery_images(product)
        except Exception as exc:
            failures.append((product.get('id'), str(exc)))
            print(f'WARN {idx}/{len(products)} {product.get("title")}: {exc}')
            continue

        # Rebuild, do not merge with old data. Merging is what previously kept
        # technical duplicates in the customer gallery.
        if trusted and trusted != existing:
            product['images'] = trusted
            changed += 1
            removed += max(0, len(existing) - len(trusted))

        print(
            f'[{idx}/{len(products)}] {product.get("title")}: '
            f'before={len(existing)}, trusted={len(trusted)}, '
            f'removed={max(0, len(existing)-len(trusted))}'
        )
        time.sleep(0.02)

    if failures:
        print(f'WARN: {len(failures)} products could not be refreshed: {failures[:10]}')

    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Products={len(products)}; changed={changed}; removed technical/duplicate images={removed}; failures={len(failures)}')


if __name__ == '__main__':
    main()
