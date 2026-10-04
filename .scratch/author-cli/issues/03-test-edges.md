# 03: `codda test` — один Lesson, чужие origin'ы, нет Chromium, цвет

**What to build:** `codda test` в полном объёме тикета 05 Плана решений.

- Путь к папке Lesson проверяет только этот Lesson и общий манифест.
- Запрос со страницы на чужой origin отменяется и становится ошибкой Lesson, который его сделал.
- Если Chromium не установлен, выводится одна строка с командой установки и код `2`.
- Цвет только в TTY и без `NO_COLOR`.
- `--help` описывает команду по-русски.

Спека — «Проверка в Chromium», «Отчёт `codda test`», «Коды выхода».

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] `codda test <папка Lesson>` и `codda test` из папки Lesson проверяют только этот Lesson. Ошибки манифеста других Lesson не печатаются, ошибки `course.yaml` печатаются. Итог: `1 из 1 Lesson прошли`. Папка внутри Course, которой нет в `course.yaml`, даёт ошибку манифеста (код `1`)
- [ ] Context Playwright перехватывает все запросы (страница, Worker, Sandbox). Запрос не на origin сервера отменяется, а `запрос на чужой адрес: <url>` записывается ошибкой Lesson, во время Run которого он случился. Приём — как в `e2e/offline.ts`
- [ ] Нет Chromium (ошибка запуска Playwright «Executable doesn't exist»): одна строка `Chromium не найден. Установите: npx playwright install chromium (зеркало — PLAYWRIGHT_DOWNLOAD_HOST)`, код `2`, без стека
- [ ] Цвет: `✓` зелёный, `✗` красный, `⚠` жёлтый, только при `process.stdout.isTTY` и без `NO_COLOR`. Unit-тест модуля отчёта на оба режима
- [ ] `codda test --help` и `codda --help` описывают `test` по-русски. Неизвестный флаг — код `2`
- [ ] Тесты (CLI процессом): проверка одного Lesson по пути и из его папки; Lesson, Solution которого делает `fetch("https://example.com/")` (✗ с адресом, код `1`); отсутствие Chromium (подменённый `PLAYWRIGHT_BROWSERS_PATH` на пустую папку, код `2`, одна строка); вывод без цвета при не-TTY
- [ ] `npm run typecheck`, `npm test`, `npm run test:e2e` зелёные
