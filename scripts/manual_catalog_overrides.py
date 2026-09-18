#!/usr/bin/env python3
import json
import re
from pathlib import Path

FURNITURE = Path("data/furniture.json")
DESCRIPTION = (
    "Современный прямой диван, который легко превращается в просторное спальное место. "
    "Каркас выполнен из бруса и ДСП. В качестве наполнителя используется пенополиуретан "
    "плотностью 22–25 кг/м³ — износостойкий материал, рассчитанный на ежедневную эксплуатацию. "
    "Обивка из микророгожки отличается прочностью, устойчивостью к усадке и простотой в уходе. "
    "В основании расположен вместительный ящик для белья. Механизм трансформации — «еврокнижка». "
    "Спальное место — 1800×1300 мм. Упаковка состоит из трёх защитных слоёв: ПВХ-рукав, картон и стрейч-плёнка."
)
SUMMARY = "Современный прямой диван, который легко превращается в просторное спальное место."
SLEEPING_PLACE = "1800×1300 мм"
DIMENSIONS = "1340×1100×750 мм"
MECHANISM = "Еврокнижка"


def clean(value):
    return re.sub(r"\s+", " ", str(value or "").replace("\xa0", " ")).strip()


def norm(value):
    return clean(value).lower().replace("ё", "е")


def is_lodzhia_transformer(product):
    title = norm(product.get("title"))
    title = title.replace('«', '').replace('»', '').replace('"', '')
    return "диван трансформер" in title and "лоджия" in title


def set_spec(specs, names, label, value):
    key = next((k for k in specs if norm(k) in names), label)
    specs[key] = value


def main():
    data = json.loads(FURNITURE.read_text(encoding="utf-8"))
    product = next((p for p in data.get("sofas", []) if is_lodzhia_transformer(p)), None)
    if not product:
        raise SystemExit('Target sofa not found: Диван трансформер «Лоджия»')

    product["summary"] = SUMMARY
    product["description"] = DESCRIPTION

    specs = dict(product.get("specs") or {})
    set_spec(specs, {"спальное место"}, "Спальное место", SLEEPING_PLACE)
    set_spec(specs, {"размер", "размеры"}, "Размеры", DIMENSIONS)
    set_spec(specs, {"механизм трансформации"}, "Механизм трансформации", MECHANISM)
    product["specs"] = specs

    for variant in product.get("variants") or []:
        attrs = dict(variant.get("attributes") or {})
        for key in list(attrs):
            key_norm = norm(key)
            if key_norm == "спальное место":
                attrs[key] = SLEEPING_PLACE
            elif key_norm in {"размер", "размеры"}:
                attrs[key] = DIMENSIONS
            elif key_norm == "механизм трансформации":
                attrs[key] = MECHANISM
        variant["attributes"] = attrs

    FURNITURE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    check = json.loads(FURNITURE.read_text(encoding="utf-8"))
    saved = next((p for p in check.get("sofas", []) if is_lodzhia_transformer(p)), None)
    if not saved or saved.get("description") != DESCRIPTION:
        raise SystemExit("Lodzhia description override was not saved")
    if clean((saved.get("specs") or {}).get("Спальное место")) != SLEEPING_PLACE and not any(
        norm(k) == "спальное место" and clean(v) == SLEEPING_PLACE for k, v in (saved.get("specs") or {}).items()
    ):
        raise SystemExit("Lodzhia sleeping place override was not saved")

    print('Applied manual override: Диван трансформер «Лоджия»')


if __name__ == "__main__":
    main()
