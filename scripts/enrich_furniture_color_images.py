#!/usr/bin/env python3
import json
import re
import time
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

DATA_PATH = Path("data/furniture.json")
BASE = "https://m.berhouse.ru"
MAX_BRANCHES = 30
MAX_COLOR_OPTIONS = 60

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (compatible; NoktenaCatalogSync/3.0; +https://noktena.ru/)",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.6",
    "X-Requested-With": "XMLHttpRequest",
})


def clean(value):
    return re.sub(r"\s+", " ", str(value or "").replace("\xa0", " ")).strip()


def norm(value):
    return re.sub(r"[^a-zа-я0-9]+", "", clean(value).lower().replace("ё", "е"))


def is_size_caption(caption):
    low = clean(caption).lower().replace("ё", "е")
    return any(x in low for x in ["спальное место", "размер", "ширина", "длина"])


def caption_before(node):
    prev = node.find_previous_sibling(class_="caption")
    return clean(prev.get_text(" ", strip=True) if prev else "")


def parse_controls(block):
    controls = []
    if not block:
        return controls
    for node in block.select(".attribute_select, .list"):
        caption = caption_before(node)
        classes = node.get("class") or []
        if "attribute_select" in classes:
            select = node.find("select")
            if not select or not select.get("name"):
                continue
            options = []
            for option in select.find_all("option"):
                value = clean(option.get("value"))
                if not value:
                    continue
                options.append({
                    "value": value,
                    "label": clean(option.get_text(" ", strip=True)),
                    "selected": option.has_attr("selected"),
                })
            controls.append({"caption": caption, "name": select.get("name"), "kind": "select", "options": options})
        elif "list" in classes:
            hidden = node.find("input", {"type": "hidden"})
            if not hidden or not hidden.get("name"):
                continue
            active_value = clean(hidden.get("value"))
            options = []
            for anchor in node.find_all("a"):
                value = clean(anchor.get("data-value"))
                if not value:
                    continue
                image = anchor.find("img")
                label = clean(anchor.get("title") or anchor.get("aria-label") or (image.get("alt") if image else ""))
                options.append({"value": value, "label": label, "selected": value == active_value or "active" in (anchor.get("class") or [])})
            if not options and active_value:
                options = [{"value": active_value, "label": "", "selected": True}]
            controls.append({"caption": caption, "name": hidden.get("name"), "kind": "list", "options": options})
    return controls


def selected_label_from_block(block, control_name, value, known_label=""):
    for control in parse_controls(block):
        if control["name"] != control_name or "цвет" not in control["caption"].lower():
            continue
        for option in control["options"]:
            if option["value"] == str(value) and option["label"]:
                return option["label"]
        for option in control["options"]:
            if option["selected"] and option["label"]:
                return option["label"]
        caption = control["caption"]
        low = caption.lower().replace("ё", "е")
        prefixes = ["цвет фасада", "цвет корпуса", "цвет обивки", "цвет ткани", "цвет"]
        for prefix in prefixes:
            if low.startswith(prefix):
                rest = clean(caption[len(prefix):].lstrip(" :-"))
                if rest:
                    return rest
    return clean(known_label)


def post_combo(product_id, fields):
    files = {key: (None, str(value)) for key, value in fields.items()}
    try:
        response = session.post(f"{BASE}/eshop/getcombo/{product_id}", files=files, timeout=35)
        response.raise_for_status()
        return response.json()
    except Exception as exc:
        print(f"WARN combo {product_id} {fields}: {exc}")
        return None


def gallery_by_combination(soup, page_url):
    photos = {}
    for anchor in soup.select('.thumbs a[id^="color"]'):
        ident = clean(anchor.get("id"))
        href = anchor.get("href")
        if not ident.startswith("color") or not href:
            continue
        key = ident[5:]
        if key and key != "0":
            photos[key] = urljoin(page_url, href)
    return photos


def color_images_for_product(product):
    source_url = product.get("sourceUrl") or f"{BASE}/eshop/item/{product.get('sourceId', '')}/"
    product_id = clean(product.get("sourceId"))
    if not product_id:
        return {}
    try:
        response = session.get(source_url, timeout=35)
        response.raise_for_status()
    except Exception as exc:
        print(f"WARN page {product_id}: {exc}")
        return {}

    soup = BeautifulSoup(response.text, "html.parser")
    photos = gallery_by_combination(soup, response.url)
    block = soup.select_one("#cobmos")
    if not block or not photos:
        return {}

    mapping = {}
    branch_counter = [0]
    seen_states = set()

    def explore(fields, current_block):
        if branch_counter[0] >= MAX_BRANCHES:
            return
        controls = parse_controls(current_block)
        color_index = next((i for i, control in enumerate(controls) if "цвет" in control["caption"].lower()), None)
        if color_index is None:
            return

        preceding = controls[:color_index]
        pending = next((control for control in preceding if control["name"] not in fields), None)
        if pending:
            options = pending["options"]
            if not options:
                return
            if is_size_caption(pending["caption"]):
                selected = next((option for option in options if option["selected"]), options[0])
                options = [selected]
            else:
                options = options[:MAX_BRANCHES]
            for option in options:
                if branch_counter[0] >= MAX_BRANCHES:
                    break
                next_fields = dict(fields)
                next_fields[pending["name"]] = option["value"]
                state_key = tuple(sorted(next_fields.items()))
                if state_key in seen_states:
                    continue
                seen_states.add(state_key)
                branch_counter[0] += 1
                data = post_combo(product_id, next_fields)
                if not data:
                    continue
                html = data.get("cominationsBlock") or str(current_block)
                explore(next_fields, BeautifulSoup(html, "html.parser"))
            return

        color_control = controls[color_index]
        options = color_control["options"][:MAX_COLOR_OPTIONS]
        for option in options:
            fields_with_color = dict(fields)
            fields_with_color[color_control["name"]] = option["value"]
            data = post_combo(product_id, fields_with_color)
            if not data:
                continue
            combination_id = data.get("combinationId")
            if combination_id is False or combination_id is None:
                continue
            combination_id = str(combination_id)
            photo = photos.get(combination_id)
            if not photo:
                continue
            returned_block = BeautifulSoup(data.get("cominationsBlock") or "", "html.parser")
            label = selected_label_from_block(returned_block, color_control["name"], option["value"], option["label"])
            if not label:
                continue
            mapping.setdefault(label, photo)
            time.sleep(0.015)

    explore({}, block)

    # Preserve aliases already used in NOKTENA data, even if punctuation/case differs.
    normalized = {norm(label): photo for label, photo in mapping.items() if norm(label)}
    for color in product.get("colors") or []:
        key = norm(color)
        if key in normalized:
            mapping.setdefault(clean(color), normalized[key])
    return mapping


def unique(values):
    result = []
    seen = set()
    for value in values:
        value = clean(value)
        key = norm(value)
        if not value or not key or key in seen:
            continue
        seen.add(key)
        result.append(value)
    return result


def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    products = list(data.get("beds", [])) + list(data.get("sofas", []))
    products_with_colors = 0
    mapped_products = 0
    mapped_colors = 0

    for index, product in enumerate(products, 1):
        existing_colors = unique(product.get("colors") or [v.get("color") for v in product.get("variants", [])])
        mapping = color_images_for_product(product)
        if existing_colors or mapping:
            products_with_colors += 1
        if mapping:
            product["colorImages"] = mapping
            product["colors"] = unique(existing_colors + list(mapping.keys()))
            mapped_products += 1
            mapped_colors += len(mapping)
            print(f"[{index}/{len(products)}] {product.get('title')} -> {len(mapping)} color photos")
        else:
            product.pop("colorImages", None)
            if existing_colors:
                product["colors"] = existing_colors
            print(f"[{index}/{len(products)}] {product.get('title')} -> no color photo mapping")
        time.sleep(0.025)

    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Products: {len(products)}; with colors: {products_with_colors}; mapped products: {mapped_products}; mapped colors: {mapped_colors}")


if __name__ == "__main__":
    main()
