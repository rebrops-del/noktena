#!/usr/bin/env python3
import json
import re
from pathlib import Path

DATA_PATH = Path("data/furniture.json")


def clean(value):
    return re.sub(r"\s+", " ", str(value or "").replace("\xa0", " ")).strip()


def norm(value):
    return re.sub(r"[^a-zа-я0-9]+", "", clean(value).lower().replace("ё", "е"))


def color_family(value):
    s = clean(value).lower().replace("ё", "е")
    s = re.sub(r"\b(veluto|велюто|велюр|ткань|экокожа|кожа)\b", " ", s, flags=re.I)
    s = re.sub(r"\b\d{1,3}\b", " ", s)
    s = re.sub(r"[^a-zа-я]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()

    if "серо беж" in s:
        return "beige"
    if "серо син" in s:
        return "light_blue"
    if "темно сер" in s or "темный сер" in s:
        return "dark_gray"
    if "светло сер" in s or "светлый сер" in s:
        return "light_gray"
    if "ярко роз" in s:
        return "pink"

    groups = [
        (("беж", "песоч", "крем"), "beige"),
        (("борд", "винн"), "burgundy"),
        (("корич", "шокол"), "brown"),
        (("лазур", "азур"), "azure"),
        (("бирюз",), "turquoise"),
        (("оранж", "террак"), "orange"),
        (("голуб",), "light_blue"),
        (("син",), "blue"),
        (("роз", "фукс"), "pink"),
        (("сер", "графит", "антрац"), "gray"),
        (("зел", "изумруд"), "green"),
        (("мят",), "mint"),
        (("олив",), "olive"),
        (("крас",), "red"),
        (("желт", "охр", "горч"), "yellow"),
        (("фиолет", "сирен"), "purple"),
        (("бел", "айвор", "молоч"), "white"),
        (("черн", "кольт"), "black"),
        (("капуч", "тауп"), "taupe"),
    ]
    for needles, family in groups:
        if any(x in s for x in needles):
            return family
    return norm(s)


def unique(values):
    out = []
    seen = set()
    for value in values or []:
        text = clean(value)
        key = norm(text)
        if not text or not key or key in seen:
            continue
        seen.add(key)
        out.append(text)
    return out


def match_score(public_color, variant_color):
    if norm(public_color) == norm(variant_color):
        return 1000

    score = 500 if color_family(public_color) == color_family(variant_color) else 0
    public_low = clean(public_color).lower().replace("ё", "е")
    variant_low = clean(variant_color).lower().replace("ё", "е")
    for marker in ("темно", "светло"):
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
        mapping[norm(variant)] = public
        free_variants.remove(variant)
        free_public.remove(public)

    remaining_public = [c for c in public_colors if c in free_public]
    remaining_variants = [c for c in variant_colors if c in free_variants]
    if len(remaining_public) == len(remaining_variants):
        for variant, public in zip(remaining_variants, remaining_public):
            mapping[norm(variant)] = public

    return mapping


def normalize_product(product):
    variants = list(product.get("variants") or [])
    raw_map = {
        clean(key): value
        for key, value in (product.get("colorImages") or {}).items()
        if clean(key) and value
    }

    # colorImages is built directly from the customer-facing Berhouse "Цвет"
    # selector and therefore is the source of truth for labels shown in NOKTENA.
    if raw_map:
        public_colors = unique(raw_map.keys())
    else:
        public_colors = unique(product.get("colors") or [v.get("color") for v in variants])

    product["colors"] = public_colors
    if not variants or not public_colors:
        return []

    variant_colors = unique(v.get("color") for v in variants)
    mapping = build_variant_color_map(public_colors, variant_colors)
    unresolved = []
    color_order = {norm(color): index for index, color in enumerate(public_colors)}

    normalized_variants = []
    for index, variant in enumerate(variants):
        original = clean(variant.get("color"))
        mapped = mapping.get(norm(original))
        if original and not mapped:
            unresolved.append(original)
            mapped = original
        copy = dict(variant)
        if mapped:
            copy["color"] = mapped
        copy["__color_order"] = color_order.get(norm(mapped), len(public_colors) + index)
        normalized_variants.append(copy)

    normalized_variants.sort(key=lambda item: item.pop("__color_order"))
    product["variants"] = normalized_variants
    return unique(unresolved)


def require_mapping(product, expected):
    if not product:
        raise SystemExit("Validation product missing")
    colors = product.get("colors") or []
    variants = unique(v.get("color") for v in product.get("variants") or [])
    for color, ending in expected.items():
        if color not in colors:
            raise SystemExit(f"Missing Berhouse public color {color!r} in {product.get('title')}: {colors}")
        if color not in variants:
            raise SystemExit(f"Variant selector not normalized to {color!r} in {product.get('title')}: {variants}")
        url = (product.get("colorImages") or {}).get(color)
        if not url or not str(url).endswith(ending):
            raise SystemExit(f"Wrong photo mapping {product.get('title')} / {color}: {url}")


def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    products = list(data.get("beds", [])) + list(data.get("sofas", []))
    unresolved_total = []

    for product in products:
        unresolved = normalize_product(product)
        if unresolved and product.get("colorImages"):
            unresolved_total.append((product.get("sourceId"), product.get("title"), unresolved))

    by_id = {str(p.get("sourceId")): p for p in products}
    require_mapping(by_id.get("24139"), {
        "Серо бежевый": "24139_419530.jpg",
        "Серо синий": "24139_419531.jpg",
        "Серый": "24139_419529.jpg",
        "Ярко розовый": "24139_419532.jpg",
    })
    require_mapping(by_id.get("24140"), {
        "Серо бежевый": "24140_419534.jpg",
        "Серо синий": "24140_419535.jpg",
        "Серый": "24140_419533.jpg",
        "Ярко розовый": "24140_419536.jpg",
    })
    require_mapping(by_id.get("24182"), {
        "Бежевый": "24182_420756.png",
        "Серый": "24182_420757.png",
        "Коричневый": "24182_420758.png",
        "Бордовый": "24182_420759.png",
        "Оранжевый": "24182_420760.png",
        "Темно серый": "24182_420761.png",
        "Лазурный": "24182_420762.png",
        "Синий": "24182_420763.png",
    })

    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Products normalized: {len(products)}")
    print(f"Products with unresolved selector colors: {len(unresolved_total)}")
    for item in unresolved_total[:30]:
        print("UNRESOLVED", item)


if __name__ == "__main__":
    main()
