#!/usr/bin/env python3
import hashlib
import io
import json
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup
from PIL import Image

DATA = Path('data/furniture.json')

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (compatible; NoktenaCatalogSync/4.3; +https://noktena.ru/)',
    'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.6',
})

IMAGE_EXT_RE = re.compile(r'\.(?:jpe?g|png|webp)(?:$|\?)', re.I)


def clean(value):
    return re.sub(r'\s+', ' ', str(value or '').replace('\xa0', ' ')).strip()


def norm(value):
    return re.sub(r'[^a-zа-я0-9]+', '', clean(value).lower().replace('ё', 'е'))


def canonical(url):
    p = urlparse(str(url or ''))
    return urlunparse((p.scheme, p.netloc, p.path, '', '', ''))


def filename(url):
    return urlparse(str(url or '')).path.rsplit('/', 1)[-1]


def base_filename_match(url, product_id):
    """Real product angles: ID.jpg, IDa1.jpg, IDa2.jpg, ...

    Files such as ID_123456.jpg are Berhouse size/color variants. We do not
    import every one of those; a separate pass below keeps exactly one image
    for each customer-facing color.
    """
    name = filename(url)
    return bool(re.fullmatch(
        rf'{re.escape(str(product_id))}(?:[a-z]+\d+)?\.(?:jpe?g|png|webp)',
        name,
        flags=re.I,
    ))


def image_bytes(url, cache):
    url = canonical(url)
    if not url:
        return None
    if url in cache:
        return cache[url]
    try:
        r = session.get(url, timeout=30)
        r.raise_for_status()
        content_type = (r.headers.get('content-type') or '').lower()
        if 'image' not in content_type and not IMAGE_EXT_RE.search(url):
            cache[url] = None
        else:
            cache[url] = r.content
    except Exception:
        cache[url] = None
    return cache[url]


def prefer_big(url, cache):
    url = canonical(url)
    if '/files/eshop/small/' not in url.lower():
        return url
    candidate = re.sub(r'/files/eshop/small/', '/files/eshop/big/', url, flags=re.I)
    return candidate if image_bytes(candidate, cache) else url


def visual_fingerprint(blob):
    if not blob:
        return None
    try:
        img = Image.open(io.BytesIO(blob)).convert('L')
        a = img.resize((8, 8), Image.Resampling.LANCZOS)
        pixels = list(a.getdata())
        mean = sum(pixels) / len(pixels)
        ahash = ''.join('1' if px >= mean else '0' for px in pixels)

        d = img.resize((9, 8), Image.Resampling.LANCZOS)
        p = list(d.getdata())
        dhash_bits = []
        for y in range(8):
            row = p[y * 9:(y + 1) * 9]
            dhash_bits.extend('1' if row[x] > row[x + 1] else '0' for x in range(8))
        return ahash + ''.join(dhash_bits)
    except Exception:
        return None


def source_real_gallery(product, byte_cache):
    source_url = clean(product.get('sourceUrl'))
    product_id = clean(product.get('sourceId'))
    if not source_url or not product_id:
        return []

    r = session.get(source_url, timeout=40)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or r.encoding
    soup = BeautifulSoup(r.text, 'html.parser')

    out = []
    seen = set()

    for anchor in soup.select('.thumbs a[href]'):
        raw = anchor.get('href')
        if not raw:
            continue
        url = canonical(urljoin(r.url, raw))
        if not base_filename_match(url, product_id):
            continue
        url = prefer_big(url, byte_cache)
        if url not in seen:
            seen.add(url)
            out.append(url)

    if not out:
        photo = soup.select_one('.photo a[href]')
        if photo:
            url = canonical(urljoin(r.url, photo.get('href')))
            if base_filename_match(url, product_id):
                out.append(prefer_big(url, byte_cache))

    if not out:
        og = soup.find('meta', attrs={'property': 'og:image'})
        if og:
            url = canonical(urljoin(r.url, og.get('content')))
            if base_filename_match(url, product_id):
                out.append(prefer_big(url, byte_cache))

    return out


def dedupe_real_angles(urls, byte_cache):
    """Deduplicate only real gallery angles perceptually."""
    result = []
    seen_urls = set()
    seen_exact = set()
    seen_visual = set()

    for raw in urls:
        url = canonical(raw)
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)

        blob = image_bytes(url, byte_cache)
        if blob:
            exact = hashlib.sha256(blob).hexdigest()
            if exact in seen_exact:
                continue
            fp = visual_fingerprint(blob)
            if fp and fp in seen_visual:
                continue
            seen_exact.add(exact)
            if fp:
                seen_visual.add(fp)

        result.append(url)
    return result


def one_photo_per_color(product, byte_cache):
    """Return one exact Berhouse photo for each displayed color.

    A product can have dozens of size × color variant images. colorImages has
    already been reduced to the authoritative color mapping by the enrichment
    steps, so this turns those combinations into one thumbnail per color.
    """
    mapping = {
        clean(label): canonical(url)
        for label, url in (product.get('colorImages') or {}).items()
        if clean(label) and canonical(url)
    }
    if not mapping:
        return []

    by_norm = {}
    for label, url in mapping.items():
        by_norm.setdefault(norm(label), url)

    ordered = []
    seen_labels = set()
    for label in product.get('colors') or []:
        key = norm(label)
        if not key or key in seen_labels:
            continue
        url = by_norm.get(key)
        if url:
            ordered.append(prefer_big(url, byte_cache))
            seen_labels.add(key)

    # Keep source colors that are valid but absent from product.colors so a
    # temporary label mismatch never makes a real shade disappear.
    for label, url in mapping.items():
        key = norm(label)
        if key and key not in seen_labels:
            ordered.append(prefer_big(url, byte_cache))
            seen_labels.add(key)

    # Only exact-byte duplicates are removed here. Different colors often use
    # the same pose, so perceptual deduplication would incorrectly delete valid
    # shade photographs.
    result = []
    seen_urls = set()
    seen_exact = set()
    for raw in ordered:
        url = canonical(raw)
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        blob = image_bytes(url, byte_cache)
        if blob:
            exact = hashlib.sha256(blob).hexdigest()
            if exact in seen_exact:
                continue
            seen_exact.add(exact)
        result.append(url)
    return result


def merge_gallery(real_angles, color_photos, byte_cache):
    """Angles first, then one photo per color, with exact duplicate removal."""
    result = []
    seen_urls = set()
    seen_exact = set()
    for raw in list(real_angles) + list(color_photos):
        url = canonical(raw)
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        blob = image_bytes(url, byte_cache)
        if blob:
            exact = hashlib.sha256(blob).hexdigest()
            if exact in seen_exact:
                continue
            seen_exact.add(exact)
        result.append(url)
    return result


def fallback_existing(product, before, byte_cache):
    product_id = clean(product.get('sourceId'))
    base = [u for u in before if base_filename_match(u, product_id)]
    real = dedupe_real_angles([prefer_big(u, byte_cache) for u in base], byte_cache)
    colors = one_photo_per_color(product, byte_cache)
    if real or colors:
        return merge_gallery(real, colors, byte_cache)
    return before[:1]


def main():
    data = json.loads(DATA.read_text(encoding='utf-8'))
    products = list(data.get('beds') or []) + list(data.get('sofas') or [])
    changed = 0
    removed = 0
    added = 0
    failures = []
    byte_cache = {}

    for idx, product in enumerate(products, 1):
        before = list(product.get('images') or [])
        try:
            source_gallery = source_real_gallery(product, byte_cache)
            real_angles = dedupe_real_angles(source_gallery, byte_cache)
            color_photos = one_photo_per_color(product, byte_cache)
            cleaned = merge_gallery(real_angles, color_photos, byte_cache)
        except Exception as exc:
            failures.append((product.get('sourceId'), str(exc)))
            source_gallery = []
            real_angles = []
            color_photos = []
            cleaned = fallback_existing(product, before, byte_cache)

        if not cleaned:
            cleaned = fallback_existing(product, before, byte_cache)

        if cleaned != before:
            product['images'] = cleaned
            changed += 1
            removed += max(0, len(before) - len(cleaned))
            added += max(0, len(cleaned) - len(before))

        print(
            f'[{idx}/{len(products)}] {product.get("title")}: '
            f'before={len(before)} angles={len(real_angles)} colors={len(color_photos)} after={len(cleaned)}'
        )

    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(
        f'Products={len(products)} changed={changed} removed={removed} '
        f'added={added} failures={len(failures)}'
    )
    if failures:
        print('Source lookup failures:', failures[:20])


if __name__ == '__main__':
    main()
