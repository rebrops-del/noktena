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


def clean(value):
    return re.sub(r'\s+', ' ', str(value or '').replace('\xa0', ' ')).strip()


def norm(value):
    return re.sub(r'[^a-zа-я0-9]+', '', clean(value).lower().replace('ё', 'е'))


def canonical(url):
    p = urlparse(str(url or ''))
    return urlunparse((p.scheme, p.netloc, p.path, '', '', ''))


def filename(url):
    return urlparse(str(url or '')).path.rsplit('/', 1)[-1]


def is_real_angle(url, product_id):
    """Berhouse real gallery: ID.jpg, IDa1.jpg, IDa2.jpg, ...

    ID_123456.jpg/png are size/color variants. Those are not extra angles and
    are handled separately as exactly one image for each displayed color.
    """
    return bool(re.fullmatch(
        rf'{re.escape(str(product_id))}(?:[a-z]+\d+)?\.(?:jpe?g|png|webp)',
        filename(url),
        flags=re.I,
    ))


def source_real_angles(product):
    source_url = clean(product.get('sourceUrl'))
    product_id = clean(product.get('sourceId'))
    if not source_url or not product_id:
        return []

    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; NoktenaCatalogSync/4.4; +https://noktena.ru/)',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.6',
    }
    r = requests.get(source_url, timeout=35, headers=headers)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or r.encoding
    soup = BeautifulSoup(r.text, 'html.parser')

    out = []
    seen = set()
    for anchor in soup.select('.thumbs a[href]'):
        url = canonical(urljoin(r.url, anchor.get('href')))
        if not is_real_angle(url, product_id) or url in seen:
            continue
        seen.add(url)
        out.append(url)

    if not out:
        for selector in ('.photo a[href]', '.itemPhoto a[href]'):
            anchor = soup.select_one(selector)
            if not anchor:
                continue
            url = canonical(urljoin(r.url, anchor.get('href')))
            if is_real_angle(url, product_id):
                out.append(url)
                break

    if not out:
        og = soup.find('meta', attrs={'property': 'og:image'})
        if og:
            url = canonical(urljoin(r.url, og.get('content')))
            if is_real_angle(url, product_id):
                out.append(url)

    return out


def one_photo_per_displayed_color(product):
    """Use exactly one color image for every color selectable on NOKTENA.

    Do not append other colorImages aliases: that was the source of repeated
    size/color pictures in the gallery.
    """
    raw_map = {
        norm(label): canonical(url)
        for label, url in (product.get('colorImages') or {}).items()
        if norm(label) and canonical(url)
    }
    out = []
    seen_urls = set()
    seen_colors = set()

    for label in product.get('colors') or []:
        key = norm(label)
        if not key or key in seen_colors:
            continue
        seen_colors.add(key)
        url = raw_map.get(key)
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        out.append(url)

    return out


def merge_unique(*groups):
    out = []
    seen = set()
    for group in groups:
        for raw in group or []:
            url = canonical(raw)
            if not url or url in seen:
                continue
            seen.add(url)
            out.append(url)
    return out


def fallback_real_angles(product):
    pid = clean(product.get('sourceId'))
    return merge_unique([
        url for url in (product.get('images') or [])
        if pid and is_real_angle(url, pid)
    ])


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
    missing_color_photos = []

    for idx, product in enumerate(products, 1):
        before = list(product.get('images') or [])
        sid = str(product.get('sourceId') or '')
        angles = fetched.get(sid) or fallback_real_angles(product)
        color_photos = one_photo_per_displayed_color(product)
        gallery = merge_unique(angles, color_photos)

        expected_colors = len({norm(x) for x in (product.get('colors') or []) if norm(x)})
        if expected_colors and len(color_photos) < expected_colors:
            missing_color_photos.append((sid, product.get('title'), expected_colors, len(color_photos)))

        if not gallery and before:
            gallery = before[:1]

        if gallery != before:
            product['images'] = gallery
            changed += 1
            removed += max(0, len(before) - len(gallery))
            added += max(0, len(gallery) - len(before))

        print(
            f'[{idx}/{len(products)}] {product.get("title")}: '
            f'before={len(before)} angles={len(angles)} colors={len(color_photos)} after={len(gallery)}'
        )

    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Products={len(products)} changed={changed} removed={removed} added={added} source_failures={len(failures)} missing_color_photos={len(missing_color_photos)}')
    if failures:
        print('SOURCE_FAILURES', failures[:20])
    if missing_color_photos:
        print('MISSING_COLOR_PHOTOS', missing_color_photos[:30])


if __name__ == '__main__':
    main()
