#!/usr/bin/env python3
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from import_berhouse_furniture import parse_product, clean

DATA = Path('data/furniture.json')


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
        except Exception as exc:
            failed.append((product.get('id'), str(exc)))
            print(f'WARN {idx}/{len(sofas)} {product.get("title")}: {exc}', file=sys.stderr)
            continue

        fresh_colors=uniq(fresh.get('colors') or [])
        fresh_variants=fresh.get('variants') or []
        if not fresh_colors or not fresh_variants:
            failed.append((product.get('id'), 'no colors/variants parsed'))
            continue

        old_colors=uniq(product.get('colors') or [])
        old_map=product.get('colorImages') or {}
        new_map={}
        if old_map:
            # Berhouse renders sofa color variants in the same order as their
            # swatch/product images. Preserve image associations while replacing
            # the public label with the exact current Berhouse variant label.
            for pos, new_color in enumerate(fresh_colors):
                if pos < len(old_colors):
                    old_color=old_colors[pos]
                    if old_color in old_map:
                        new_map[new_color]=old_map[old_color]
            # Keep only mappings that are keyed by an authoritative current label.
            if len(new_map) != len(fresh_colors):
                new_map={c: old_map.get(c) for c in fresh_colors if old_map.get(c)}

        before=(product.get('colors'), product.get('variants'))
        product['colors']=fresh_colors
        product['variants']=fresh_variants
        if new_map:
            product['colorImages']=new_map
        elif 'colorImages' in product:
            product['colorImages']={}

        if before != (product.get('colors'), product.get('variants')):
            changed += 1
        print(f'OK {idx}/{len(sofas)} {product.get("title")}: {fresh_colors}')

    if failed:
        print('FAILED:', failed, file=sys.stderr)
        raise SystemExit(f'Could not refresh {len(failed)} sofa products')

    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Updated {changed} of {len(sofas)} sofas from live Berhouse variant labels')


if __name__ == '__main__':
    main()
