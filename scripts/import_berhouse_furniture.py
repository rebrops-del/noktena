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
    "User-Agent": "Mozilla/5.0 (compatible; NoktenaCatalogSync/1.0; +https://noktena.ru/)",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.6",
})

MONEY_RE = re.compile(r"(?<!\d)(\d[\d\s\u00a0]{2,})\s*(?:р\.?|руб\.?|₽)", re.I)
ITEM_RE = re.compile(r"/eshop/item/(\d+)/?")
KNOWN_LABELS = [
    "Ширина", "Глубина", "Высота", "Бельевой ящик", "Количество спальных мест",
    "Спальное место", "Подъёмный механизм", "Кроватное основание", "Мягкое изголовье",
    "Материал фасада", "Цвет фасада", "Тип", "Производитель"
]

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
            if "page=" not in href:
                continue
            if "/eshop/" not in href:
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
        if not raw or raw.startswith("data:"):
            return
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
        if title_low and (title_low[:20] in alt or alt[:20] in title_low): score += 70
        parent = img.parent
        cls = " ".join(img.get("class", [])) + " " + (" ".join(parent.get("class", [])) if parent else "")
        if re.search(r"product|item|gallery|photo|image|slider|thumb", cls, re.I): score += 35
        for raw in srcs:
            if raw and "," in raw and " " in raw:
                raw = raw.split(",")[0].strip().split(" ")[0]
            if raw and product_id in raw: score += 25
            add(raw, score)
        if parent and getattr(parent, "name", None) == "a":
            href = parent.get("href")
            if href and product_id in href:
                add(href, score + 20)
    for a in soup.find_all("a", href=True):
        href = a.get("href")
        if re.search(r"\.(?:jpe?g|png|webp)(?:\?|$)", href, re.I) and (product_id in href or "/files/eshop/" in href):
            add(href, 40)
    found.sort(key=lambda x: (-x[0], x[1]))
    urls = [u for _, u in found]
    big = [u for u in urls if "/files/eshop/big/" in u.lower()]
    return (big if big else urls)[:30]


def parse_specs(soup, full_text):
    specs = {}
    for tr in soup.find_all("tr"):
        cells = [clean(c.get_text(" ", strip=True)) for c in tr.find_all(["th", "td"])]
        if len(cells) >= 2 and 0 < len(cells[0]) <= 60 and cells[1]:
            specs.setdefault(cells[0].rstrip(":"), cells[1])
    for dl in soup.find_all("dl"):
        dts, dds = dl.find_all("dt"), dl.find_all("dd")
        for dt, dd in zip(dts, dds):
            k, v = clean(dt.get_text(" ", strip=True)).rstrip(":"), clean(dd.get_text(" ", strip=True))
            if k and v: specs.setdefault(k, v)
    # Known labels fallback from flattened text
    for label in KNOWN_LABELS:
        if any(k.lower() == label.lower() for k in specs):
            continue
        m = re.search(rf"{re.escape(label)}\s*:?\s*([^\n\r]{{1,80}})", soup.get_text("\n", strip=True), re.I)
        if m:
            v = clean(m.group(1))
            if v and v.lower() != label.lower():
                specs[label] = v
    # Keep only compact, useful values
    out = {}
    for k, v in specs.items():
        k, v = clean(k), clean(v)
        if not k or not v or len(k) > 70 or len(v) > 180:
            continue
        if k.lower() in {"характеристики", "наличие на складах", "вопросы и ответы", "отзывы"}:
            continue
        out[k] = v
        if len(out) >= 14:
            break
    return out


def parse_product(url, group):
    r = get(url)
    soup = BeautifulSoup(r.text, "html.parser")
    h1 = soup.find("h1")
    title = clean(h1.get_text(" ", strip=True) if h1 else "")
    if not title:
        title = clean((soup.title.get_text(" ", strip=True) if soup.title else "Товар"))
    full_text = clean(soup.get_text(" ", strip=True))
    pidm = ITEM_RE.search(r.url)
    pid = pidm.group(1) if pidm else re.sub(r"\D", "", r.url)[-8:]
    price = parse_price(soup, full_text)
    imgs = image_urls(soup, r.url, title, pid)
    specs = parse_specs(soup, full_text)
    category = "beds" if group == "beds" else "sofas"
    subtype = "" if group == "beds" else ("Угловой" if group == "sofas_corner" else "Прямой")
    description = (
        "Кровать Berhouse. В карточке собраны основные характеристики и доступные варианты. "
        "Цвет, комплектацию и спальное место уточняйте при оформлении заказа."
        if category == "beds" else
        f"{subtype or 'Мягкий'} диван Berhouse. В карточке собраны основные размеры и характеристики. "
        "Цвет и доступную комплектацию уточняйте при оформлении заказа."
    )
    return {
        "id": f"berhouse-{pid}",
        "sourceId": pid,
        "category": category,
        "subtype": subtype,
        "title": title,
        "price": price,
        "images": imgs,
        "specs": specs,
        "description": description,
        "hit": False,
        "available": "в наличии" in full_text.lower(),
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
                print(f"  [{i}/{len(urls)}] {p['title']} | {p['price']} | {len(p['images'])} images")
                time.sleep(0.08)
            except Exception as e:
                print(f"WARN product {url}: {e}", file=sys.stderr)
    # stable order by price then title
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
