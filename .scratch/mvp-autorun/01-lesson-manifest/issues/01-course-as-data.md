# 01: Course как данные — `course.yaml`, `codda build`, `course.json`, React Hooks в новом формате

**What to build:** самый тонкий сквозной путь нового формата. Курс React Hooks лежит как `course.yaml` и пять папок Lesson. `codda build courses/react-hooks` собирает статическую папку: готовый UI, `course.json` и PoC-артефакт зависимостей в `deps/`. Открыв её, студент попадает в первый Lesson или в Lesson из `#/<id>`, правит `main.tsx`, жмёт Run и получает PASS. PoC-формат удалён, UI больше не импортирует `courses/`. `npm run dev` и e2e работают на новом формате, пилот выкладывается из выхода `codda build`. Экран пока остаётся PoC-шным (английский Test Report, Instructions простым текстом): его переделывают тикеты 03 и 04. Полный набор правил и формат ошибок Course — тикет 02.

Подробности — в [spec.md](../spec.md): «Формат Course на диске», «Модуль чтения Course», «`course.json`», «Минимальный `codda build`», «UI → Загрузка, Выбор Lesson», «Разработка инструмента и e2e».

**Blocked by:** misc/03 (`misc-03-workspaces`: пакет `codda` и каркас CLI)

**Status:** ready-for-agent

**Формат и перевод курса**

- [ ] `courses/react-hooks/course.yaml`: `id: react-hooks`, `title: React Hooks`, один Module `Хуки` с Lesson `use-state, use-effect, use-ref, use-reducer, use-context`
- [ ] Пять папок Lesson: `lesson.md` (frontmatter `title` без префикса «React Hooks N/5:», тело — Instructions из PoC), `main.tsx`, `solution.tsx`, `lesson.test.tsx`; в тестах `./App` → `./main`
- [ ] Удалены `courses/index.ts`, `courses/react-hooks/*.ts`, `courses/courses.test.ts`, PoC-задание Counter и параметр `?lesson=`
- [ ] Тесты Runner и UI, которые брали PoC-задание, держат свои мини-Lesson прямо в тесте

**Модуль чтения Course и `codda build`**

- [ ] Модуль чтения Course: путь → `CourseData` (тип из спеки) или список строк ошибок; `course.yaml` и frontmatter читаются пакетом `yaml` и проверяются strict Zod-схемами; Lesson берутся в порядке `course.yaml`
- [ ] `codda build <путь> [--out]` (по умолчанию `<путь>/dist`): копирует собранный UI, пишет `course.json`, копирует PoC-артефакт в `deps/`; код `0`
- [ ] Тест CLI (процесс, временный Course из теста): сборка содержит страницу UI, `course.json` с Course и Lesson в порядке `course.yaml` и `deps/`; `workspace.name` — `main.ts` для Lesson на `.ts` и `main.tsx` для `.tsx`
- [ ] Тест CLI: `--out` в другую папку работает
- [ ] Тест CLI: нет `course.yaml` по пути → одна строка, код `2`, ничего не создано
- [ ] Тест CLI: нет собранного UI → строка с подсказкой `npm run build`, код `2`
- [ ] Тест CLI: неизвестный флаг → код `2`
- [ ] Тест CLI: невалидный Course (например, нет `title`) → строка `<файл>: <путь>: <сообщение>` в stderr, код `1`, папка `--out` не создана

**UI**

- [ ] Compiler отдаёт Workspace Lesson Tests как `./main`; тест Runner на это
- [ ] UI загружает `course.json` относительно страницы с `cache: "no-cache"`, пока грузится — «Загрузка курса…»
- [ ] Без фрагмента открывается первый Lesson; `#/<id>` открывает этот Lesson; `hashchange` открывает другой Lesson с чистого листа (Starter, без Test Report)
- [ ] Неизвестный id → «Урок „<id>“ не найден» и ссылка на первый Lesson
- [ ] `course.json` не загрузился (сеть или не-2xx) → «Не удалось загрузить курс» и кнопка «Обновить»
- [ ] В шапке и в `document.title` — название Lesson и Course; над редактором — имя файла Workspace
- [ ] Instructions показываются как текст с сохранением переносов (Markdown — тикет 04)

**Разработка, e2e, CI**

- [ ] `npm run dev`: Vite с HMR UI, `course.json` отдаёт middleware через модуль чтения Course для курса из переменной окружения; путь `courses/react-hooks` задаёт только скрипт корня. Ошибки Course → 500 с теми же строками
- [ ] `npm run test:e2e`: сборка UI → `codda build` курса React Hooks → Playwright; основной проект открывает эту сборку из подпути `/codda/`, проект `dev` — один smoke-тест (Lesson открывается, Solution даёт PASS)
- [ ] e2e: Solution каждого Lesson из собранного `course.json` даёт PASS по всем тестам, офлайн
- [ ] e2e: `#/use-effect` открывает этот Lesson; неизвестный id; 404 на `course.json` (через `route`) показывает «Не удалось загрузить курс»
- [ ] `golden-path.e2e.ts` и `sandbox-isolation.e2e.ts` переведены на Lesson `use-state`
- [ ] CI выкладывает на Pages выход `codda build`, который проверил e2e (без пересборки)
- [ ] `npm run typecheck`, `npm test`, `npm run test:e2e` зелёные; `npm run dev` вручную открывает `use-state`
