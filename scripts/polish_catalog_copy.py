#!/usr/bin/env python3
import json
import re
from pathlib import Path

FURNITURE = Path('data/furniture.json')
MATTRESS_FILES = [Path(f'data/data{i}.json') for i in range(1, 7)]


def clean(value):
    return re.sub(r'\s+', ' ', str(value or '').replace('\xa0', ' ')).strip()


def norm(value):
    return clean(value).lower().replace('ё', 'е')


def color_key(value):
    """Canonical key for the same human color written with spaces/hyphens."""
    key = re.sub(r'[^a-zа-я0-9]+', '', norm(value))
    aliases = {
        'бордо': 'бордовый',
    }
    return aliases.get(key, key)


def sentence_case_if_upper(text):
    text = clean(text)
    letters = ''.join(ch for ch in text if ch.isalpha())
    if letters and sum(ch.isupper() for ch in letters) / max(1, len(letters)) > 0.78:
        text = text.lower()
        text = text[:1].upper() + text[1:]
    return text


def pretty_quotes(text):
    text = clean(text)
    return re.sub(r'"([^"\n]{1,80})"', lambda m: f'«{m.group(1).strip()}»', text)


def pretty_title(title):
    title = clean(title)
    title = re.sub(r'\s*\(\s*BERHOUSE\s*\)\s*', ' ', title, flags=re.I)
    title = re.sub(r'\s*\(\s*ЗР\s*\)\s*$', '', title, flags=re.I)
    title = re.sub(r'\s+', ' ', title).strip(' -–—')
    title = sentence_case_if_upper(title)
    title = pretty_quotes(title)
    title = re.sub(r'\bподъемн', 'подъёмн', title, flags=re.I)
    return title


def pretty_value(value):
    text = clean(value)
    # Normalize only dimension separators between numbers; never replace letters inside words.
    text = re.sub(r'(?<=\d)\s*[xхХ*]\s*(?=\d)', '×', text)
    text = re.sub(r'(?<=\d)\s*[×]\s*(?=\d)', '×', text)
    text = re.sub(r'(?<=\d)\s*мм\b', ' мм', text, flags=re.I)
    text = re.sub(r'\s+([,.;:])', r'\1', text)
    return pretty_quotes(text)


def remove_source_noise(text):
    text = clean(text)
    if not text:
        return ''
    text = re.sub(r'\s*\(\s*BERHOUSE\s*\)\s*', ' ', text, flags=re.I)
    text = re.sub(r'\bBERHOUSE\b', '', text, flags=re.I)
    text = re.sub(r'https?://\S+', '', text, flags=re.I)
    text = re.sub(r'\b(?:телефон|тел\.?|звоните)\s*[:.-]?\s*\+?\d[\d\s()\-]{7,}', '', text, flags=re.I)
    return re.sub(r'\s+', ' ', text).strip()


def polish_description(text):
    text = remove_source_noise(text)
    if not text:
        return ''
    for pat in (
        r'[^.!?]*\b(?:купить|заказать)\b[^.!?]*(?:интернет[- ]магазин|магазин|сайт)[^.!?]*[.!?]?',
        r'[^.!?]*\bдоставка\b[^.!?]*\bпо\s+(?:россии|екатеринбургу)[^.!?]*[.!?]?',
        r'[^.!?]*\bоставьте\s+заявку\b[^.!?]*[.!?]?',
    ):
        text = re.sub(pat, ' ', text, flags=re.I)
    text = re.sub(r'Допустимая\s+ширина\s+дивана\s+от\s+1200\s+до\s+1410\s*мм.*?(?=(?:[А-ЯЁ][^.!?]{3,}[.!?])|$)', ' ', text, flags=re.I)
    text = re.sub(r'Больше\s+не\s+надо\s+подгонять\s+диван.*?(?:1200\s*мм\.?|$)', ' ', text, flags=re.I)
    text = pretty_quotes(sentence_case_if_upper(re.sub(r'\s+', ' ', text).strip()))
    parts = re.split(r'(?<=[.!?])\s+', text)
    out, seen = [], set()
    for part in parts:
        part = clean(part)
        if not part:
            continue
        key = re.sub(r'\W+', '', norm(part))
        if key and key not in seen:
            seen.add(key)
            out.append(part)
    return ' '.join(out)


def find_spec(product, names):
    for wanted in names:
        for k, v in (product.get('specs') or {}).items():
            if wanted in norm(k) and clean(v):
                return pretty_value(v)
    return ''


def size_count(product):
    vals = []
    for value in product.get('sizes') or []:
        value = pretty_value(value)
        if value and value not in vals:
            vals.append(value)
    if not vals:
        for variant in product.get('variants') or []:
            value = pretty_value(variant.get('size'))
            if value and value not in vals:
                vals.append(value)
    return len(vals)


def real_colors(product):
    """Return unique colors that are actually represented by product variants.

    Product-level `colors` can contain duplicate labels such as `Темно серый`
    and `Темно-серый`. Variant colors are the source of truth for purchasable
    options, so use them first and compare through a canonical key.
    """
    variant_values = [clean(v.get('color')) for v in product.get('variants') or [] if clean(v.get('color'))]
    source = variant_values if variant_values else [clean(v) for v in product.get('colors') or [] if clean(v)]
    out = []
    seen = set()
    for value in source:
        key = color_key(value)
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(value)
    return out


def color_count(product):
    return len(real_colors(product))


def russian_count(n, forms):
    n = int(n)
    if n % 10 == 1 and n % 100 != 11:
        return forms[0]
    if n % 10 in (2, 3, 4) and n % 100 not in (12, 13, 14):
        return forms[1]
    return forms[2]


def build_summary(product):
    is_bed = product.get('category') == 'beds'
    parts = []
    if is_bed:
        base = find_spec(product, ['кроватное основание', 'основан'])
        sleeping = find_spec(product, ['спальное место'])
        mechanism = find_spec(product, ['подъёмный механизм', 'подъемный механизм'])
        if sleeping:
            parts.append(f'Спальное место — {sleeping}.')
        if base:
            parts.append(f'Основание — {base}.')
        elif mechanism:
            parts.append(f'Подъёмный механизм — {mechanism}.')
    else:
        sleeping = find_spec(product, ['спальное место'])
        mechanism = find_spec(product, ['механизм трансформации'])
        fill = find_spec(product, ['наполнение'])
        subtype = clean(product.get('subtype'))
        parts.append(f'{subtype} диван для дома.' if subtype else 'Диван для дома и отдыха.')
        if sleeping:
            parts.append(f'Спальное место — {sleeping}.')
        if mechanism:
            parts.append(f'Механизм — {mechanism}.')
        elif fill:
            parts.append(f'Наполнение — {fill}.')
    sizes, colors = size_count(product), color_count(product)
    options = []
    if sizes:
        options.append(f'{sizes} {russian_count(sizes, ("размер", "размера", "размеров"))}')
    if colors:
        options.append(f'{colors} {russian_count(colors, ("цвет", "цвета", "цветов"))}')
    if options:
        parts.append('Доступно: ' + ', '.join(options) + '.')
    summary = ' '.join(parts).strip()
    if not summary:
        original = polish_description(product.get('summary') or product.get('description'))
        if original:
            return re.split(r'(?<=[.!?])\s+', original)[0][:220].strip()
    return summary[:280].strip()


def polish_specs(product):
    specs = {}
    for key, value in (product.get('specs') or {}).items():
        key, value = clean(key), clean(value)
        if not key or not value:
            continue
        key = pretty_quotes(sentence_case_if_upper(key))
        key = re.sub(r'\bподъемн', 'подъёмн', key, flags=re.I)
        specs[key] = pretty_value(value)
    product['specs'] = specs
    for variant in product.get('variants') or []:
        if variant.get('size'):
            variant['size'] = pretty_value(variant['size'])
        attrs = {}
        for key, value in (variant.get('attributes') or {}).items():
            key = pretty_quotes(sentence_case_if_upper(clean(key)))
            value = pretty_value(value)
            if key and value:
                attrs[key] = value
        variant['attributes'] = attrs
    product['sizes'] = []
    for variant in product.get('variants') or []:
        size = clean(variant.get('size'))
        if size and size not in product['sizes']:
            product['sizes'].append(size)
    # Keep the product-level list in sync with real purchasable variant colors.
    # This prevents duplicate labels (space vs hyphen) from inflating UI counts.
    product['colors'] = real_colors(product)


def polish_furniture():
    data = json.loads(FURNITURE.read_text(encoding='utf-8'))
    for group in ('beds', 'sofas'):
        for product in data.get(group, []):
            product['title'] = pretty_title(product.get('title'))
            polish_specs(product)
            product['description'] = polish_description(product.get('description'))
            product['summary'] = build_summary(product)
    FURNITURE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return data


def polish_mattresses():
    for path in MATTRESS_FILES:
        data = json.loads(path.read_text(encoding='utf-8'))
        for product in data:
            if product.get('model'):
                product['model'] = pretty_quotes(clean(product['model']))
            if product.get('intro'):
                product['intro'] = polish_description(product['intro'])
            if product.get('description'):
                product['description'] = polish_description(product['description'])
            for variant in product.get('variants') or []:
                if variant.get('size'):
                    variant['size'] = pretty_value(variant['size'])
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def validate(data):
    products = list(data.get('beds', [])) + list(data.get('sofas', []))
    for product in products:
        if not clean(product.get('title')) or not clean(product.get('summary')):
            raise SystemExit(f'Incomplete polished copy: {product.get("title")}')
        if '(ЗР)' in product.get('title', '') or '(BERHOUSE)' in product.get('title', '').upper():
            raise SystemExit(f'Unpolished title remains: {product.get("title")}')
        # Guard against accidental replacement of the Cyrillic letter "х" inside words.
        serialized = json.dumps(product, ensure_ascii=False).lower()
        if 'ме×ан' in serialized or '×олкон' in serialized or 'в×одит' in serialized:
            raise SystemExit(f'Corrupted text detected: {product.get("title")}')
        # Summary color count must always match actual unique purchasable variant colors.
        colors = color_count(product)
        match = re.search(r'Доступно:.*?(\d+)\s+(?:цвет|цвета|цветов)', product.get('summary', ''))
        if match and int(match.group(1)) != colors:
            raise SystemExit(f'Wrong color count in summary: {product.get("title")} ({match.group(1)} != {colors})')
    if 'допустимая ширина дивана от 1200 до 1410' in json.dumps(data, ensure_ascii=False).lower():
        raise SystemExit('Old Lodgia width paragraph remains')


def main():
    data = polish_furniture()
    polish_mattresses()
    validate(data)
    print(f'Polished catalog copy: beds={len(data.get("beds", []))}, sofas={len(data.get("sofas", []))}')


if __name__ == '__main__':
    main()
