# Отчёт о редизайне НОКТЕНЫ · 24.09.2026

## Что сделано

- Перестроена главная: новое фото, первый экран, три направления каталога, популярные товары, этапы заказа, помощь, FAQ и подвал.
- Единые токены цветов, типографики, отступов, доступного фокуса и адаптивных состояний; отдельные слои страниц над существующей логикой.
- Каталог и карточка приведены к спокойной визуальной иерархии; расширены галерея с увеличением, SEO и похожие товары. Старые цены и промо не появляются без данных товара или активной настройки.
- Корзина получила более понятный порядок полей, расчёта и сообщений об ошибке; серверный формат заказа не менялся.
- Актуальная `/admin/` получила боковое меню, сводку, современную форму входа, поиск/фильтр заказов, порядок фотографий и поля SEO. Действующая авторизация сохранена.
- Метрика `112921323`: цели сохранены, `PURCHASE` ограничен успешным ответом сервера и номером заказа; исключены повторы на дублированном ответе, `BEGIN_CHECKOUT` при перезагрузке и `ADD_TO_CART` из другой вкладки.
- Пять workflow ограничены `main` для предотвращения запуска действий на рабочем API при push ветки.

## Изменённые файлы

| Группа | Файлы |
| --- | --- |
| Страницы | `index.html`, `product.html`, `checkout.html` |
| Система и изображения | `assets/design-system.css`, `assets/storefront-2026.css`, `assets/product-2026.css`, `assets/checkout-2026.css`, `assets/noktena-editorial-bedroom.webp` |
| Клиентская логика | `assets/storefront-2026.js`, `assets/product-2026.js`, `assets/catalog-v2.js`, `assets/product-detail.js`, `assets/checkout.js`, `assets/mattress-card-settings-runtime.js`, `assets/global-discount-runtime.js`, `assets/global-promo-runtime.js`, `assets/yandex-analytics.js` |
| Админка | `admin/index.html`, `admin/admin.js`, `admin/orders.js`, `admin/admin-2026.css`, `admin/admin-shell-2026.js`, `admin/admin-enhancements.js`, `admin/admin-mattress-card-settings.js`, `admin/admin-card-settings.js`, `admin/global-promo-settings.js` |
| Проверки и документация | `tests/analytics.test.cjs`, `AUDIT.md`, `README.md`, `REDESIGN_REPORT.md` |
| Безопасность ветки | `.github/workflows/apply-mattress-card-settings.yml`, `.github/workflows/load-global-discount.yml`, `.github/workflows/test-admin-live.yml`, `.github/workflows/test-atelier-storefront.yml`, `.github/workflows/test-cart-services.yml` |

## Проверки

| Проверка | Результат |
| --- | --- |
| Синтаксис всех `assets/*.js` и `admin/*.js` | Пройден |
| Ссылки на локальные ресурсы, повторяющиеся HTML ID | Пройден |
| `node --test tests/analytics.test.cjs` | 3/3 пройдены: успешная покупка, ошибка заказа, корзина/другая вкладка, повторная загрузка checkout |
| Отдача HTML, CSS, JSON локальным HTTP | Пройдена |
| Закрытая версия Sites | Развёрнута без записи в рабочий API, получен первый скриншот главной |
| Покупка на рабочем backend, запись в админке | Не выполнялись без тестовой базы |
| Safari, Firefox, мобильные браузеры, Lighthouse | Требуют отдельного прогона в доступном окружении |

## Оставшиеся задачи перед выкладкой

- Проверить авторизованную админку с тестовой учётной записью и копией каталога.
- Проверить заказ от начала до конца на изолированном backend и события в отладчике Яндекс Метрики.
- Удалить из workflow `test-cart-services.yml` создание тестовых заказов в рабочей базе или перенаправить его на стенд перед слиянием в `main`.
- Отдельно согласовать платежные методы, если потребуется их сохранять в заказе: нынешний серверный контракт не предусматривает это поле.
