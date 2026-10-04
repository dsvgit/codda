# Эксперимент «MVP за один прогон»: план и журнал

Агент проходит все задачи MVP подряд в ветке `mvp-autorun`, один коммит на тикет; человек мержит всё одним PR. Правила приняты в [questions/00-mvp-autorun.md](questions/00-mvp-autorun.md) (раунд 1). Этот файл — порядок работ, договорённости между фичами и журнал прогона. Это исключение из правила `CLAUDE.md` «ветка и PR на фичу», только для этого эксперимента.

## Фазы

| Фаза | Что | Коммиты | Остановка |
|---|---|---|---|
| **A. Спеки** | `spec.md`, тикеты и вопросы для каждой фичи. Общий раунд 2 — в [questions/00-mvp-autorun.md](questions/00-mvp-autorun.md) | `docs: спека и тикеты <feature>` — по одному на фичу | **Да:** человек смотрит тикеты и отвечает на раунд 2 |
| **B. Код** | Тикеты по порядку ниже | `<feature> NN: <что сделано>`, плюс при необходимости промежуточные `fix` и `<feature>: правки по review` | Только по правилам Q8 |

## Порядок фич

Порядок взят из Шага 3 [docs/HOW-TO-PROCEED.md](../../docs/HOW-TO-PROCEED.md). Тикеты и их блокировки — в `issues/` каждой фичи. Ниже — что каждая фича оставляет следующей.

| # | Фича | Что оставляет следующим |
|---|---|---|
| 0 | [`misc-03-workspaces`](../misc/issues/03-workspaces.md) | `packages/codda/` и каркас CLI `packages/codda/cli/codda.ts` (`--help`, `--version`, код `2`) |
| 1 | [`lesson-manifest`](../lesson-manifest/spec.md) | Формат Course на диске, Zod-схема, `course.json`, минимальный `codda build`, экран Lesson (тулбар, вкладки «Тесты» и «Решение»), Reset; React Hooks в новом формате, PoC-формат удалён |
| 2 | [`runtime-hardening`](../runtime-hardening/spec.md) | Отмена Run, вкладка «Console», строки ошибок в файле студента, async-ошибки, восстановление после падения |
| 3 | [`dependency-artifacts`](../dependency-artifacts/spec.md) | Dependency Artifact Course в `deps/<hash>/` (`importmap.json`, `types.json`), Compiler читает его; PoC `scripts/build-deps.mjs` и `public/deps/` удалены |
| 4 | [`author-cli`](../author-cli/spec.md) | `codda build` полностью, `dev`, `test`, `init`, `lesson`, шаблоны CI; CI репозитория гоняет `codda test` + `codda build` по курсам |
| 5 | [`ts-tooling`](../ts-tooling/spec.md) | Type Checker: diagnostics, autocomplete, вкладка «Проблемы»; проверка типов в `codda test` |
| 6 | [`course-ux`](../course-ux/spec.md) | Дерево Course, `← Предыдущий` / `Следующий →`, прогресс и Workspace в `localStorage` |
| 7 | [`pilot-course`](../pilot-course/spec.md) | 5 Lesson React Hooks проходят `codda test` и `codda build` в CI; дальше пилот на людях (человек) |

## Все тикеты по порядку выполнения

32 тикета. Внутри фичи номера идут в порядке блокировок, так что агент берёт их сверху вниз. ✋ — тикет для человека, агент его не делает.

| # | Тикет | Blocked by |
|---|---|---|
| 1 | [misc/03 — npm workspaces, `packages/codda/`, каркас CLI](../misc/issues/03-workspaces.md) | — |
| 2 | [lesson-manifest/01 — Course как данные: `course.yaml`, минимальный `codda build`, `course.json`, React Hooks в новом формате](../lesson-manifest/issues/01-course-as-data.md) | misc/03 |
| 3 | [lesson-manifest/02 — все ошибки Course сразу](../lesson-manifest/issues/02-course-errors.md) | 01 |
| 4 | [lesson-manifest/03 — экран Lesson: тулбар, «Тесты», «Решение», Test Report на русском, Reset](../lesson-manifest/issues/03-lesson-screen.md) | 01 |
| 5 | [lesson-manifest/04 — Instructions из Markdown](../lesson-manifest/issues/04-instructions-markdown.md) | 01, 02 |
| 6 | [lesson-manifest/05 — граница ADR-0006 в CI](../lesson-manifest/issues/05-adr-0006-boundary.md) | 01 |
| 7 | [runtime-hardening/01 — отмена Run](../runtime-hardening/issues/01-cancel-run.md) | lesson-manifest |
| 8 | [runtime-hardening/02 — вкладка «Console»](../runtime-hardening/issues/02-console-tab.md) | lesson-manifest |
| 9 | [runtime-hardening/03 — async-ошибки во время тестов (R8)](../runtime-hardening/issues/03-async-errors-in-tests.md) | lesson-manifest |
| 10 | [runtime-hardening/04 — ошибки указывают строку в Workspace](../runtime-hardening/issues/04-errors-point-to-workspace-line.md) | 03 |
| 11 | [runtime-hardening/05 — восстановление после падения Worker](../runtime-hardening/issues/05-worker-crash-recovery.md) | 01 |
| 12 | [dependency-artifacts/01 — `codda build` собирает Dependency Artifact, Run берёт зависимости из него](../dependency-artifacts/issues/01-artifact-tracer-bullet.md) | lesson-manifest, runtime-hardening |
| 13 | [dependency-artifacts/02 — кэш по hash, правила npm, проверки `package.json`](../dependency-artifacts/issues/02-cache-and-npm.md) | 01 |
| 14 | [dependency-artifacts/03 — ошибки сборки артефакта](../dependency-artifacts/issues/03-build-errors.md) | 01 |
| 15 | [dependency-artifacts/04 — ошибки Run: импорт вне точек входа, пропавший артефакт](../dependency-artifacts/issues/04-compiler-errors.md) | 01 |
| 16 | [dependency-artifacts/05 — `types.json`](../dependency-artifacts/issues/05-types-json.md) | 01 |
| 17 | [author-cli/01 — `codda build` целиком](../author-cli/issues/01-build-complete.md) | dependency-artifacts |
| 18 | [author-cli/02 — `codda test` по всему Course в Chromium](../author-cli/issues/02-test-whole-course.md) | 01 |
| 19 | [author-cli/03 — `codda test`: один Lesson, чужие origin'ы, нет Chromium](../author-cli/issues/03-test-edges.md) | 02 |
| 20 | [author-cli/04 — `codda dev`](../author-cli/issues/04-dev-server.md) | 02 |
| 21 | [author-cli/05 — `codda init` и `codda lesson`](../author-cli/issues/05-init-and-lesson.md) | 03 |
| 22 | [author-cli/06 — CI по курсам, выкладка сборки курса, шаблоны `--ci`](../author-cli/issues/06-ci.md) | 05 |
| 23 | [ts-tooling/01 — ошибки типов в редакторе](../ts-tooling/issues/01-type-errors-in-editor.md) | lesson-manifest, dependency-artifacts |
| 24 | [ts-tooling/02 — вкладка «Проблемы», статус, смена Lesson](../ts-tooling/issues/02-problems-tab.md) | 01 |
| 25 | [ts-tooling/03 — autocomplete](../ts-tooling/issues/03-autocomplete.md) | 01 |
| 26 | [ts-tooling/04 — проверка типов в `codda test`](../ts-tooling/issues/04-codda-test-types.md) | 01, author-cli |
| 27 | [course-ux/01 — переход между Lesson, `#/…`, Пред./След.](../course-ux/issues/01-lesson-navigation.md) | lesson-manifest, runtime-hardening, ts-tooling |
| 28 | [course-ux/02 — Workspace в `localStorage`](../course-ux/issues/02-workspace-local-storage.md) | 01 |
| 29 | [course-ux/03 — дерево Course](../course-ux/issues/03-course-tree.md) | 01 |
| 30 | [course-ux/04 — прогресс](../course-ux/issues/04-progress.md) | 02, 03 |
| 31 | [pilot-course/01 — курс зелёный в CI, e2e «студент проходит курс»](../pilot-course/issues/01-course-green-and-e2e.md) | все фичи выше |
| 32 | [pilot-course/02 — сверка с «Определением MVP», README для Author, документы стадии](../pilot-course/issues/02-mvp-checklist-and-docs.md) | 01 |
| ✋ | [pilot-course/03 — пилот на людях](../pilot-course/issues/03-pilot-on-people.md) | merge PR |

Точки остановки: после фазы A (сейчас), затем после каждой фичи — push и ожидание зелёного `check`.

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
11. **Выкладку на Pages** переключает на `codda build` уже `lesson-manifest/01`: без `course.json` пилот пуст. `author-cli/06` дополняет CI проверкой всех курсов.

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
4. Новые npm-зависимости — только `zod`, `yaml`, `typescript-6` (алиас на TS 6), `@typescript/vfs`, `@codemirror/lint`, `@codemirror/autocomplete`, `marked`. Всё остальное — стоп и вопрос.
5. Без лишних защитных проверок внутри своего же кода. Валидация только на границах: манифест (Zod), `postMessage`, аргументы CLI.

## Когда агент останавливается

- **Продолжает сам**, если решение не задано, но не противоречит ADR. Решение пишется в `## Comments` тикета и строкой в «Журнал допущений» ниже.
- **Останавливается**, если: нужно нарушить ADR или жёсткое ограничение `CLAUDE.md`; нужна зависимость вне списка; тикет не позеленел после 3 подходов `diagnosing-bugs`; CI красный и это не флейк; нужно действие наружу, кроме `git push` в `mvp-autorun` и draft PR.
- Остановка на тикете не блокирует независимые тикеты той же фичи, но следующую фичу агент не начинает.

## Контекст и лимиты

Оркестратор держит в контексте только этот файл и короткие отчёты субагентов, а каждый тикет делает свежий субагент. Поэтому контекст оркестратора растёт примерно на страницу за тикет. При переполнении Claude Code сжимает старую историю, и это не мешает: всё состояние лежит в git, в статусах тикетов и в этом файле. Возобновить можно в любой сессии фразой «продолжай mvp-autorun». На лимите плана работа останавливается на границе тикета.

## Журнал

<!-- Одна строка на событие: дата — фича/тикет — что произошло (коммит, остановка, push, CI). -->

## Журнал допущений

<!-- Одна строка на решение, принятое агентом без человека: тикет — решение — почему. Проверить при review PR. -->
