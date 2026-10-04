# Эксперимент «MVP за один прогон»: план и журнал

Агент проходит все задачи MVP подряд в ветке `mvp-autorun`, один коммит на тикет; человек мержит всё одним PR. Правила приняты в [questions/00-mvp-autorun.md](questions/00-mvp-autorun.md) (раунд 1). Этот файл — порядок работ, договорённости между фичами и журнал прогона. Это исключение из правила `CLAUDE.md` «ветка и PR на фичу», только для этого эксперимента. Раскладка тоже исключение из [docs/agents/issue-tracker.md](../../docs/agents/issue-tracker.md): все документы прогона лежат здесь, а фичи — в папках `NN-<feature>/`, пронумерованных в порядке выполнения.

Slug фичи — имя папки без номера: `lesson-manifest/02` = [`01-lesson-manifest/issues/02-…`](01-lesson-manifest/issues/). Тикет `misc/03` лежит в [`00-workspaces/`](00-workspaces/issues/01-workspaces.md). План решений MVP, на котором построены спеки, остаётся в [`../mvp/`](../mvp/map.md). Что получится в итоге, архитектура и как это проверяется — в [RESULT.md](RESULT.md). Что делает человек — в [HUMAN.md](HUMAN.md).

## Фазы

| Фаза | Что | Коммиты | Остановка |
|---|---|---|---|
| **A. Спеки** | `spec.md`, тикеты и вопросы для каждой фичи. Общий раунд 2 — в [questions/00-mvp-autorun.md](questions/00-mvp-autorun.md) | `docs: спека и тикеты <feature>` — по одному на фичу | **Да:** человек смотрит тикеты и отвечает на раунд 2 |
| **B. Код** | Тикеты по порядку ниже | `<feature> NN: <что сделано>`, плюс при необходимости промежуточные `fix` и `<feature>: правки по review` | Только по правилам Q8 |

## Порядок фич

Порядок взят из Шага 3 [docs/HOW-TO-PROCEED.md](../../docs/HOW-TO-PROCEED.md). Тикеты и их блокировки — в `issues/` каждой фичи. Ниже — что каждая фича оставляет следующей.

| # | Фича | Что оставляет следующим |
|---|---|---|
| 0 | [`misc-03-workspaces`](00-workspaces/issues/01-workspaces.md) | `packages/codda/` и каркас CLI `packages/codda/cli/codda.ts` (`--help`, `--version`, код `2`) |
| 1 | [`lesson-manifest`](01-lesson-manifest/spec.md) | Формат Course на диске, Zod-схема, `course.json`, минимальный `codda build`, экран Lesson (тулбар, вкладки «Тесты» и «Решение»), Reset; React Hooks в новом формате, PoC-формат удалён |
| 2 | [`runtime-hardening`](02-runtime-hardening/spec.md) | Отмена Run, вкладка «Console», строка и подчёркивание ошибки компиляции в Workspace (source maps — «MVP, часть 2»), async-ошибки, восстановление после падения |
| 3 | [`dependency-artifacts`](03-dependency-artifacts/spec.md) | Dependency Artifact Course в `deps/<hash>/` (`importmap.json`, `types.json`), Compiler читает его; PoC `scripts/build-deps.mjs` и `public/deps/` удалены |
| 4 | [`author-cli`](04-author-cli/spec.md) | `codda build` полностью, `dev`, `test`, `init`, `lesson`, шаблоны CI; CI репозитория гоняет `codda test` + `codda build` по курсам |
| 5 | [`ts-tooling`](05-ts-tooling/spec.md) | Type Checker: diagnostics, autocomplete, вкладка «Проблемы»; проверка типов в `codda test` |
| 6 | [`course-ux`](06-course-ux/spec.md) | Дерево Course, `← Предыдущий` / `Следующий →`, прогресс и Workspace в `localStorage` |
| 7 | [`pilot-course`](07-pilot-course/spec.md) | 5 Lesson React Hooks проходят `codda test` и `codda build` в CI; дальше пилот на людях (человек) |

## Все тикеты по порядку выполнения

33 тикета. Внутри фичи номера идут в порядке блокировок, так что агент берёт их сверху вниз. ✋ — тикет для человека, агент его не делает.

| # | Тикет | Blocked by |
|---|---|---|
| 1 | [misc/03 — npm workspaces, `packages/codda/`, каркас CLI](00-workspaces/issues/01-workspaces.md) | — |
| 2 | [lesson-manifest/01a — Course как данные: `course.yaml`, модуль чтения, минимальный `codda build`](01-lesson-manifest/issues/01a-course-format-and-build.md) | misc/03 |
| 3 | [lesson-manifest/01b — UI читает `course.json`, e2e и выкладка на сборке `codda build`, PoC-формат удалён](01-lesson-manifest/issues/01b-ui-on-course-json.md) | 01a |
| 4 | [lesson-manifest/02 — все ошибки Course сразу](01-lesson-manifest/issues/02-course-errors.md) | 01a |
| 5 | [lesson-manifest/03 — экран Lesson: тулбар, «Тесты», «Решение», Test Report на русском, Reset](01-lesson-manifest/issues/03-lesson-screen.md) | 01b |
| 6 | [lesson-manifest/04 — Instructions из Markdown](01-lesson-manifest/issues/04-instructions-markdown.md) | 01b, 02 |
| 7 | [lesson-manifest/05 — граница ADR-0006 в CI](01-lesson-manifest/issues/05-adr-0006-boundary.md) | 01b |
| 8 | [runtime-hardening/01 — отмена Run](02-runtime-hardening/issues/01-cancel-run.md) | lesson-manifest |
| 9 | [runtime-hardening/02 — вкладка «Console»](02-runtime-hardening/issues/02-console-tab.md) | lesson-manifest |
| 10 | [runtime-hardening/03 — async-ошибки во время тестов (R8)](02-runtime-hardening/issues/03-async-errors-in-tests.md) | lesson-manifest |
| 11 | [runtime-hardening/04 — ошибка компиляции в Workspace: строка и подчёркивание](02-runtime-hardening/issues/04-compile-error-line-in-workspace.md) | lesson-manifest |
| 12 | [runtime-hardening/05 — восстановление после падения Worker](02-runtime-hardening/issues/05-worker-crash-recovery.md) | 01 |
| 13 | [dependency-artifacts/01 — `codda build` собирает Dependency Artifact, Run берёт зависимости из него](03-dependency-artifacts/issues/01-artifact-tracer-bullet.md) | lesson-manifest, runtime-hardening |
| 14 | [dependency-artifacts/02 — кэш по hash, правила npm, проверки `package.json`](03-dependency-artifacts/issues/02-cache-and-npm.md) | 01 |
| 15 | [dependency-artifacts/03 — ошибки сборки артефакта](03-dependency-artifacts/issues/03-build-errors.md) | 01 |
| 16 | [dependency-artifacts/04 — ошибки Run: импорт вне точек входа, пропавший артефакт](03-dependency-artifacts/issues/04-compiler-errors.md) | 01 |
| 17 | [dependency-artifacts/05 — `types.json`](03-dependency-artifacts/issues/05-types-json.md) | 01 |
| 18 | [author-cli/01 — `codda build` целиком](04-author-cli/issues/01-build-complete.md) | dependency-artifacts |
| 19 | [author-cli/02 — `codda test` по всему Course в Chromium](04-author-cli/issues/02-test-whole-course.md) | 01 |
| 20 | [author-cli/03 — `codda test`: один Lesson, чужие origin'ы, нет Chromium](04-author-cli/issues/03-test-edges.md) | 02 |
| 21 | [author-cli/04 — `codda dev`](04-author-cli/issues/04-dev-server.md) | 02 |
| 22 | [author-cli/05 — `codda init` и `codda lesson`](04-author-cli/issues/05-init-and-lesson.md) | 03 |
| 23 | [author-cli/06 — CI по курсам, выкладка сборки курса, шаблоны `--ci`](04-author-cli/issues/06-ci.md) | 05 |
| 24 | [ts-tooling/01 — ошибки типов в редакторе](05-ts-tooling/issues/01-type-errors-in-editor.md) | lesson-manifest, dependency-artifacts |
| 25 | [ts-tooling/02 — вкладка «Проблемы», статус, смена Lesson](05-ts-tooling/issues/02-problems-tab.md) | 01 |
| 26 | [ts-tooling/03 — autocomplete](05-ts-tooling/issues/03-autocomplete.md) | 01 |
| 27 | [ts-tooling/04 — проверка типов в `codda test`](05-ts-tooling/issues/04-codda-test-types.md) | 01, author-cli |
| 28 | [course-ux/01 — переход между Lesson, `#/…`, Пред./След.](06-course-ux/issues/01-lesson-navigation.md) | lesson-manifest, runtime-hardening, ts-tooling |
| 29 | [course-ux/02 — Workspace в `localStorage`](06-course-ux/issues/02-workspace-local-storage.md) | 01 |
| 30 | [course-ux/03 — дерево Course](06-course-ux/issues/03-course-tree.md) | 01 |
| 31 | [course-ux/04 — прогресс](06-course-ux/issues/04-progress.md) | 02, 03 |
| 32 | [pilot-course/01 — курс зелёный в CI, e2e «студент проходит курс»](07-pilot-course/issues/01-course-green-and-e2e.md) | все фичи выше |
| 33 | [pilot-course/02 — сверка с «Определением MVP», README для Author, документы стадии](07-pilot-course/issues/02-mvp-checklist-and-docs.md) | 01 |
| ✋ | [pilot-course/03 — пилот на людях](07-pilot-course/issues/03-pilot-on-people.md) | merge PR |

Точки остановки: после фазы A (пройдена 2026-10-04, раунды 2–3), затем после каждой фичи — push и ожидание зелёного `check`.

## Договорённости между фичами

Зафиксированы до нарезки, чтобы спеки фич не противоречили друг другу.

1. **Нет одноразовой инфраструктуры.** `course.json` с первого тикета `lesson-manifest` пишет `codda build` в минимальном виде: копирует готовый UI и кладёт рядом `course.json` и Dependency Artifact. Отдельного временного скрипта нет. `author-cli` дополняет `build` (устаревший `dist-tool/`, маркер `.codda-build`, «при ошибке ничего не пишет») и добавляет остальные команды.
2. **Зависимости до фичи `dependency-artifacts`** — PoC-артефакт из `public/deps/`, который `codda build` копирует как есть. Его заменяет фича 3.
3. **Lesson Tests импортируют `./main`.** Compiler отдаёт Workspace под этим именем с первого тикета `lesson-manifest`.
4. **Вкладки нижней панели появляются вместе с фичей, которая их наполняет:** «Тесты» и «Решение» — `lesson-manifest`, «Console» — `runtime-hardening`, «Проблемы» — `ts-tooling`. `← Предыдущий` / `Следующий →`, дерево и прогресс — `course-ux`. До `course-ux` Lesson выбирается фрагментом `#/<lesson id>`, по умолчанию открывается первый.
5. **`types.json`** собирает `dependency-artifacts`, читает `ts-tooling`. Проверка типов в `codda test` — тикет `ts-tooling`, не `author-cli`.
6. **Общий модуль конфига TS** (ADR-0009) вводит `ts-tooling`. До него Compiler работает как в PoC.
7. **Зелёный баннер PASS** делает `lesson-manifest/03`, а `course-ux/01` добавляет в него «Следующий урок →».
8. **`@codemirror/lint`** первой подключает `runtime-hardening/04` (подчёркивание ошибки компиляции). `ts-tooling/01` добавляет второй источник диагностик рядом, не заменяя первый.
9. **Новые виды Test Report** `cancelled` и `internal-error` (`runtime-hardening`) `codda test` считает ошибкой и для Solution, и для Starter.
10. **Ошибки загрузки артефакта** (404, integrity) — `dependency-artifacts/04`, а не `runtime-hardening`.
11. **Выкладку на Pages** переключает на `codda build` уже `lesson-manifest/01b`: без `course.json` пилот пуст. `author-cli/06` дополняет CI проверкой всех курсов.

## Ритуал тикета (фаза B)

1. Свежий субагент (аналог `/clear`). Получает путь тикета и этот файл.
2. Читает тикет, спеку, `CONTEXT.md`, ADR, `SKILL.md` скиллов `implement` и `tdd`. Ставит `Status: in-progress`.
3. Тесты до кода, red → green. Ошибки и граничные случаи — в этом же тикете (правило MVP из `CLAUDE.md`).
4. Прогоняет `npm run typecheck`, `npm test`, `npm run test:e2e`: каждый коммит зелёный.
5. Отмечает чекбоксы, дописывает `## Comments` и `Status: done`. Коммит `<feature> NN: …`.
6. После последнего тикета фичи оркестратор запускает `/code-review` по диапазону коммитов фичи, правки идут коммитом `<feature>: правки по review`. Затем `git push`, draft PR (с первой фичи) и ожидание зелёного `check`.

## Правила против оверинжиниринга

Каждый субагент получает их в промпте, review проверяет по ним:

1. Делать ровно критерии приёмки тикета. Находка вне них идёт в `## Comments`, а не в код.
2. Никаких абстракций «на будущее» под «MVP, часть 2»: multi-file, framework adapter, плагины, конфиги.
3. Новый модуль или слой — только если без него тест не написать. Три похожие строки лучше преждевременного хелпера.
4. Новые npm-зависимости — только `zod`, `yaml`, `typescript-6` (алиас на TS 6), `@typescript/vfs`, `@codemirror/lint`, `@codemirror/autocomplete`, `marked`, `@types/node` (devDependency пакета `codda`, добавлен человеком 2026-10-04). Всё остальное — стоп и вопрос.
5. Без лишних защитных проверок внутри своего же кода. Валидация только на границах: манифест (Zod), `postMessage`, аргументы CLI.
6. **Сложную проблему сначала обойти, а не победить.** Если критерий упирается в задачу, которая заметно больше самого тикета (тонкий браузерный механизм, своя реализация того, что не нужно пилоту, борьба с инструментом), агент не строит сложное решение. Сначала он ищет обход в рамках MVP: упростить поведение, сузить случай, взять более грубый, но надёжный вариант, отложить часть в «MVP, часть 2». Мерило — пилот: 5 Lesson React Hooks, внутренние пользователи, только Chrome. Пример — source maps, снятые из MVP (Q11/Q13). Обход записывается в `## Comments` тикета, в «Журнал допущений» и, если что-то отложено, строкой в «MVP, часть 2» `docs/roadmap.md`.
7. **Happy path не тормозим (решение человека, 2026-10-04).** Если happy path тикета работает, а проблема лежит вне него — баг граничного случая, флейк, медленные или нестабильные тесты, расхождение с буквой спеки/ADR при той же сути, — агент её не чинит и разработку не останавливает. Флейковый или медленный тест помечается `test.skip` с комментарием-ссылкой на запись, проблема записывается строкой в «Отложенные проблемы» ниже (что, где воспроизводится, гипотеза). К ним вернёмся после прогона. Правило 6 и «Когда агент останавливается» действуют для того, что ломает happy path или пункт «Определения MVP».

## Когда агент останавливается

- **Продолжает сам**, если решение не задано, но не противоречит ADR. Решение пишется в `## Comments` тикета и строкой в «Журнал допущений» ниже.
- **Обходит сам** сложную проблему по правилу 6 выше, если обход не убирает пункт «Определения MVP» и не нарушает ADR.
- **Останавливается**, если: обход сложной проблемы убирает пункт «Определения MVP» или пользовательское поведение из спеки целиком (тогда агент предлагает обход и ждёт решения); нужно нарушить ADR или жёсткое ограничение `CLAUDE.md`; нужна зависимость вне списка; тикет не позеленел после 3 подходов `diagnosing-bugs`; CI красный и это не флейк; нужно действие наружу, кроме `git push` в `mvp-autorun` и draft PR.
- Остановка на тикете не блокирует независимые тикеты той же фичи, но следующую фичу агент не начинает.

## Контекст и лимиты

Оркестратор держит в контексте только этот файл и короткие отчёты субагентов, а каждый тикет делает свежий субагент. Поэтому контекст оркестратора растёт примерно на страницу за тикет. При переполнении Claude Code сжимает старую историю, и это не мешает: всё состояние лежит в git, в статусах тикетов и в этом файле. Возобновить можно в любой сессии фразой «продолжай mvp-autorun». На лимите плана работа останавливается на границе тикета.

## Журнал

<!-- Одна строка на событие: дата — фича/тикет — что произошло (коммит, остановка, push, CI). -->

- 2026-10-04 — фаза B — человек дал старт («начинай фазу B»)
- 2026-10-04 — misc/03 — коммит: npm workspaces, инструмент в `packages/codda/`, каркас CLI `npx codda` (`--help`, `--version`, код `2`)
- 2026-10-04 — misc-03-workspaces — /code-review (Standards: 0 жёстких; Spec: 3), правки отдельным коммитом
- 2026-10-04 — misc-03-workspaces — push, draft PR #6, `check` зелёный; фича закрыта
- 2026-10-04 — человек разрешил `@types/node`; `cli/` вернулся в typecheck (`packages/codda/cli/tsconfig.json`)
- 2026-10-04 — lesson-manifest/01a — коммит: `course.yaml` и пять Lesson React Hooks в новом формате, модуль чтения Course (Zod + `yaml`), минимальный `codda build`, собранный UI в `dist-tool/`
- 2026-10-04 — lesson-manifest/01b — коммит: UI грузит `course.json` и выбирает Lesson по `#/<id>`, Compiler отдаёт `./main`, middleware `course.json` в `npm run dev`, e2e и выкладка на Course Build `codda build courses/react-hooks`, PoC-формат удалён
- 2026-10-04 — lesson-manifest/01b — агент прерывался на лимите сессии, дошёл до коммита после сброса; оркестратор перепроверил: typecheck, 38 unit, 11 e2e зелёные. Пауза на границе тикета до «продолжай mvp-autorun»
- 2026-10-04 — lesson-manifest/02 — коммит: все ошибки Course за один запуск (схема, кросс-файловые правила, файлы Lesson), сообщения Zod и YAML по-русски, номер строки YAML через `LineCounter`
- 2026-10-04 — lesson-manifest/03 — коммит: экран Lesson — тулбар, вкладки «Тесты» и «Решение», Test Report на русском с баннером PASS и счётчиком, Reset одной транзакцией с отменой `Mod-z`; e2e на русских надписях
- 2026-10-04 — lesson-manifest/04 — коммит: Instructions из Markdown — `marked` в модуле чтения Course, raw HTML экранируется, внешние ссылки в новой вкладке, картинка — ошибка Course со строкой; UI вставляет HTML
- 2026-10-04 — lesson-manifest/05 — коммит: граница ADR-0006 — `rootDir` в tsconfig пакета и Node-тест `cli/boundary.test.ts` (esbuild разрешает каждый импорт исходников, включая `?raw`/`?url`), идёт в `npm test`
- 2026-10-04 — lesson-manifest — /code-review (Standards: 1 жёсткое — XSS через `javascript:` в Instructions; Spec: 4), правки отдельным коммитом
- 2026-10-04 — lesson-manifest — push; `check` красный (dev-server.test: в контейнере localhost → ::1), fix 3806e47; `check` зелёный (прогон 37205302805); фича закрыта. Выкладка на Pages (01b) подтверждается после merge
- 2026-10-04 — runtime-hardening/01 — коммит: отмена Run — `run(input, { signal })` и отчёт `cancelled` (deadline и отмена одним путём), `■ Отмена` на месте «Запустить тесты», нейтральное «Запуск отменён»
- 2026-10-04 — runtime-hardening/02 — коммит: вкладка «Console» — `run(input, { onConsole })`, Test Harness перехватывает `console.*`, лимиты 1000 строк / 10 000 символов с обеих сторон, канал Sandbox → parent на `MessagePort`; флейк первого Run после бесконечного цикла отложен (правило 7), 2 теста `test.skip`
- 2026-10-04 — runtime-hardening/03 — коммит: async-ошибки во время тестов (R8) — Test Harness слушает `error` и `unhandledrejection` весь Run и валит текущий тест (первая ошибка сохраняется), остальные выполняются; окно теста — конец промиса плюс два macrotask
- 2026-10-04 — runtime-hardening/04 — коммит: `line/column` у ошибки компиляции только в Workspace (Workspace в esbuild — `file` `main`), ошибка Lesson Tests без строки; `runtime-error` без stack, сообщение — `message`; подчёркивание ошибки компиляции в редакторе через `@codemirror/lint`, снимается на правке и старте Run
- 2026-10-04 — runtime-hardening/05 — коммит: падение Worker Compiler'а (не загрузился `esbuild.wasm` или скрипт, упал `initialize`) — сразу `internal-error`, Worker уничтожен, следующий Run поднимает новый; «Внутренняя ошибка» во вкладке «Тесты», новый текст timeout; сбой в тестах — `page.route` (команды Vitest browser и e2e)
- 2026-10-04 — runtime-hardening — /code-review (Standards: 0 жёстких; Spec: 7). Исправлено: колонка ошибки в байтах (кириллица), падение экрана при правке во время Run, ложный чекбокс 01, тест «Run from «Решение»» возвращён (переставлен до тестов с бесконечным циклом). Остальное — в «Отложенные проблемы»
- 2026-10-04 — runtime-hardening — push, `check` зелёный (прогон 37210868217); фича закрыта
- 2026-10-04 — dependency-artifacts/01 — коммит: `codda build` собирает Dependency Artifact в `deps/<hash>/` (точки входа из импортов Lesson, `npm ci` без `node_modules`, один esbuild со splitting, CJS-обёртки, `importmap.json` с `integrity`), `"deps"` в `course.json`; Compiler грузит файлы по `importmap.json` один раз за Worker; `package.json`/`package-lock.json` у React Hooks, курс-фикстура Runner-тестов; PoC `build-deps.mjs`, `build:deps`, `public/deps/` удалены
- 2026-10-04 — dependency-artifacts/02 — коммит: кэш артефакта в `.codda/deps/<hash>/` (временная папка + `rename`), строка «Зависимости: deps/<hash> — собраны за N с / из кэша», правило npm по `node_modules/.package-lock.json` (одинаково при `CI=true`), ошибка `npm ci` с префиксом и подсказкой, точные версии в `dependencies`, нет `package.json`/`package-lock.json` — ошибка
- 2026-10-04 — dependency-artifacts/03 — коммит: ошибки сборки артефакта — пакет не объявлен в `dependencies` (Lesson, файл, specifier, все сразу), пакет импортирует Node built-in (имя пакета, где импорт), CJS падает при `require()`, subpath вне `exports` — с файлом Lesson; артефакта при ошибке нет
- 2026-10-04 — dependency-artifacts/04 — коммит: ошибки Run из-за артефакта — «Импорт "<specifier>" не предусмотрен заданием» на строке импорта (и при `deps: null`), 404 на `importmap.json`/файл — «Курс обновился, перезагрузите страницу», прочий сбой и `integrity` — «Не удалось загрузить зависимости курса: …», код студента не исполняется, следующий Run грузит заново

## Журнал допущений

<!-- Одна строка на решение, принятое агентом без человека: тикет — решение — почему. Проверить при review PR. -->
- misc/03 — `cli/` не входит в `npm run typecheck` — нужен `@types/node`, его нет в списке разрешённых зависимостей; **решить до `author-cli`**
- misc/03 — корневой пакет называется `codda-repo` — имя `codda` у пакета инструмента, `npx codda` и `file:`-ссылка не должны двоиться
- misc/03 — Vitest — два проекта, `browser` (с `courses/courses.test.ts` через `dir: "../.."`) и `cli` (Node) — тест CLI запускает процесс, браузер ему не нужен
- misc/03 — `codda` без аргументов печатает справку с кодом `0`, есть короткие `-h`/`-v` — в тикете 05 не задано
- misc/03 — `typecheck` = два `tsc -p` (пакет, корень для `courses/`, `e2e/`, `playwright.config.ts`) вместо `tsc -b` — проектные ссылки не нужны
- lesson-manifest/01a — собранный UI переименован `dist/` → `packages/codda/dist-tool/` уже сейчас — путь из ADR-0008, CLI ищет UI там; выкладка до 01b берёт `dist-tool/`
- lesson-manifest/01a — переменная `CODDA_UI_DIR` подменяет собранный UI для тестов CLI — в CI `npm test` идёт до `npm run build`
- lesson-manifest/01a — корневой typecheck исключает `courses/**/lesson.test.*` — `@codda/test` есть только в Sandbox; типы Course проверяет `ts-tooling/04`
- lesson-manifest/01a — `CourseData` лежит в `packages/codda/src/course-data.ts` (только типы), CLI импортирует его оттуда — UI в 01b возьмёт тот же тип без Zod
- lesson-manifest/01a — Instructions React Hooks: код и имена элементов в обратных кавычках — Further Notes спеки
- lesson-manifest/01b — Course Build для e2e и Pages — `courses/react-hooks/dist/` (`--out` по умолчанию) — без нового пути и флага; `dist/` уже в `.gitignore`
- lesson-manifest/01b — переменная `CODDA_COURSE` для `npm run dev`, корневой скрипт задаёт `"$PWD/courses/react-hooks"` — POSIX-shell, Windows не цель пилота
- lesson-manifest/01b — `vite.config.ts` проверяется `cli/tsconfig.json` (Node-типы) — он импортирует модуль чтения Course
- lesson-manifest/01b — `styles.css` импортируется в `App.tsx` — браузерные тесты экрана видят CSS (перенос строк в Instructions)
- lesson-manifest/01b — проект Playwright `dev` запускает корневой `npm run dev` и только `e2e/dev.e2e.ts` — smoke проверяет сам скрипт с `CODDA_COURSE`
- lesson-manifest/01b — e2e use-state ждут `2 / 3 passed` на Starter — так ведут себя Lesson Tests курса; слабость тестов отмечена для `pilot-course`
- lesson-manifest/02 — при ошибке схемы `course.yaml` Lesson всё равно проверяются по сырому списку `modules[].lessons` — иначе «все ошибки за один запуск» не выполняется; при синтаксической ошибке `course.yaml` Lesson не проверяются
- lesson-manifest/02 — свои русские тексты для частых issue Zod («обязательное поле», «ожидается строка», «не может быть пустым», «неизвестное поле») и для кодов ошибок `yaml` — локаль `ru` пишет типы по-английски, `yaml` — целиком по-английски
- lesson-manifest/02 — ошибки файлов Lesson пишутся как `<id>/: нет main.ts или main.tsx`, неуказанная папка — `<id>/lesson.md: урок <id> не указан в course.yaml`; при пустом списке Lesson эта проверка не идёт — формат строки для не-полей в тикете не задан
- lesson-manifest/03 — undo Reset — `Mod-z` CodeMirror (`Cmd+Z` на macOS, `Ctrl+Z` на остальных), тест жмёт модификатор своей платформы — `Ctrl+Z` на macOS не отменяет нигде в системе; «`Ctrl/Cmd+Z`» спеки читается так
- lesson-manifest/03 — транзакция Reset помечена `userEvent: "reset"` — иначе история CodeMirror склеивает её с набором последних 500 мс и undo откатывает лишнее; без новой зависимости `@codemirror/commands`
- lesson-manifest/03 — пока идёт Run, на «Тесты» виден прошлый Test Report — критериями не задано, лишнего состояния не нужно
- lesson-manifest/03 — редакторы подписаны `aria-label` (имя файла Workspace, «Решение») — при открытой вкладке «Решение» на странице два `textbox`
- lesson-manifest/04 — блочный raw HTML показывается текстом в отдельном `<p>` — спека говорит только «экранируется»; без обёртки текст оказался бы вне абзаца
- lesson-manifest/04 — внешняя ссылка — только `http://` и `https://`; `mailto:` и прочие — обычные `<a>` — в спеке не задано
- lesson-manifest/04 — `white-space: pre-wrap` у Instructions снят — переносы задаёт Markdown, мягкий перенос по CommonMark — пробел
- lesson-manifest/04 — то, что `marked` не попал в бандл UI, проверено `grep` по `dist-tool/`, без теста — UI его не импортирует; границу импортов проверит тест 05
- lesson-manifest/05 — сканер импортов — esbuild (уже devDependency) с плагином `onResolve`/`build.resolve`, функция внутри теста — без нового модуля и зависимости, строки в фикстурах не путаются с импортами
- lesson-manifest/05 — неразрешимый импорт исходника — нарушение границы — куда он ведёт, неизвестно; в тикете не задано
- lesson-manifest/05 — `public/`, `dist-tool/`, `.vitest/` не считаются исходниками — статика, собранный UI и вложения Vitest
- lesson-manifest/05 — `rootDir` корневого `tsconfig.json` переопределён на `.` — он наследует пакетный, а e2e читают тип из `packages/codda/src`
- lesson-manifest/05 — `new URL(…, import.meta.url)` не проверяется — не импорт; отмечено в Comments
- lesson-manifest (review) — e2e на экранированный raw HTML на странице не добавлен: экранирует `codda build`, покрыто тестом CLI
- runtime-hardening/01 — после отмены на «Тесты» нет счётчика (ни `N/M`, ни красного `✗`) — «Запуск отменён» нейтральный, красный `✗` спорил бы с этим; в спеке не задано
- runtime-hardening/01 — `■ Отмена` — та же кнопка тулбара с классом `btn` (не синяя `primary`); «Запуск отменён» — заголовок `h2` обычного цвета в Test Report — вид в спеке не задан
- runtime-hardening/01 — «на месте» проверяется при 1280×800: при узком окне Vitest (414 px) колонки экрана следуют ширине тулбара и кнопка сдвигается на 6 px — экран рассчитан на десктоп
- runtime-hardening/01 — слушатель `abort` на внешнем `signal` после конца Run не снимается — экран создаёт новый `AbortController` на каждый Run; отмена после отчёта ничего не делает (тест)
- runtime-hardening/02 — MessagePort вместо window.postMessage — принято человеком
- runtime-hardening/02 — Runner сам отдаёт строку «Console: показаны первые 1000 строк…» на 1001-й строке, а не ждёт её от Sandbox — граница доверия; константы лимитов продублированы в harness и Runner — harness компилируется из исходника
- runtime-hardening/02 — длинная строка обрезается до 10 000 символов без многоточия; счётчик Console — серый бейдж, только при строках > 0; пустая Console — «Нет вывода» — в спеке не задано
- runtime-hardening/02 — «Тесты» открывается и после конца Run, даже если студент перешёл на «Console» во время Run — «после Run открывается «Тесты»» спеки
- runtime-hardening/03 — окно теста — конец промиса плюс **два** macrotask, а не один, как в спеке — Chrome сообщает о незахваченном reject задачей после первого `setTimeout(0)`, при одном reject доставался следующему тесту
- runtime-hardening/03 — e2e «fetch to the Internet» ловит reject (`.catch(() => {})`), тест «lines printed after the report» печатает через 100 мс вместо 0 — по R8 их прежний код валил тест или печатал до отчёта; суть тестов та же
- runtime-hardening/03 — reject на верхнем уровне модуля валит первый тест, а не даёт `runtime-error` — Chrome сообщает о нём уже после старта `runAll`; в спеке «до `runAll`» сказано про `error`
- runtime-hardening/04 — Workspace в esbuild — `{ path: "/main", namespace: "file" }` при `absWorkingDir: "/"` — тогда esbuild пишет `"main"`, а не `"codda:./main"`, и в тексте ошибки, и в `location.file`
- runtime-hardening/04 — текст `runtime-error` — `message` у `Error` (`boom`, а не `Error: boom`) — критерий тикета; так же, как текст ошибки теста
- runtime-hardening/04 — подчёркивание — проп `errors` у `Editor` и `setDiagnostics`, без `linter()`; экран сбрасывает его в `onChange` и на старте Run — источник один, `ts-tooling/01` добавит второй
- runtime-hardening/05 — сбой Worker в тестах — сорванные запросы `page.route` (команды `failRequests`/`restoreRequests` Vitest browser в `vite.config.ts`, в e2e напрямую), тёплый Worker сбрасывается отменой во время компиляции — без тестовых крючков в продуктовом коде
- runtime-hardening/05 — `compile()` при сбое Worker отклоняет промис, Runner превращает это в `internal-error` — без нового вида `CompileResult`
- runtime-hardening/05 — timeout: заголовок «Тесты не завершились за N с», абзац «Возможные причины: бесконечный цикл, зависший промис или нехватка памяти.»; `internal-error` — сообщение и «Запустите тесты ещё раз.» абзацами, счётчик `✗` — точная вёрстка в спеке не задана
- runtime-hardening/05 — `internal-error` на экране проверяет только e2e — в `App.test.tsx` Worker тёплый, сбросить его через экран надёжно нельзя
- dependency-artifacts/01 — ESM или CJS у точки входа — по `.mjs`/`.cjs`, `"type"` в `package.json`, иначе регулярка на `import`/`export` в начале строки — правило 6, статический лексер в «MVP, часть 2»
- dependency-artifacts/01 — `npm ci` только без `node_modules`, кэша нет, артефакт пишется прямо в `<out>/deps/<hash>/` — полное правило npm и кэш — тикет 02
- dependency-artifacts/01 — Compiler получает абсолютный адрес `importmap.json` (`CompileInput.importMap`), адреса внутри разрешает от `new URL("../../", importMap)` — корень сборки по Q1 без отдельного параметра
- dependency-artifacts/01 — `npm run dev` собирает артефакт заново на каждый `course.json` во временную папку и отдаёт `/deps/` своим middleware байт в байт — без кэша (02) и без пересборки по изменению (author-cli)
- dependency-artifacts/01 — курс-фикстура Runner-тестов — `packages/codda/fixtures/react-course/`, global setup `vitest.global-setup.ts` + `provide("importMap")`, сервер тестов раздаёт `/fixture-build/`; `fixtures/` вне скана `boundary.test.ts` — Vite трансформирует `.js` из корня и `publicDir` кэширует список файлов на старте
- dependency-artifacts/01 — «CJS без `__esModule`» в Runner проверен на `react`, а не на поддельном пакете — поддельный пакет в браузерной фикстуре был бы `file:`-зависимостью, не точной версией
- dependency-artifacts/01 — Lesson `alpha` фикстуры `build.test.ts` без JSX — иначе ему нужен объявленный `react`
- dependency-artifacts/02 — «совпадает по версиям» — множество «путь@версия» из `packages` `node_modules/.package-lock.json` и `package-lock.json` (без корня `""`) — в спеке не уточнено
- dependency-artifacts/02 — проверки `package.json`/`package-lock.json` только у Course с импортами пакетов — Course без пакетов строится без них (user story 17)
- dependency-artifacts/02 — тест ошибки `npm ci` идёт с `npm_config_offline=true` — npm 11 сверяет `package.json` с lockfile через registry, а не до него, как предполагала спека
- dependency-artifacts/02 — вызов npm в тестах ловит поддельный `npm` первым в `PATH` — без тестовых крючков в сборщике
- dependency-artifacts/02 — подсказка у диапазона версий: «запустите `npm install <пакет>@<версия> --save-exact`» — текст в спеке не задан
- dependency-artifacts/03 — строка «не объявлен»: `<lesson>/<файл>: импорт "<specifier>": пакет не объявлен в dependencies package.json Course`, без номера строки, по строке на файл — формат в спеке не задан
- dependency-artifacts/03 — `node:fs`/`fs` в Lesson — ошибка «пакет не объявлен», а не «встроенный модуль Node» — критерий тикета
- dependency-artifacts/03 — ошибка разрешения точки входа (subpath вне `exports`) — текст esbuild без его заметок: `build.resolve` даёт только совет «mark as external»
- dependency-artifacts/04 — 404 под `integrity` Chrome отдаёт как `Failed to fetch`, поэтому после провала загрузки Worker спрашивает `HEAD` без `integrity`: 404 — «Курс обновился…» — правило 6, без своей проверки hash
- dependency-artifacts/04 — причина в «Не удалось загрузить зависимости курса: …» — путь файла и сообщение браузера; сеть и `integrity` Chrome не различает — формат в спеке не задан
- dependency-artifacts/04 — при ошибке загрузки Run даёт одну compile-error без строки, прочие ошибки esbuild отбрасываются — иначе одна причина повторяется на каждом импорте

## Отложенные проблемы

<!-- По правилу 7: одна строка на проблему — тикет — что и где воспроизводится — гипотеза — что отключено. Разобрать после прогона. -->

- runtime-hardening/02 — первый Run после Sandbox с бесконечным циклом (после отмены или timeout) иногда не стартует: новый iframe не исполняет ни строки, через 5 с ложный timeout, дальше Run работают. `App.test.tsx` на чистом `657a07c` падает в 5 из 12 прогонов. Гипотеза: Chrome отдаёт новый Sandbox ещё занятому процессу (`--disable-features=SubframeShutdownDelay` не помог). Возможный обход: пересоздать iframe, если нет `codda:port` за ~1 с. Тесты, которые ловят флейк, — `test.skip` со ссылкой сюда
- runtime-hardening (review) — `Promise.reject` на верхнем уровне модуля валит первый тест, а не даёт `runtime-error`, как в спеке (Chrome сообщает о нём после старта `runAll`); e2e «fetch to the Internet» прикрыт `.catch`. Обход: до `runAll` подождать одну задачу
- runtime-hardening (review) — окно теста R8 — два macrotask, в спеке один; текст timeout разбит на заголовок и «Возможные причины» — поправить букву спеки
- runtime-hardening (review) — два Run компилируются в одном Worker, Worker падает: первый получает `internal-error`, второй — ложный timeout. Обход: при падении отклонять все ожидающие `compile` (`compiler.ts`)
- runtime-hardening (review) — косметика: лимиты Console продублированы в `harness.ts` и `runner.ts` («1000» зашито в текст), имя `started` в `harness.ts`
- dependency-artifacts/02 — optional-пакеты, которые npm не ставит на этой платформе, есть в `package-lock.json`, но не в `node_modules/.package-lock.json`: такой Course запускает `npm ci` при каждом промахе кэша. Пилот (React) не задет. Обход: не считать отсутствующие записи с `optional: true` расхождением
