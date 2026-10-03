# 07: Спайк: транспорт Dependency Artifacts в Sandbox

Type: task
Status: open
Blocked by: None

## Question

Замерить в Chrome то, без чего нельзя выбрать транспорт Dependency Artifacts (research «Как собирать и доставлять Dependency Artifacts», §4 и §9). Код спайка — одноразовый, на ветке `research/artifact-transport`; в `main` не мержится.

- Берёт ли opaque-origin `srcdoc`-iframe (`sandbox="allow-scripts"`) module scripts с нашего origin из HTTP-кэша на втором Run (DevTools «(disk cache)»). Это выбор между вариантами 2 и 3.
- Warm Run для вариантов 1, 1′, 2 и 3 на React-задании (база PoC ~0.5 с) и на наборе из 3–4 пакетов.
- Вариант 3: можно ли вставить import map из inline classic-скрипта после `postMessage`, до первого модуля.
- Работает ли `integrity` из import map для статических импортов внутри chunks, а не только для entry.
- Лексер esm.sh на `react`, `react-dom/client`, `scheduler` и паре популярных CJS-пакетов: совпадает ли с `Object.keys(require(...))`.
- Формулировки ошибок `npm ci` при конфликте peer-зависимостей: можно ли показывать как есть.

Ответ — таблица замеров и вывод по каждому пункту.
