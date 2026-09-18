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
    'User-Agent': 'Mozilla/5.0 (compatible; NoktenaCatalogSync/4.0; +https://noktena.ru/)',
    'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.6',
})


def clean(value):
    return re.sub(r'\s+', ' ', str(value or '').replace('\xa0', ' ')).strip()


def canonical(url):
    p = urlparse(url)
    return urlunparse((p.scheme, p.netloc, p.path, '', '', ''))


def is_product_image(url, product_id):
    if not url or not IMAGE_EXT_RE.search(url):
        return False
    path = urlparse(url).path
    if '/files/eshop/' not in path:
        return False
    name = path.rsplit('/', 1)[-1]
    # Berhouse product/variant images use the product id as the filename prefix.
    return bool(re.match(rf'^{re.escape(str(product_id))}(?:[_\-.]|$)', name, re.I))


def collect_product_images(product):
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
        # srcset/data-srcset may contain multiple candidates.
        candidates = [part.strip().split(' ')[0] for part in raw.split(',') if part.strip()]
        for candidate in candidates:
            url = canonical(urljoin(r.url, candidate))
            if not is_product_image(url, product_id):
                continue
            if url in seen:
                continue
            seen.add(url)
            found.append(url)

    # 1. Product gallery links: usually the highest-quality originals.
    for a in soup.select('.thumbs a[href], .gallery a[href], a[id^="color"][href]'):
        add(a.get('href'))

    # 2. Every image explicitly belonging to this product, including variant blocks.
    for img in soup.find_all('img'):
        for attr in ('src', 'data-src', 'data-original', 'data-lazy', 'data-image', 'data-zoom', 'data-large', 'srcset', 'data-srcset'):
            add(img.get(attr))
        parent = img.parent
        if parent and getattr(parent, 'name', None) == 'a':
            add(parent.get('href'))

    # 3. Product image links outside the gallery markup.
    for a in soup.find_all('a', href=True):
        add(a.get('href'))

    # Prefer /big/ copies first, preserving source order inside each group.
    big = [u for u in found if '/files/eshop/big/' in u.lower()]
    other = [u for u in found if u not in set(big)]
    return big + other


def main():
    data = json.loads(DATA.read_text(encoding='utf-8'))
    products = list(data.get('beds') or []) + list(data.get('sofas') or [])
    changed = 0
    total_added = 0
    failures = []

    for idx, product in enumerate(products, 1):
        try:
            source_images = collect_product_images(product)
        except Exception as exc:
            failures.append((product.get('id'), str(exc)))
            print(f'WARN {idx}/{len(products)} {product.get("title")}: {exc}')
            continue

        existing = [u for u in (product.get('images') or []) if u]
        combined = []
        seen = set()
        for url in source_images + existing:
            key = canonical(url)
            if not key or key in seen:
                continue
            seen.add(key)
            combined.append(url)

        before = len(existing)
        after = len(combined)
        added = max(0, after - before)
        if combined != existing:
            product['images'] = combined
            changed += 1
            total_added += added
        print(f'[{idx}/{len(products)}] {product.get("title")}: source={len(source_images)}, before={before}, after={after}, added={added}')
        time.sleep(0.02)

    if failures:
        print(f'WARN: {len(failures)} products could not be refreshed: {failures[:10]}')

    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Products={len(products)}; changed={changed}; total new images={total_added}; failures={len(failures)}')


if __name__ == '__main__':
    main()
