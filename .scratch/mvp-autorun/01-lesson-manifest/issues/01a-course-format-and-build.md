# 01a: Course как данные — `course.yaml`, модуль чтения, минимальный `codda build`

**What to build:** первая половина нового формата, без переключения UI. Курс React Hooks получает `course.yaml` и пять папок Lesson рядом с PoC-форматом. Модуль чтения Course превращает папку Course в `CourseData` или в список ошибок. `codda build courses/react-hooks` собирает статическую папку: готовый UI, `course.json` и PoC-артефакт зависимостей в `deps/`. UI в этом тикете ещё работает на PoC-формате и `course.json` не читает: его переключает [01b](01b-ui-on-course-json.md). Полный набор правил и формат ошибок Course — тикет 02. Разрез 01 на 01a/01b — Q14 [раунда 3](../../questions/00-mvp-autorun.md).

Подробности — в [spec.md](../spec.md): «Формат Course на диске», «Модуль чтения Course», «`course.json`», «Минимальный `codda build`».

**Blocked by:** misc/03 (`misc-03-workspaces`: пакет `codda` и каркас CLI)

**Status:** done

**Формат курса**

- [x] `courses/react-hooks/course.yaml`: `id: react-hooks`, `title: React Hooks`, один Module `Хуки` с Lesson `use-state, use-effect, use-ref, use-reducer, use-context`
- [x] Пять папок Lesson: `lesson.md` (frontmatter `title` без префикса «React Hooks N/5:», тело — Instructions из PoC), `main.tsx`, `solution.tsx`, `lesson.test.tsx`; в тестах `./App` → `./main`. PoC-файлы `courses/index.ts`, `courses/react-hooks/*.ts` пока остаются: их удаляет 01b

**Модуль чтения Course и `codda build`**

- [x] Модуль чтения Course: путь → `CourseData` (тип из спеки) или список строк ошибок; `course.yaml` и frontmatter читаются пакетом `yaml` и проверяются strict Zod-схемами; Lesson берутся в порядке `course.yaml`
- [x] `codda build <путь> [--out]` (по умолчанию `<путь>/dist`): копирует собранный UI, пишет `course.json`, копирует PoC-артефакт в `deps/`; код `0`
- [x] Тест CLI (процесс, временный Course из теста): сборка содержит страницу UI, `course.json` с Course и Lesson в порядке `course.yaml` и `deps/`; `workspace.name` — `main.ts` для Lesson на `.ts` и `main.tsx` для `.tsx`
- [x] Тест CLI: `--out` в другую папку работает
- [x] Тест CLI: нет `course.yaml` по пути → одна строка, код `2`, ничего не создано
- [x] Тест CLI: нет собранного UI → строка с подсказкой `npm run build`, код `2`
- [x] Тест CLI: неизвестный флаг → код `2`
- [x] Тест CLI: невалидный Course (например, нет `title`) → строка `<файл>: <путь>: <сообщение>` в stderr, код `1`, папка `--out` не создана
- [x] Тест CLI: `codda build courses/react-hooks` даёт `course.json` с пятью Lesson, Starter, Solution и Lesson Tests из файлов курса
- [ ] Тесты CLI идут в `npm test` и в CI `check` — в `npm test` идут (проект Vitest `cli`); `check` — после CI
- [x] `npm run typecheck`, `npm test`, `npm run test:e2e` зелёные (e2e пока на PoC-формате)

## Comments

- **2026-10-04 — реализация (агент).**
  - **Курс.** `courses/react-hooks/course.yaml` и пять папок Lesson сгенерированы разово из PoC-модулей (скрипт не коммитится): Starter, Solution и Lesson Tests перенесены байт в байт, в тестах `./App` → `./main`. Instructions — тот же текст, но имена элементов и кода (`<p>`, `<output>`, `useState`, `{ type: "reset" }`…) обёрнуты в обратные кавычки (Further Notes спеки). Lesson Tests нового формата пока нигде не исполняются: Compiler отдаёт Workspace как `./App`, `./main` вводит 01b.
  - **Модуль чтения** `packages/codda/cli/read-course.ts`: `readCourse(путь) → { course } | { errors }`. Strict Zod-схемы `course.yaml` и frontmatter (kebab-case для id, `min(1)`), локаль Zod `ru`, путь поля через `z.core.toDotPath` (`modules[0].lessons[1]`). Синтаксическая ошибка YAML — `<файл>: строка N: …`, для frontmatter номер строки считается от начала `lesson.md`. Ошибки собираются по всем Lesson, при любой ошибке возвращается только список.
  - **Тип `CourseData`** — `packages/codda/src/course-data.ts` (только типы, без Zod): его же возьмёт UI в 01b. `cli/` импортирует его как `../src/course-data.ts`.
  - **`codda build`** в `packages/codda/cli/codda.ts`: `build <путь> [--out <папка>]`, `--out` только у `build`, у строкового флага без значения — код `2`; нет пути, лишний аргумент, нет `course.yaml`, нет `dist-tool/index.html` → код `2`; ошибки Course → stderr, код `1`, `--out` не трогается; иначе `cpSync` UI, `public/deps/` → `deps/`, `course.json`, строка «Курс собран в …», код `0`. `--out` перед сборкой не чистится (маркер и очистка — `author-cli`).
  - **Собранный UI переехал в `packages/codda/dist-tool/`** (ADR-0008): `build.outDir` в `vite.config.ts`, `.gitignore`, путь выкладки в `ci.yml`, комментарии `playwright.config.ts`, README. Пилот до 01b выкладывает этот `dist-tool/` как раньше `dist/`.
  - **`CODDA_UI_DIR`** — переменная окружения, которая подменяет папку собранного UI. Нужна тестам CLI: в CI `npm test` идёт до `npm run build`, а «нет собранного UI» иначе не проверить без порчи общего `dist-tool/`. В справке не упоминается.
  - **typecheck:** корневой `tsconfig.json` исключает `courses/**/lesson.test.*` — они импортируют `@codda/test`, который есть только в Sandbox. `main.tsx`/`solution.tsx` курса по-прежнему проверяются. Проверка типов Course — `ts-tooling/04`.
  - **Новые зависимости** пакета `codda`: `zod@^4.6.5`, `yaml@^2.9.1` (`dependencies`, их исполняет CLI) — из разрешённого списка.
  - **Для 02 (вне критериев 01a):** нет файлов Lesson (`lesson.md`, `main.*`, `solution.*`, тестов) сейчас роняет CLI с ENOENT и стеком, кросс-файловых правил нет; сообщения синтаксических ошибок пакета `yaml` — на английском; `codda build --out a --out b` берёт последнее значение молча.
- **2026-10-04 — правки по review фичи (оркестратор).** Ошибка с кодом `2` печаталась двумя строками (сообщение + «Справка: codda --help»), а спека требует одну. Теперь одна строка `codda: <сообщение> (справка: codda --help)`; тесты сверяют stderr целиком.
