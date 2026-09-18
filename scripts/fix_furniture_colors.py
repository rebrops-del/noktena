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


SOFA_FAMILY_LABELS = {
    "beige": "Бежевый",
    "burgundy": "Бордовый",
    "brown": "Коричневый",
    "azure": "Лазурный",
    "turquoise": "Бирюзовый",
    "orange": "Оранжевый",
    "light_blue": "Голубой",
    "blue": "Синий",
    "pink": "Розовый",
    "gray": "Серый",
    "dark_gray": "Темно-серый",
    "light_gray": "Светло-серый",
    "green": "Зеленый",
    "mint": "Мятный",
    "olive": "Оливковый",
    "red": "Красный",
    "yellow": "Желтый",
    "purple": "Фиолетовый",
    "white": "Белый",
    "black": "Черный",
    "taupe": "Тауп",
}


def sofa_display_label(value):
    """Turn technical fabric/gallery labels into concise storefront colors."""
    text = clean(value)
    low = text.lower().replace("ё", "е")
    compact = re.sub(r"[-_]+", " ", low)
    compact = re.sub(r"\s+", " ", compact).strip()
    technical = (
        "велюто" in low
        or "veluto" in low
        or compact in {"серо бежевый", "серо синий", "ярко розовый"}
    )
    if not technical:
        return text
    return SOFA_FAMILY_LABELS.get(color_family(text), text)


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


def normalize_bed(product):
    """Beds use Berhouse's customer-facing color selector as display truth."""
    variants = list(product.get("variants") or [])
    raw_map = {
        clean(key): value
        for key, value in (product.get("colorImages") or {}).items()
        if clean(key) and value
    }

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


def normalize_sofa(product):
    """Use concise sofa color names and keep exact Berhouse color photos."""
    variants = []
    for variant in list(product.get("variants") or []):
        copy = dict(variant)
        original = clean(copy.get("color"))
        display = sofa_display_label(original)
        if display:
            copy["color"] = display
            attrs = dict(copy.get("attributes") or {})
            for key in ("Цвет фасада", "Цвет", "Цвет корпуса"):
                if key in attrs and clean(attrs.get(key)):
                    attrs[key] = display
            if attrs:
                copy["attributes"] = attrs
        variants.append(copy)
    product["variants"] = variants

    variant_colors = unique(v.get("color") for v in variants)
    if not variant_colors:
        variant_colors = unique(sofa_display_label(x) for x in (product.get("colors") or []))
    product["colors"] = variant_colors

    raw_map = {
        clean(key): value
        for key, value in (product.get("colorImages") or {}).items()
        if clean(key) and value
    }
    if not raw_map or not variant_colors:
        return []

    source_colors = unique(raw_map.keys())
    mapping = build_variant_color_map(source_colors, variant_colors)
    combined = dict(raw_map)
    unresolved = []

    for color in variant_colors:
        exact = next((key for key in raw_map if norm(key) == norm(color)), None)
        if exact:
            combined[color] = raw_map[exact]
            continue
        source = mapping.get(norm(color))
        if source and source in raw_map:
            combined[color] = raw_map[source]
        else:
            unresolved.append(color)

    product["colorImages"] = combined
    images = list(product.get("images") or [])
    for url in combined.values():
        if url and url not in images:
            images.append(url)
    product["images"] = images
    return unique(unresolved)


def require_mapping(product, expected, require_variant=True):
    if not product:
        raise SystemExit("Validation product missing")
    colors = product.get("colors") or []
    variants = unique(v.get("color") for v in product.get("variants") or [])
    for color, ending in expected.items():
        if color not in colors:
            raise SystemExit(f"Missing display color {color!r} in {product.get('title')}: {colors}")
        if require_variant and color not in variants:
            raise SystemExit(f"Variant selector not normalized to {color!r} in {product.get('title')}: {variants}")
        url = (product.get("colorImages") or {}).get(color)
        if not url or not str(url).endswith(ending):
            raise SystemExit(f"Wrong photo mapping {product.get('title')} / {color}: {url}")


def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    beds = list(data.get("beds", []))
    sofas = list(data.get("sofas", []))
    unresolved_total = []

    for product in beds:
        unresolved = normalize_bed(product)
        if unresolved and product.get("colorImages"):
            unresolved_total.append(("bed", product.get("sourceId"), product.get("title"), unresolved))

    for product in sofas:
        unresolved = normalize_sofa(product)
        if unresolved and product.get("colorImages"):
            unresolved_total.append(("sofa", product.get("sourceId"), product.get("title"), unresolved))

    by_id = {str(p.get("sourceId")): p for p in beds + sofas}

    require_mapping(by_id.get("24139"), {
        "Серый": "24139_419529.jpg",
        "Бежевый": "24139_419530.jpg",
        "Голубой": "24139_419531.jpg",
        "Розовый": "24139_419532.jpg",
    })
    require_mapping(by_id.get("24140"), {
        "Серый": "24140_419533.jpg",
        "Бежевый": "24140_419534.jpg",
        "Голубой": "24140_419535.jpg",
        "Розовый": "24140_419536.jpg",
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
    print(f"Beds normalized: {len(beds)}; sofas normalized: {len(sofas)}")
    print(f"Products with unresolved color-photo aliases: {len(unresolved_total)}")
    for item in unresolved_total[:30]:
        print("UNRESOLVED", item)


if __name__ == "__main__":
    main()
