#!/usr/bin/env python3
import json, re, sys, time
from pathlib import Path
from urllib.parse import urljoin, urlparse, parse_qs

import requests
from bs4 import BeautifulSoup

BASE = "https://m.berhouse.ru"
CATEGORY_SOURCES = {
    "beds": [f"{BASE}/eshop/category/43/", f"{BASE}/eshop/filter/43/?sort=pricea"],
    "sofas_corner": [f"{BASE}/eshop/category/110/", f"{BASE}/eshop/filter/110/?sort=pricea"],
    "sofas_straight": [f"{BASE}/eshop/category/114/", f"{BASE}/eshop/filter/114/?sort=pricea"],
}

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (compatible; NoktenaCatalogSync/2.0; +https://noktena.ru/)",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.6",
})

MONEY_RE = re.compile(r"(?<!\d)(\d[\d\s\u00a0]{2,})\s*(?:р\.?|руб\.?|₽)", re.I)
ITEM_RE = re.compile(r"/eshop/item/(\d+)/?")
KNOWN_LABELS = [
    "Ширина", "Глубина", "Высота", "Размер", "Габаритные размеры", "Вес",
    "Бельевой ящик", "Количество спальных мест", "Спальное место", "Подъёмный механизм",
    "Кроватное основание", "Мягкое изголовье", "Материал фасада", "Материал корпуса",
    "Цвет фасада", "Цвет корпуса", "Тип", "Производитель", "Механизм трансформации",
    "Наполнение", "Наполнитель", "Пружинный блок", "Материал обивки", "Ткань",
    "Подлокотники", "Угол", "Ящик для белья", "Максимальная нагрузка", "Стиль",
    "Форма", "Количество мест", "Высота сиденья", "Глубина сиденья", "Ширина сиденья"
]
UI_LINES = {
    "характеристики", "наличие на складах", "вопросы и ответы", "отзывы", "задать вопрос",
    "написать отзыв", "условия доставки", "добавить в список желаний", "нашли дешевле?",
    "предложим цену лучше!", "гарантия", "поддержка", "кредит", "вернуться к каталогу"
}


def get(url, timeout=35):
    r = session.get(url, timeout=timeout, allow_redirects=True)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or r.encoding
    return r


def clean(s):
    return re.sub(r"\s+", " ", (s or "").replace("\xa0", " ")).strip()


def price_int(text):
    if not text:
        return None
    m = MONEY_RE.search(text)
    if not m:
        return None
    digits = re.sub(r"\D", "", m.group(1))
    return int(digits) if digits else None


def listing_pages(start_url):
    pages = {start_url}
    queue = [start_url]
    seen = set()
    while queue and len(pages) < 20:
        url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        try:
            r = get(url)
        except Exception as e:
            print(f"WARN listing {url}: {e}", file=sys.stderr)
            continue
        soup = BeautifulSoup(r.text, "html.parser")
        for a in soup.find_all("a", href=True):
            href = urljoin(r.url, a["href"])
            if "page=" not in href or "/eshop/" not in href:
                continue
            q = parse_qs(urlparse(href).query)
            try:
                p = int(q.get("page", ["0"])[0])
            except Exception:
                continue
            if 1 <= p <= 30 and href not in pages:
                pages.add(href)
                queue.append(href)
    return sorted(pages)


def discover_products(source_urls):
    urls = set()
    used_pages = []
    for src in source_urls:
        try:
            pages = listing_pages(src)
        except Exception:
            pages = [src]
        for page in pages:
            try:
                r = get(page)
            except Exception as e:
                print(f"WARN page {page}: {e}", file=sys.stderr)
                continue
            used_pages.append(r.url)
            soup = BeautifulSoup(r.text, "html.parser")
            for a in soup.find_all("a", href=True):
                href = urljoin(r.url, a["href"])
                m = ITEM_RE.search(href)
                if m:
                    urls.add(f"{BASE}/eshop/item/{m.group(1)}/")
    return sorted(urls), sorted(set(used_pages))


def parse_jsonld_price(soup):
    for s in soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            obj = json.loads(s.get_text(strip=True))
        except Exception:
            continue
        stack = obj if isinstance(obj, list) else [obj]
        for x in stack:
            if not isinstance(x, dict):
                continue
            offers = x.get("offers")
            if isinstance(offers, dict):
                v = offers.get("price") or offers.get("lowPrice")
                try:
                    return int(round(float(str(v).replace(" ", "").replace(",", "."))))
                except Exception:
                    pass
    return None


def parse_price(soup, text):
    p = parse_jsonld_price(soup)
    if p:
        return p
    for sel in ["[itemprop='price']", ".price", ".item-price", ".product-price", ".shop2-product-price", ".price__new"]:
        for el in soup.select(sel):
            raw = el.get("content") or el.get_text(" ", strip=True)
            p = price_int(raw)
            if p:
                return p
            try:
                v = int(re.sub(r"\D", "", str(raw)))
                if v >= 1000:
                    return v
            except Exception:
                pass
    values = [int(re.sub(r"\D", "", m.group(1))) for m in MONEY_RE.finditer(text)]
    values = [v for v in values if 1000 <= v <= 2000000]
    return values[0] if values else None


def image_urls(soup, page_url, title, product_id):
    found = []
    title_low = title.lower()

    def add(raw, score=0):
        if not raw or str(raw).startswith("data:"):
            return
        raw = str(raw).split(",")[0].strip().split(" ")[0]
        u = urljoin(page_url, raw)
        low = u.lower()
        if any(x in low for x in ["logo", "favicon", "icon", "sprite", "counter", "pixel", "captcha", "banner", "texture"]):
            return
        if not re.search(r"\.(?:jpe?g|png|webp)(?:\?|$)", low):
            return
        if u not in [x[1] for x in found]:
            found.append((score, u))

    og = soup.find("meta", attrs={"property": "og:image"})
    if og:
        add(og.get("content"), 100)
    for img in soup.find_all("img"):
        alt = clean(img.get("alt")).lower()
        srcs = [img.get(k) for k in ["src", "data-src", "data-original", "data-lazy", "data-srcset", "srcset", "data-image", "data-zoom", "data-large"]]
        score = 0
        if title_low and alt and (title_low[:20] in alt or alt[:20] in title_low):
            score += 70
        parent = img.parent
        cls = " ".join(img.get("class", [])) + " " + (" ".join(parent.get("class", [])) if parent else "")
        if re.search(r"product|item|gallery|photo|image|slider|thumb", cls, re.I):
            score += 35
        for raw in srcs:
            if raw and product_id in str(raw):
                score += 25
            add(raw, score)
        if parent and getattr(parent, "name", None) == "a":
            href = parent.get("href")
            if href and product_id in href:
                add(href, score + 20)
    for a in soup.find_all("a", href=True):
        href = a.get("href")
        if re.search(r"\.(?:jpe?g|png|webp)(?:\?|$)", href or "", re.I) and (product_id in (href or "") or "/files/eshop/" in (href or "")):
            add(href, 40)
    found.sort(key=lambda x: (-x[0], x[1]))
    urls = [u for _, u in found]
    big = [u for u in urls if "/files/eshop/big/" in u.lower()]
    return (big if big else urls)[:30]


def visible_lines(soup):
    return [clean(x) for x in soup.get_text("\n", strip=True).splitlines() if clean(x)]


def parse_specs(soup, lines):
    specs = {}
    for tr in soup.find_all("tr"):
        cells = [clean(c.get_text(" ", strip=True)) for c in tr.find_all(["th", "td"])]
        if len(cells) >= 2 and 0 < len(cells[0]) <= 70 and cells[1]:
            specs.setdefault(cells[0].rstrip(":"), cells[1])
    for dl in soup.find_all("dl"):
        dts, dds = dl.find_all("dt"), dl.find_all("dd")
        for dt, dd in zip(dts, dds):
            k, v = clean(dt.get_text(" ", strip=True)).rstrip(":"), clean(dd.get_text(" ", strip=True))
            if k and v:
                specs.setdefault(k, v)

    joined = "\n".join(lines)
    for label in KNOWN_LABELS:
        if any(k.lower() == label.lower() for k in specs):
            continue
        m = re.search(rf"(?:^|\n){re.escape(label)}\s*:?\s*\n?([^\n]{{1,180}})", joined, re.I)
        if m:
            v = clean(m.group(1))
            if v and v.lower() != label.lower() and v.lower() not in UI_LINES:
                specs[label] = v

    out = {}
    for k, v in specs.items():
        k, v = clean(k).rstrip(":"), clean(v)
        if not k or not v or len(k) > 80 or len(v) > 220:
            continue
        if k.lower() in UI_LINES:
            continue
        out[k] = v
        if len(out) >= 24:
            break
    return out


def parse_description(soup, lines, title):
    selectors = [
        "[itemprop='description']", ".product-description", ".item-description", ".shop2-product-desc",
        ".description", ".text-description", ".goods-description"
    ]
    candidates = []
    for sel in selectors:
        for el in soup.select(sel):
            txt = clean(el.get_text("\n", strip=True))
            if 80 <= len(txt) <= 6000 and title.lower() not in txt.lower()[: max(10, len(title) // 2)]:
                candidates.append(txt)
    if candidates:
        candidates.sort(key=len, reverse=True)
        return candidates[0]

    try:
        start = next(i for i, x in enumerate(lines) if x.lower() == "характеристики")
    except StopIteration:
        start = 0
    end = len(lines)
    for i in range(start + 1, len(lines)):
        x = lines[i]
        if title and title.lower() in x.lower() and ("цвет" in x.lower() or "размер:" in x.lower() or "спальное место:" in x.lower()):
            end = i
            break
    block = lines[start + 1:end]
    first = None
    for i, x in enumerate(block):
        low = x.lower()
        if len(x) >= 42 and low not in UI_LINES and not MONEY_RE.search(x) and not any(low == k.lower() for k in KNOWN_LABELS):
            if any(ch in x for ch in ".!;:") or len(x) >= 70:
                first = i
                break
    if first is None:
        return ""
    cleaned = []
    for x in block[first:]:
        low = x.lower()
        if low in UI_LINES or low.startswith("наличие:") or MONEY_RE.fullmatch(x):
            continue
        if title and title.lower() in low and ("цвет" in low or "размер:" in low):
            break
        cleaned.append(x)
    text = "\n".join(cleaned).strip()
    return text[:6000]


def parse_attributes(text):
    attrs = {}
    for part in re.split(r";\s*", text or ""):
        if ":" not in part:
            continue
        k, v = part.split(":", 1)
        k, v = clean(k), clean(v)
        if 1 <= len(k) <= 60 and v:
            attrs[k] = v
    return attrs


def parse_variants(lines, title, base_price):
    variants = []
    seen = set()
    title_low = title.lower()
    for i, line in enumerate(lines):
        low = line.lower()
        if title_low not in low:
            continue
        if not any(marker in low for marker in ["цвет фасада:", "цвет корпуса:", "размер:", "спальное место:", "материал фасада:"]):
            continue
        tail = line[low.find(title_low) + len(title):].strip(" :-")
        attrs = parse_attributes(tail)
        if not attrs:
            continue
        price = None
        availability = ""
        for nxt in lines[i + 1:i + 6]:
            if nxt.lower().startswith("наличие:"):
                availability = clean(nxt.split(":", 1)[1])
            if price is None:
                price = price_int(nxt)
        color = attrs.get("Цвет фасада") or attrs.get("Цвет") or attrs.get("Цвет корпуса") or ""
        size = attrs.get("Спальное место") or attrs.get("Размер") or ""
        key = (color.lower(), size.lower(), int(price or base_price or 0))
        if key in seen:
            continue
        seen.add(key)
        variants.append({
            "color": color,
            "size": size,
            "price": price or base_price,
            "available": bool(availability) and "нет" not in availability.lower(),
            "availability": availability,
            "attributes": attrs,
        })
    return variants


def unique_values(items, key):
    out = []
    seen = set()
    for item in items:
        value = clean(item.get(key))
        if not value or value.lower() in seen:
            continue
        seen.add(value.lower())
        out.append(value)
    return out


def make_summary(description, fallback):
    text = clean(description)
    if not text:
        return fallback
    sentence = re.split(r"(?<=[.!?])\s+", text)[0]
    return sentence[:240].rstrip()


def parse_product(url, group):
    r = get(url)
    soup = BeautifulSoup(r.text, "html.parser")
    h1 = soup.find("h1")
    title = clean(h1.get_text(" ", strip=True) if h1 else "")
    if not title:
        title = clean(soup.title.get_text(" ", strip=True) if soup.title else "Товар")
    lines = visible_lines(soup)
    full_text = clean(soup.get_text(" ", strip=True))
    pidm = ITEM_RE.search(r.url)
    pid = pidm.group(1) if pidm else re.sub(r"\D", "", r.url)[-8:]
    price = parse_price(soup, full_text)
    imgs = image_urls(soup, r.url, title, pid)
    specs = parse_specs(soup, lines)
    description = parse_description(soup, lines, title)
    variants = parse_variants(lines, title, price)
    colors = unique_values(variants, "color")
    sizes = unique_values(variants, "size")
    category = "beds" if group == "beds" else "sofas"
    subtype = "" if group == "beds" else ("Угловой" if group == "sofas_corner" else "Прямой")
    fallback = (
        "Кровать для комфортного сна. Доступные размеры, цвета и комплектацию можно выбрать в карточке товара."
        if category == "beds" else
        f"{subtype or 'Мягкий'} диван для ежедневного отдыха. Доступные варианты представлены в карточке товара."
    )
    hit = "хит продаж" in full_text.lower()
    available = "в наличии" in full_text.lower()
    return {
        "id": f"berhouse-{pid}",
        "sourceId": pid,
        "category": category,
        "subtype": subtype,
        "title": title,
        "price": price,
        "images": imgs,
        "specs": specs,
        "description": description or fallback,
        "summary": make_summary(description, fallback),
        "variants": variants,
        "colors": colors,
        "sizes": sizes,
        "hit": hit,
        "available": available,
        "sourceUrl": r.url,
        "brand": "Berhouse"
    }


def main():
    result = {
        "source": BASE,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "beds": [],
        "sofas": [],
        "debug": {"pages": {}, "counts": {}}
    }
    seen = set()
    for group, sources in CATEGORY_SOURCES.items():
        urls, pages = discover_products(sources)
        result["debug"]["pages"][group] = pages
        result["debug"]["counts"][group] = len(urls)
        print(f"{group}: {len(urls)} products from {len(pages)} pages")
        for i, url in enumerate(urls, 1):
            if url in seen:
                continue
            try:
                p = parse_product(url, group)
                target = "beds" if p["category"] == "beds" else "sofas"
                result[target].append(p)
                seen.add(url)
                print(f"  [{i}/{len(urls)}] {p['title']} | {p['price']} | {len(p['images'])} photos | {len(p['variants'])} variants")
                time.sleep(0.05)
            except Exception as e:
                print(f"WARN product {url}: {e}", file=sys.stderr)
    for key in ["beds", "sofas"]:
        result[key].sort(key=lambda x: (x.get("price") is None, x.get("price") or 10**12, x.get("title", "")))
    out = Path("data/furniture.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {out}: beds={len(result['beds'])}, sofas={len(result['sofas'])}")
    if not result["beds"] and not result["sofas"]:
        raise SystemExit("No products imported")

if __name__ == "__main__":
    main()
