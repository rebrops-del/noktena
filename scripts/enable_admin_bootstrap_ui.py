from pathlib import Path

path = Path('admin/index.html')
text = path.read_text(encoding='utf-8')
old = '<script src="../assets/admin-config.js?v=20260919-1"></script>\n<script src="admin.js?v=20260919-1"></script>'
new = '<script src="../assets/admin-config.js?v=20260919-1"></script>\n<script src="bootstrap-ui.js?v=20260919-1"></script>\n<script src="admin.js?v=20260919-1"></script>'
if new in text:
    print('Bootstrap UI already enabled')
elif old in text:
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    print('Bootstrap UI enabled')
else:
    raise SystemExit('Admin script marker not found')
