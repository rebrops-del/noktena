#!/usr/bin/env python3
import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup

DATA = Path('data/furniture.json')
MAX_WORKERS = 12

# Berhouse currently serves this secondary angle only as a 350x233 source,
# even when requested through /big/. It is excluded rather than shown blurry.
EXCLUDED_LOW_RES_ANGLES = {'24297a2.jpg'}


def clean(value):
    return re.sub(r'\s+', ' ', str(value or '').replace('\xa0', ' ')).strip()


def norm(value):
    return re.sub(r'[^a-zа-я0-9]+', '', clean(value).lower().replace('ё', 'е'))


def canonical(url):
    p = urlparse(str(url or ''))
    return urlunparse((p.scheme, p.netloc, p.path, '', '', ''))


def high_res(url):
    """Promote Berhouse thumbnail URLs to the original /big/ image.

    Product pages expose secondary gallery angles through /small/ (350x233),
    while the same filenames are normally available in /big/ (typically
    900x600). Keep already-high-resolution and non-Berhouse URLs unchanged.
    """
    url = canonical(url)
    if not url:
        return ''
    return re.sub(r'/files/eshop/small/', '/files/eshop/big/', url, flags=re.I)


def filename(url):
    return urlparse(str(url or '')).path.rsplit('/', 1)[-1]


def is_real_angle(url, product_id):
    """Berhouse real gallery angles: ID.jpg, IDa1.jpg, IDa2.jpg, ...

    Files such as ID_123456.jpg/png are size/color variants. They remain in
    colorImages and are shown when the customer selects a color, but they are
    not repeated as thumbnails in the main product gallery.
    """
    name = filename(url)
    if name.lower() in EXCLUDED_LOW_RES_ANGLES:
        return False
    return bool(re.fullmatch(
        rf'{re.escape(str(product_id))}(?:[a-z]+\d+)?\.(?:jpe?g|png|webp)',
        name,
        flags=re.I,
    ))


def source_real_angles(product):
    source_url = clean(product.get('sourceUrl'))
    product_id = clean(product.get('sourceId'))
    if not source_url or not product_id:
        return []

    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; NoktenaCatalogSync/4.7; +https://noktena.ru/)',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.6',
    }
    r = requests.get(source_url, timeout=35, headers=headers)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or r.encoding
    soup = BeautifulSoup(r.text, 'html.parser')

    out = []
    seen = set()
    for anchor in soup.select('.thumbs a[href]'):
        url = high_res(urljoin(r.url, anchor.get('href')))
        if not is_real_angle(url, product_id) or url in seen:
            continue
        seen.add(url)
        out.append(url)

    if not out:
        for selector in ('.photo a[href]', '.itemPhoto a[href]'):
            anchor = soup.select_one(selector)
            if not anchor:
                continue
            url = high_res(urljoin(r.url, anchor.get('href')))
            if is_real_angle(url, product_id):
                out.append(url)
                break

    if not out:
        og = soup.find('meta', attrs={'property': 'og:image'})
        if og:
            url = high_res(urljoin(r.url, og.get('content')))
            if is_real_angle(url, product_id):
                out.append(url)

    return out


def merge_unique(values):
    out = []
    seen = set()
    for raw in values or []:
        url = high_res(raw)
        if not url or url in seen:
            continue
        seen.add(url)
        out.append(url)
    return out


def fallback_real_angles(product):
    pid = clean(product.get('sourceId'))
    return merge_unique([
        high_res(url) for url in (product.get('images') or [])
        if pid and is_real_angle(url, pid)
    ])


def color_photo_count(product):
    """Count displayed colors that have an exact selectable color photo."""
    mapping = {
        norm(label): high_res(url)
        for label, url in (product.get('colorImages') or {}).items()
        if norm(label) and high_res(url)
    }
    displayed = {norm(label) for label in (product.get('colors') or []) if norm(label)}
    return len(displayed), sum(1 for key in displayed if mapping.get(key))


def main():
    data = json.loads(DATA.read_text(encoding='utf-8'))
    products = list(data.get('beds') or []) + list(data.get('sofas') or [])

    fetched = {}
    failures = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        future_map = {pool.submit(source_real_angles, p): p for p in products}
        for future in as_completed(future_map):
            product = future_map[future]
            sid = str(product.get('sourceId') or '')
            try:
                fetched[sid] = future.result()
            except Exception as exc:
                failures.append((sid, str(exc)))
                fetched[sid] = fallback_real_angles(product)

    changed = 0
    removed = 0
    added = 0
    upgraded = 0
    missing_color_photos = []

    for idx, product in enumerate(products, 1):
        before = list(product.get('images') or [])
        sid = str(product.get('sourceId') or '')
        angles = merge_unique(fetched.get(sid) or fallback_real_angles(product))
        gallery = angles

        expected_colors, mapped_colors = color_photo_count(product)
        if expected_colors and mapped_colors < expected_colors:
            missing_color_photos.append((sid, product.get('title'), expected_colors, mapped_colors))

        if not gallery and before:
            gallery = fallback_real_angles(product) or [high_res(before[0])]

        before_small = sum('/files/eshop/small/' in str(url).lower() for url in before)
        after_small = sum('/files/eshop/small/' in str(url).lower() for url in gallery)
        upgraded += max(0, before_small - after_small)

        if gallery != before:
            product['images'] = gallery
            changed += 1
            removed += max(0, len(before) - len(gallery))
            added += max(0, len(gallery) - len(before))

        print(
            f'[{idx}/{len(products)}] {product.get("title")}: '
            f'before={len(before)} real_angles={len(gallery)} '
            f'color_photos={mapped_colors}/{expected_colors} '
            f'small_before={before_small} small_after={after_small} after={len(gallery)}'
        )

    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(
        f'Products={len(products)} changed={changed} removed={removed} added={added} '
        f'upgraded_small_to_big={upgraded} source_failures={len(failures)} '
        f'missing_color_photos={len(missing_color_photos)}'
    )
    if failures:
        print('SOURCE_FAILURES', failures[:20])
    if missing_color_photos:
        print('MISSING_COLOR_PHOTOS', missing_color_photos[:30])


if __name__ == '__main__':
    main()
