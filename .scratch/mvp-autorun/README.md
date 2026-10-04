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
