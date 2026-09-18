#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path
from urllib.parse import urljoin

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parent))
from import_berhouse_furniture import parse_product, clean, get

DATA = Path('data/furniture.json')
COLOR_RE = re.compile(r'(?:Цвет фасада|Цвет корпуса|Цвет)\s*:\s*(.*?)(?=\s*;|\s+Наличие\s*:|$)', re.I)


def uniq(values):
    out=[]
    seen=set()
    for value in values:
        value=clean(value)
        key=value.casefold()
        if value and key not in seen:
            seen.add(key)
            out.append(value)
    return out


def norm(value):
    return re.sub(r'[^a-zа-я0-9]+', '', clean(value).lower().replace('ё','е'))


def exact_variant_image_map(url):
    """Read Berhouse variant blocks where exact color name and its image coexist."""
    r=get(url)
    soup=BeautifulSoup(r.text, 'html.parser')
    result={}
    for block in soup.select('.variantsList .block'):
        head=block.select_one('.head')
        img=block.select_one('.iconka img') or block.find('img')
        if not head or not img:
            continue
        text=clean(head.get_text(' ', strip=True))
        m=COLOR_RE.search(text)
        src=img.get('src') or img.get('data-src') or img.get('data-original')
        if not m or not src:
            continue
        color=clean(m.group(1))
        if color and color not in result:
            result[color]=urljoin(r.url, src)
    return result


def main():
    data=json.loads(DATA.read_text(encoding='utf-8'))
    sofas=data.get('sofas') or []
    changed=0
    failed=[]

    for idx, product in enumerate(sofas, 1):
        url=product.get('sourceUrl')
        if not url:
            failed.append((product.get('id'), 'missing sourceUrl'))
            continue
        group='sofas_corner' if str(product.get('subtype','')).lower().startswith('угл') else 'sofas_straight'
        try:
            fresh=parse_product(url, group)
            source_image_map=exact_variant_image_map(url)
        except Exception as exc:
            failed.append((product.get('id'), str(exc)))
            print(f'WARN {idx}/{len(sofas)} {product.get("title")}: {exc}', file=sys.stderr)
            continue

        fresh_colors=uniq(fresh.get('colors') or [])
        fresh_variants=fresh.get('variants') or []
        if not fresh_colors or not fresh_variants:
            failed.append((product.get('id'), 'no colors/variants parsed'))
            continue

        by_norm={norm(k):(k,v) for k,v in source_image_map.items() if k and v}
        new_map={}
        missing=[]
        for color in fresh_colors:
            found=by_norm.get(norm(color))
            if found:
                new_map[color]=found[1]
            else:
                missing.append(color)

        if missing:
            failed.append((product.get('id'), f'missing exact photos for {missing}; source keys={list(source_image_map)}'))
            print(f'WARN {idx}/{len(sofas)} {product.get("title")}: missing exact photos {missing}', file=sys.stderr)
            continue

        before=(product.get('colors'), product.get('variants'), product.get('colorImages'))
        product['colors']=fresh_colors
        product['variants']=fresh_variants
        product['colorImages']=new_map

        # colorImages is used when a customer selects a shade. Do not append
        # those same-pose color/size variant images to the thumbnail gallery.
        # The main gallery is rebuilt separately from Berhouse's real angles.

        if before != (product.get('colors'), product.get('variants'), product.get('colorImages')):
            changed += 1
        print(f'OK {idx}/{len(sofas)} {product.get("title")}: {[(c,new_map[c].rsplit("/",1)[-1]) for c in fresh_colors]}')

    if failed:
        print('FAILED:', failed, file=sys.stderr)
        raise SystemExit(f'Could not safely refresh {len(failed)} sofa products; no file written')

    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Updated {changed} of {len(sofas)} sofas with exact Berhouse color-to-photo links')


if __name__ == '__main__':
    main()
