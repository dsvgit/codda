# 01a: Course как данные — `course.yaml`, модуль чтения, минимальный `codda build`

**What to build:** первая половина нового формата, без переключения UI. Курс React Hooks получает `course.yaml` и пять папок Lesson рядом с PoC-форматом. Модуль чтения Course превращает папку Course в `CourseData` или в список ошибок. `codda build courses/react-hooks` собирает статическую папку: готовый UI, `course.json` и PoC-артефакт зависимостей в `deps/`. UI в этом тикете ещё работает на PoC-формате и `course.json` не читает: его переключает [01b](01b-ui-on-course-json.md). Полный набор правил и формат ошибок Course — тикет 02. Разрез 01 на 01a/01b — Q14 [раунда 3](../../questions/00-mvp-autorun.md).

Подробности — в [spec.md](../spec.md): «Формат Course на диске», «Модуль чтения Course», «`course.json`», «Минимальный `codda build`».

**Blocked by:** misc/03 (`misc-03-workspaces`: пакет `codda` и каркас CLI)

**Status:** ready-for-agent

**Формат курса**

- [ ] `courses/react-hooks/course.yaml`: `id: react-hooks`, `title: React Hooks`, один Module `Хуки` с Lesson `use-state, use-effect, use-ref, use-reducer, use-context`
- [ ] Пять папок Lesson: `lesson.md` (frontmatter `title` без префикса «React Hooks N/5:», тело — Instructions из PoC), `main.tsx`, `solution.tsx`, `lesson.test.tsx`; в тестах `./App` → `./main`. PoC-файлы `courses/index.ts`, `courses/react-hooks/*.ts` пока остаются: их удаляет 01b

**Модуль чтения Course и `codda build`**

- [ ] Модуль чтения Course: путь → `CourseData` (тип из спеки) или список строк ошибок; `course.yaml` и frontmatter читаются пакетом `yaml` и проверяются strict Zod-схемами; Lesson берутся в порядке `course.yaml`
- [ ] `codda build <путь> [--out]` (по умолчанию `<путь>/dist`): копирует собранный UI, пишет `course.json`, копирует PoC-артефакт в `deps/`; код `0`
- [ ] Тест CLI (процесс, временный Course из теста): сборка содержит страницу UI, `course.json` с Course и Lesson в порядке `course.yaml` и `deps/`; `workspace.name` — `main.ts` для Lesson на `.ts` и `main.tsx` для `.tsx`
- [ ] Тест CLI: `--out` в другую папку работает
- [ ] Тест CLI: нет `course.yaml` по пути → одна строка, код `2`, ничего не создано
- [ ] Тест CLI: нет собранного UI → строка с подсказкой `npm run build`, код `2`
- [ ] Тест CLI: неизвестный флаг → код `2`
- [ ] Тест CLI: невалидный Course (например, нет `title`) → строка `<файл>: <путь>: <сообщение>` в stderr, код `1`, папка `--out` не создана
- [ ] Тест CLI: `codda build courses/react-hooks` даёт `course.json` с пятью Lesson, Starter, Solution и Lesson Tests из файлов курса
- [ ] Тесты CLI идут в `npm test` и в CI `check`
- [ ] `npm run typecheck`, `npm test`, `npm run test:e2e` зелёные (e2e пока на PoC-формате)
