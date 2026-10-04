# 03: `codda test` — один Lesson, чужие origin'ы, нет Chromium, цвет

**What to build:** `codda test` в полном объёме тикета 05 Плана решений.

- Путь к папке Lesson проверяет только этот Lesson и общий манифест.
- Запрос со страницы на чужой origin отменяется и становится ошибкой Lesson, который его сделал.
- Если Chromium не установлен, выводится одна строка с командой установки и код `2`.
- Цвет только в TTY и без `NO_COLOR`.
- `--help` описывает команду по-русски.

Спека — «Проверка в Chromium», «Отчёт `codda test`», «Коды выхода».

**Blocked by:** 02

**Status:** done

- [x] `codda test <папка Lesson>` и `codda test` из папки Lesson проверяют только этот Lesson. Ошибки манифеста других Lesson не печатаются, ошибки `course.yaml` печатаются. Итог: `1 из 1 Lesson прошли`. Папка внутри Course, которой нет в `course.yaml`, даёт ошибку манифеста (код `1`)
- [x] Context Playwright перехватывает все запросы (страница, Worker, Sandbox). Запрос не на origin сервера отменяется, а `запрос на чужой адрес: <url>` записывается ошибкой Lesson, во время Run которого он случился. Приём — как в `e2e/offline.ts`
- [x] Нет Chromium (ошибка запуска Playwright «Executable doesn't exist»): одна строка `Chromium не найден. Установите: npx playwright install chromium (зеркало — PLAYWRIGHT_DOWNLOAD_HOST)`, код `2`, без стека
- [x] Цвет: `✓` зелёный, `✗` красный, `⚠` жёлтый, только при `process.stdout.isTTY` и без `NO_COLOR`. Unit-тест модуля отчёта на оба режима
- [x] `codda test --help` и `codda --help` описывают `test` по-русски. Неизвестный флаг — код `2`
- [x] Тесты (CLI процессом): проверка одного Lesson по пути и из его папки; Lesson, Solution которого делает `fetch("https://example.com/")` (✗ с адресом, код `1`); отсутствие Chromium (подменённый `PLAYWRIGHT_BROWSERS_PATH` на пустую папку, код `2`, одна строка); вывод без цвета при не-TTY
- [x] `npm run typecheck`, `npm test`, `npm run test:e2e` зелёные

## Comments

- **Один Lesson.** `findCourse` уже отдавал id Lesson по пути; `codda test` фильтрует строки ошибок: печатаются только `course.yaml: …` и `<id>/…` (и в stderr при невалидном `course.yaml`, и среди «ничьих» ошибок в начале отчёта). В сборку `.codda/test/` (а значит, и в Dependency Artifact) идёт Course только с этим Lesson, у остальных модулей пустые списки. Lesson с ошибкой манифеста — `✗` без Run (проверено руками: `codda test bad-md`). Папка, которой нет в `course.yaml` (в том числе без `lesson.md`), — `<id>/: урок <id> не указан в course.yaml` в stderr вместе с ошибками `course.yaml`, код `1`, без Chromium.
- **Чужие origin'ы.** Context Playwright с `context.route("**/*")`: запрос `http(s)`/`ws(s)` не на origin сервера отменяется (`blockedbyclient`) и копится; после каждого Run накопленное становится ошибками его файла: `<lesson>/solution.ts: запрос на чужой адрес: <url>` (или `main.ts` у Starter), после ошибок вердикта. Запросы до первого Run (загрузка, `warmUp`) отбрасываются. WebSocket `route` не видит — как в `e2e/offline.ts`, не ловится. Событие route приходит в Node асинхронно: запрос в самом конце Run теоретически может уйти в следующий Run — не наблюдалось, не тестировалось.
- **Нет Chromium** — по подстроке `Executable doesn't exist` в ошибке `chromium.launch`; одна строка из критерия, код `2`. Прочие сбои Playwright — по-прежнему `codda: не удалось проверить курс в Chromium: …`.
- **Цвет** — `formatLesson(result, color)` красит только знак (`32`/`31`/`33`); `color` = `process.stdout.isTTY` и пустой/нет `NO_COLOR` (как на no-color.org). TTY и `NO_COLOR` проверены руками через `script` на `courses/react-hooks`; тест процессом — только не-TTY (нет escape-последовательностей).
- **`--help`** теперь главнее любой команды (`codda test --help`, `codda build --help` печатают справку, а не запускают команду); справка описывает путь к папке урока, блокировку чужих адресов и коды выхода.
- **Тесты:** 5 новых в `cli/test-command.test.ts` (2 с Chromium), цвет в `cli/report.test.ts`, справка и флаг в `cli/codda.test.ts`. Все увидены красными, **кроме** «неизвестный флаг `test` — код `2`»: это поведение было с тикета 02, тест зелёный до кода, оставлен как регрессионный.
- **2026-10-05 — правки по review фичи (оркестратор).** Тест «from a Lesson folder… a foreign request is its error» был в `test.skip` при отмеченном критерии. Причина не в скорости Node: fire-and-forget `fetch` в конце Run отменяется вместе с Sandbox и до `route` не доходит, окно ожидания (пробовали 200 мс) не помогает. Запрос, который Run дождался, ловится всегда (обработчик `route` срабатывает раньше, чем `fetch` отклоняется). Фикстура переведена на `await fetch`, skip снят, 4 из 4 полных `npm test` зелёные по этому тесту. Fire-and-forget — в «Отложенные проблемы».
