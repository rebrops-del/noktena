#!/usr/bin/env python3
import json
import re
from pathlib import Path

DATA_PATH = Path('data/furniture.json')


def clean(value):
    return re.sub(r'\s+', ' ', str(value or '').replace('\xa0', ' ')).strip()


def norm(value):
    return re.sub(r'[^a-zа-я0-9]+', '', clean(value).lower().replace('ё', 'е'))


def color_key(value):
    key = norm(value)
    # Same customer-facing shade can arrive from different Berhouse blocks
    # under grammatical aliases. Treat those as one selectable color.
    aliases = {
        'бордо': 'бордовый',
    }
    return aliases.get(key, key)


def unique(values, key_fn=norm):
    out = []
    seen = set()
    for value in values or []:
        text = clean(value)
        key = key_fn(text)
        if not text or not key or key in seen:
            continue
        seen.add(key)
        out.append(text)
    return out


def color_family(value):
    s = clean(value).lower().replace('ё', 'е')
    s = re.sub(r'\b(veluto|велюто|велюр|ткань|экокожа|кожа)\b', ' ', s, flags=re.I)
    s = re.sub(r'\b\d{1,3}\b', ' ', s)
    s = re.sub(r'[^a-zа-я]+', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()

    if 'серо беж' in s:
        return 'beige'
    if 'серо син' in s:
        return 'light_blue'
    if 'темно сер' in s or 'темный сер' in s:
        return 'dark_gray'
    if 'светло сер' in s or 'светлый сер' in s:
        return 'light_gray'
    if 'ярко роз' in s:
        return 'pink'

    groups = [
        (('беж', 'песоч', 'крем'), 'beige'),
        (('борд', 'винн'), 'burgundy'),
        (('корич', 'шокол'), 'brown'),
        (('лазур', 'азур'), 'azure'),
        (('бирюз',), 'turquoise'),
        (('оранж', 'террак'), 'orange'),
        (('голуб',), 'light_blue'),
        (('син',), 'blue'),
        (('роз', 'фукс'), 'pink'),
        (('сер', 'графит', 'антрац'), 'gray'),
        (('зел', 'изумруд'), 'green'),
        (('мят',), 'mint'),
        (('олив',), 'olive'),
        (('крас',), 'red'),
        (('желт', 'охр', 'горч'), 'yellow'),
        (('фиолет', 'сирен'), 'purple'),
        (('бел', 'айвор', 'молоч'), 'white'),
        (('черн', 'кольт'), 'black'),
        (('капуч', 'тауп'), 'taupe'),
    ]
    for needles, family in groups:
        if any(x in s for x in needles):
            return family
    return color_key(s)


def match_score(public_color, variant_color):
    if color_key(public_color) == color_key(variant_color):
        return 1000
    score = 500 if color_family(public_color) == color_family(variant_color) else 0
    public_low = clean(public_color).lower().replace('ё', 'е')
    variant_low = clean(variant_color).lower().replace('ё', 'е')
    for marker in ('темно', 'светло'):
        if marker in public_low and marker in variant_low:
            score += 120
        elif (marker in public_low) != (marker in variant_low):
            score -= 90
    return score


def build_variant_color_map(public_colors, variant_colors):
    mapping = {}
    free_public = set(public_colors)
    free_variants = set(variant_colors)
    pairs = []
    for variant in variant_colors:
        for public in public_colors:
            pairs.append((match_score(public, variant), variant, public))
    pairs.sort(reverse=True)

    for score, variant, public in pairs:
        if score < 350 or variant not in free_variants or public not in free_public:
            continue
        mapping[color_key(variant)] = public
        free_variants.remove(variant)
        free_public.remove(public)

    remaining_public = [c for c in public_colors if c in free_public]
    remaining_variants = [c for c in variant_colors if c in free_variants]
    if len(remaining_public) == len(remaining_variants):
        for variant, public in zip(remaining_variants, remaining_public):
            mapping[color_key(variant)] = public
    return mapping


def normalize_bed(product):
    """Use one public Berhouse label and one image for each actual bed shade."""
    variants = list(product.get('variants') or [])
    raw_items = [
        (clean(label), url)
        for label, url in (product.get('colorImages') or {}).items()
        if clean(label) and url
    ]

    if raw_items:
        public_colors = unique([label for label, _ in raw_items], key_fn=color_key)
        raw_by_key = {}
        for label, url in raw_items:
            raw_by_key.setdefault(color_key(label), url)
        product['colorImages'] = {
            color: raw_by_key[color_key(color)]
            for color in public_colors
            if color_key(color) in raw_by_key
        }
    else:
        public_colors = unique(
            product.get('colors') or [v.get('color') for v in variants],
            key_fn=color_key,
        )

    product['colors'] = public_colors
    if not variants or not public_colors:
        return []

    variant_colors = unique([v.get('color') for v in variants], key_fn=color_key)
    mapping = build_variant_color_map(public_colors, variant_colors)
    unresolved = []
    color_order = {color_key(color): index for index, color in enumerate(public_colors)}

    normalized_variants = []
    for index, variant in enumerate(variants):
        original = clean(variant.get('color'))
        mapped = mapping.get(color_key(original))
        if original and not mapped:
            unresolved.append(original)
            mapped = original
        copy = dict(variant)
        if mapped:
            copy['color'] = mapped
        copy['__color_order'] = color_order.get(color_key(mapped), len(public_colors) + index)
        normalized_variants.append(copy)

    normalized_variants.sort(key=lambda item: item.pop('__color_order'))
    product['variants'] = normalized_variants
    return unique(unresolved, key_fn=color_key)


def normalize_sofa(product):
    """Sofa variant labels are exact Berhouse names and must not be generalized."""
    exact_colors = unique([v.get('color') for v in (product.get('variants') or [])])
    if exact_colors:
        product['colors'] = exact_colors
    return []


def validate_sofas(sofas):
    bad = []
    for product in sofas:
        expected = unique([v.get('color') for v in (product.get('variants') or [])])
        actual = unique(product.get('colors') or [])
        if [norm(x) for x in expected] != [norm(x) for x in actual]:
            bad.append((product.get('sourceId'), product.get('title'), 'colors differ from exact variants'))
    if bad:
        raise SystemExit('Sofa color validation failed: ' + repr(bad[:30]))


def main():
    data = json.loads(DATA_PATH.read_text(encoding='utf-8'))
    beds = list(data.get('beds', []))
    sofas = list(data.get('sofas', []))
    unresolved_total = []

    for product in beds:
        unresolved = normalize_bed(product)
        if unresolved and product.get('colorImages'):
            unresolved_total.append(('bed', product.get('sourceId'), product.get('title'), unresolved))

    for product in sofas:
        normalize_sofa(product)

    validate_sofas(sofas)
    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Beds normalized: {len(beds)}; sofas preserved exactly: {len(sofas)}')
    print(f'Beds with unresolved color aliases: {len(unresolved_total)}')
    for item in unresolved_total[:30]:
        print('UNRESOLVED', item)


if __name__ == '__main__':
    main()
