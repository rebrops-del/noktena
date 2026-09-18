#!/usr/bin/env python3
import json
import re
from pathlib import Path

FURNITURE = Path("data/furniture.json")
MATTRESS_FILES = [Path(f"data/data{i}.json") for i in range(1, 7)]
MIN_FURNITURE_PRICE = 5000


def clean(value):
    return re.sub(r"\s+", " ", str(value or "").replace("\xa0", " ")).strip()


def color_key(value):
    key = re.sub(r"[^a-zа-я0-9]+", "", clean(value).lower().replace("ё", "е"))
    return {"бордо": "бордовый"}.get(key, key)


def clean_public_text(value, is_bed=False):
    text = clean(value)
    text = re.sub(r"\s*\(\s*BERHOUSE\s*\)\s*", " ", text, flags=re.I)
    text = re.sub(r"\bBERHOUSE\b", "", text, flags=re.I)
    if is_bed:
        text = re.sub(r"искусственн(?:ая|ой|ую|ые|ых)?\s+кож(?:а|и|у|ей)?", "велюр", text, flags=re.I)
        text = re.sub(r"эко\s*-?\s*кож(?:а|и|у|ей)?", "велюр", text, flags=re.I)
        text = re.sub(r"кожзам(?:енитель)?", "велюр", text, flags=re.I)
    return clean(re.sub(r"\s+([,.;:])", r"\1", text))


def hidden_key(key):
    low = clean(key).lower()
    return "производител" in low or "артикул" in low or low == "sku" or low.startswith("арт.")


def numeric_price(value):
    try:
        value = int(round(float(value)))
    except (TypeError, ValueError):
        return None
    return value if value >= MIN_FURNITURE_PRICE else None


def repair_prices(product):
    variants = product.get("variants") or []
    valid_all = [numeric_price(v.get("price")) for v in variants]
    valid_all = [x for x in valid_all if x]
    base = numeric_price(product.get("price"))
    if not base:
        base = min(valid_all) if valid_all else None
    product["price"] = base
    repaired = 0

    for variant in variants:
        if numeric_price(variant.get("price")):
            continue
        same_size = []
        for other in variants:
            if clean(other.get("size")) != clean(variant.get("size")):
                continue
            price = numeric_price(other.get("price"))
            if price:
                same_size.append(price)
        fallback = min(same_size) if same_size else base
        if not fallback and valid_all:
            fallback = min(valid_all)
        variant["price"] = fallback
        repaired += 1
    return repaired


def sanitize_furniture_product(product):
    is_bed = product.get("category") == "beds"
    product.pop("brand", None)
    product.pop("article", None)
    product.pop("sku", None)

    for field in ("title", "description", "summary"):
        product[field] = clean_public_text(product.get(field), is_bed=is_bed)

    specs = {}
    for key, value in (product.get("specs") or {}).items():
        if hidden_key(key):
            continue
        if is_bed and clean(key).lower() == "материал фасада":
            value = "Велюр"
        specs[clean(key)] = clean_public_text(value, is_bed=is_bed)
    product["specs"] = specs

    color_images = {}
    for label, url in (product.get("colorImages") or {}).items():
        label = clean(label)
        if label.lower().replace("ё", "е") in {"", "цвет", "фасада", "корпуса", "обивки", "ткани"}:
            continue
        if url:
            color_images[label] = url
    product["colorImages"] = color_images
    color_aliases = {color_key(label): label for label in color_images}

    for variant in product.get("variants") or []:
        variant.pop("availability", None)
        variant.pop("article", None)
        variant.pop("sku", None)
        key = color_key(variant.get("color"))
        if key in color_aliases:
            variant["color"] = color_aliases[key]
        attrs = {}
        for attr, value in (variant.get("attributes") or {}).items():
            if hidden_key(attr):
                continue
            if is_bed and clean(attr).lower() == "материал фасада":
                value = "Велюр"
            attrs[clean(attr)] = clean_public_text(value, is_bed=is_bed)
        variant["attributes"] = attrs

    repaired = repair_prices(product)

    # When Berhouse provides a dedicated photograph for a color, expose exactly
    # those color names. This prevents a selectable swatch from opening a photo
    # belonging to a different shade. Products without such mapping keep their
    # ordinary variant colors.
    if color_images:
        product["colors"] = list(color_images.keys())
    else:
        colors = []
        for variant in product.get("variants") or []:
            color = clean(variant.get("color"))
            if color and color not in colors:
                colors.append(color)
        product["colors"] = colors

    images = list(product.get("images") or [])
    for url in color_images.values():
        if url not in images:
            images.append(url)
    product["images"] = images
    return repaired


def sanitize_furniture():
    data = json.loads(FURNITURE.read_text(encoding="utf-8"))
    repaired = 0
    for group in ("beds", "sofas"):
        for product in data.get(group, []):
            repaired += sanitize_furniture_product(product)
    FURNITURE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return data, repaired


def sanitize_mattresses():
    removed = 0
    for path in MATTRESS_FILES:
        data = json.loads(path.read_text(encoding="utf-8"))
        for product in data:
            for key in list(product.keys()):
                if key.lower() in {"article", "sku", "артикул"}:
                    product.pop(key, None)
                    removed += 1
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return removed


def validate(data):
    serialized = json.dumps(data, ensure_ascii=False).lower()
    forbidden = ["склад поставщика", '"производитель"']
    for phrase in forbidden:
        if phrase in serialized:
            raise SystemExit(f"Forbidden public catalog text remains: {phrase}")

    bad_prices = []
    products = list(data.get("beds", [])) + list(data.get("sofas", []))
    for product in products:
        if not numeric_price(product.get("price")):
            bad_prices.append((product.get("title"), "base", product.get("price")))
        for variant in product.get("variants") or []:
            if not numeric_price(variant.get("price")):
                bad_prices.append((product.get("title"), variant.get("size"), variant.get("price")))
    if bad_prices:
        raise SystemExit(f"Invalid furniture prices remain: {bad_prices[:10]}")

    for product in data.get("beds", []):
        text = json.dumps(product, ensure_ascii=False).lower()
        if "искусственная кожа" in text or "экокожа" in text or "кожзам" in text:
            raise SystemExit(f"Artificial leather text remains in bed: {product.get('title')}")
        for key, value in (product.get("specs") or {}).items():
            if clean(key).lower() == "материал фасада" and clean(value).lower() != "велюр":
                raise SystemExit(f"Wrong bed facade material: {product.get('title')} -> {value}")
        for variant in product.get("variants") or []:
            for key, value in (variant.get("attributes") or {}).items():
                if clean(key).lower() == "материал фасада" and clean(value).lower() != "велюр":
                    raise SystemExit(f"Wrong variant facade material: {product.get('title')} -> {value}")

    sample = next((p for p in products if str(p.get("sourceId")) == "24190"), None)
    if sample:
        mapping = sample.get("colorImages") or {}
        expected = {
            "Белый": "24190_420791.jpg",
            "Бирюзовый": "24190_420796.jpg",
            "Серый": "24190_420789.jpg",
            "Темно серый": "24190_420790.jpg",
        }
        for color, ending in expected.items():
            if color not in mapping or not str(mapping[color]).endswith(ending):
                raise SystemExit(f"Incorrect color mapping for {color}: {mapping.get(color)}")
        burgundy = mapping.get("Бордовый") or mapping.get("Бордо")
        if not burgundy or not str(burgundy).endswith("24190_420792.jpg"):
            raise SystemExit(f"Incorrect burgundy mapping: {burgundy}")

    for path in MATTRESS_FILES:
        data_m = json.loads(path.read_text(encoding="utf-8"))
        if any(any(k.lower() in {"article", "sku", "артикул"} for k in p) for p in data_m):
            raise SystemExit(f"Article/SKU remains in {path}")


def main():
    data, repaired = sanitize_furniture()
    removed = sanitize_mattresses()
    validate(data)
    mapped = sum(bool(p.get("colorImages")) for p in data.get("beds", []) + data.get("sofas", []))
    print(f"Sanitized NOKTENA catalog: repaired prices={repaired}, removed mattress article fields={removed}, color-mapped products={mapped}")


if __name__ == "__main__":
    main()
