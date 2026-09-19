from pathlib import Path

changes = {
    Path('index.html'): [
        (
            "fetch(f+'?v=20260918-quality1',{cache:'no-store'})",
            "fetch(f+'?v=20260919-cache1',{cache:'force-cache'})",
        ),
    ],
    Path('assets/catalog-v2.js'): [
        (
            "fetch(`data/furniture.json?v=${Date.now()}`,{cache:'no-store'})",
            "fetch('data/furniture.json?v=20260919-cache1',{cache:'force-cache'})",
        ),
    ],
}

for path, replacements in changes.items():
    text = path.read_text(encoding='utf-8')
    for old, new in replacements:
        if old not in text:
            raise SystemExit(f'target not found in {path}: {old}')
        text = text.replace(old, new, 1)
    path.write_text(text, encoding='utf-8')
    print(f'optimized {path}')
