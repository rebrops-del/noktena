from pathlib import Path

path = Path('index.html')
s = path.read_text(encoding='utf-8')

replacements = [
    (
        '<span>Екатеринбургский филиал · региональный склад: г. Берёзовский</span>',
        '<span>Екатеринбург · склад: г. Берёзовский · <a href="mailto:noktena@mail.ru">noktena@mail.ru</a> · <a href="tel:+79321207635">+7 (932) 120-76-35</a></span>'
    ),
    ('Написать на Авито', 'Написать в MAX'),
    ('Получить консультацию на Авито', 'Написать в MAX'),
    (
        '<span class="avito-dots" aria-hidden="true"><i></i><i></i><i></i><i></i></span>',
        ''
    ),
    (
        'Подбор модели и оформление заказа доступны через Avito.',
        'Для консультации и оформления заказа напишите на <a href="mailto:noktena@mail.ru">noktena@mail.ru</a>, позвоните <a href="tel:+79321207635">+7 (932) 120-76-35</a> или свяжитесь с нами в MAX.'
    ),
    (
        'Напишите на Avito ваш размер, примерный вес, желаемую жёсткость и бюджет — подберём подходящие варианты.',
        'Напишите на <a href="mailto:noktena@mail.ru">noktena@mail.ru</a> или позвоните <a href="tel:+79321207635">+7 (932) 120-76-35</a>. Также можно написать в MAX — подберём подходящие варианты.'
    ),
    (
        'Екатеринбургский филиал · региональный склад: г. Берёзовский · консультация и заказ через Avito',
        'Екатеринбургский филиал · склад: г. Берёзовский · <a href="mailto:noktena@mail.ru">noktena@mail.ru</a> · <a href="tel:+79321207635">+7 (932) 120-76-35</a> · MAX'
    ),
    (
        "const AVITO='https://www.avito.ru/brands/3f268860d3869763b359a5d794f4f58c';",
        "const AVITO='https://max.ru/u/f9LHodD0cOKZqie3BJvn11xgsNvxJK_kFOqYtKyFuZ2uMitoxZIwNaH8-NY';"
    ),
]

for old, new in replacements:
    if old not in s:
        raise SystemExit(f'Expected text not found: {old[:120]}')
    s = s.replace(old, new)

extra_css = '''
/* direct-contacts-max-v1 */
.top a{color:#fff;text-decoration:none;font-weight:800}.top a:hover{text-decoration:underline}
.networkbox a,.cta a:not(.btn),.footer a{color:inherit;font-weight:900;text-decoration:underline;text-underline-offset:2px}
.btn.avito::after{display:none!important;content:none!important}
.avito-dots{display:none!important}
'''
if '/* direct-contacts-max-v1 */' not in s:
    s = s.replace('</style>', extra_css + '\n</style>', 1)

path.write_text(s, encoding='utf-8')
