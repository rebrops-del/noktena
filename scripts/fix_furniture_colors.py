#!/usr/bin/env python3
import json
import re
from pathlib import Path

DATA_PATH = Path("data/furniture.json")


def clean(value):
    return re.sub(r"\s+", " ", str(value or "").replace("\xa0", " ")).strip()


def norm(value):
    return re.sub(r"[^a-zа-я0-9]+", "", clean(value).lower().replace("ё", "е"))


def canonical_color(value):
    s = clean(value).lower().replace("ё", "е")
    s = re.sub(r"\b(veluto|велюто|велюр|ткань|экокожа|кожа)\b", " ", s, flags=re.I)
    s = re.sub(r"\b\d{1,3}\b", " ", s)
    s = re.sub(r"[^a-zа-я]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()

    # Compound Berhouse gallery labels first: they are photo labels, while the
    # variant labels below are the authoritative public names.
    if "серо беж" in s:
        return "beige"
    if "серо син" in s:
        return "light_blue"
    if "темно сер" in s or "темный сер" in s:
        return "dark_gray"
    if "светло сер" in s or "светлый сер" in s:
        return "light_gray"

    checks = [
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
    for needles, family in checks:
        if any(x in s for x in needles):
            return family
    return norm(s)


def unique_variant_colors(product):
    out = []
    seen = set()
    for variant in product.get("variants") or []:
        color = clean(variant.get("color"))
        key = norm(color)
        if color and key and key not in seen:
            seen.add(key)
            out.append(color)
    return out


def score_match(authoritative, source):
    a_norm, s_norm = norm(authoritative), norm(source)
    if a_norm == s_norm:
        return 1000

    a_family, s_family = canonical_color(authoritative), canonical_color(source)
    score = 0
    if a_family and a_family == s_family:
        score += 500

    # Prefer the same explicit light/dark modifier when several gray shades exist.
    a_low = clean(authoritative).lower().replace("ё", "е")
    s_low = clean(source).lower().replace("ё", "е")
    for marker in ("темно", "светло"):
        if marker in a_low and marker in s_low:
            score += 120
        elif (marker in a_low) != (marker in s_low):
            score -= 90

    # If Berhouse includes a fabric code in both labels, matching it is decisive.
    a_nums = set(re.findall(r"\b\d{1,3}\b", a_low))
    s_nums = set(re.findall(r"\b\d{1,3}\b", s_low))
    if a_nums and s_nums:
        score += 180 if a_nums & s_nums else -120

    a_words = {w for w in re.findall(r"[a-zа-я]+", a_low) if len(w) >= 4}
    s_words = {w for w in re.findall(r"[a-zа-я]+", s_low) if len(w) >= 4}
    score += 15 * len(a_words & s_words)
    return score


def add_authoritative_aliases(product):
    authoritative = unique_variant_colors(product)
    if not authoritative:
        authoritative = [clean(x) for x in product.get("colors") or [] if clean(x)]

    product["colors"] = authoritative
    raw_map = {clean(k): v for k, v in (product.get("colorImages") or {}).items() if clean(k) and v}
    if not raw_map or not authoritative:
        return 0, []

    combined = dict(raw_map)
    used_sources = set()
    unresolved = []
    added = 0

    for color in authoritative:
        # Existing exact authoritative key already works.
        exact = next((k for k in raw_map if norm(k) == norm(color)), None)
        if exact:
            combined[color] = raw_map[exact]
            used_sources.add(exact)
            continue

        ranked = sorted(
            ((score_match(color, source), source) for source in raw_map if source not in used_sources),
            reverse=True,
        )
        if ranked and ranked[0][0] >= 350:
            _, source = ranked[0]
            combined[color] = raw_map[source]
            used_sources.add(source)
            added += 1
        else:
            unresolved.append(color)

    product["colorImages"] = combined
    images = list(product.get("images") or [])
    for url in combined.values():
        if url and url not in images:
            images.append(url)
    product["images"] = images
    return added, unresolved


def require_mapping(product, expected):
    if not product:
        raise SystemExit("Validation product missing")
    actual_colors = product.get("colors") or []
    for color, ending in expected.items():
        if color not in actual_colors:
            raise SystemExit(f"Missing authoritative color {color!r} in {product.get('title')}: {actual_colors}")
        url = (product.get("colorImages") or {}).get(color)
        if not url or not str(url).endswith(ending):
            raise SystemExit(f"Wrong photo mapping {product.get('title')} / {color}: {url}")


def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    products = list(data.get("beds", [])) + list(data.get("sofas", []))
    added = 0
    unresolved_total = []

    for product in products:
        count, unresolved = add_authoritative_aliases(product)
        added += count
        if unresolved:
            unresolved_total.append((product.get("sourceId"), product.get("title"), unresolved))

    by_id = {str(p.get("sourceId")): p for p in products}
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
        "Беж Велюто 05": "24182_420756.png",
        "Серый Велюто 12": "24182_420757.png",
        "Коричневый Велюто 23": "24182_420758.png",
        "Бордо Велюто 25": "24182_420759.png",
        "Оранж Велюто 27": "24182_420760.png",
        "Темно серый Велюто 32": "24182_420761.png",
        "Азур Велюто 44": "24182_420762.png",
        "Синий Велюто 54": "24182_420763.png",
    })

    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Products: {len(products)}; authoritative photo aliases added: {added}")
    print(f"Products with unresolved photo aliases: {len(unresolved_total)}")
    for item in unresolved_total[:30]:
        print("UNRESOLVED", item)


if __name__ == "__main__":
    main()
