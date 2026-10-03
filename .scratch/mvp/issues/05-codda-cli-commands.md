# 05: Команды CLI `codda`

Type: grilling
Status: resolved
Blocked by: 03, 08

## Question

Какие команды, аргументы и вывод у CLI `codda` в MVP? CLI запускается в любой папке курса (ADR-0006). Кандидаты из раунда 2: `codda init`, `codda test`, `codda lesson` (скелет Lesson), `codda ci`, `codda deps`, а также `codda dev <путь>` и `codda build <путь>`.

Решить:

- Окончательный список команд и что каждая проверяет или создаёт. `codda test`: собираются ли starter и solution, проходит ли solution тесты, падает ли на них starter, валиден ли manifest, собираются ли зависимости.
- Чем `codda ci` отличается от `codda test` (и нужен ли он).
- Где выполняются Lesson Tests при `codda test`: в headless-браузере (Playwright) с тем же Runtime или иначе. ADR-0007 требует Chromium: только в нём `codda test` блокирует внешние запросы пакетов.
- Формат вывода и коды выхода для CI.
- Как CLI ставится и запускается в MVP (из этого репозитория: `npx codda`, `npm run codda`?).

## Answer

Вопросы и ответы по раундам — в [questions/05-codda-cli-commands.md](../questions/05-codda-cli-commands.md). Решение «инструмент собран заранее, курс приходит данными» записано в [ADR-0008](../../../docs/adr/0008-prebuilt-tool-course-as-data.md).

**Команды** (путь необязателен: без него `course.yaml` ищется вверх от текущей папки):

| Команда | Что делает |
|---|---|
| `codda init [путь] [--ci github\|gitlab]` | Работает только в пустой папке (кроме `.git`) и ничего не спрашивает. Создаёт `course.yaml` (`id` = имя папки), `package.json` без зависимостей, `.npmrc` (`save-exact=true`), `.gitignore` (`node_modules/`, `.codda/`, `dist/`) и Lesson `hello`. С `--ci` кладёт шаблон CI (добавлено тикетом 06). Затем запускает `npm install`. |
| `codda lesson <id> [--module <title>] [--tsx]` | Создаёт Lesson из шаблона (`.ts` без зависимостей, `--tsx` требует `react`) и дописывает его в последний или указанный Module, сохраняя комментарии в `course.yaml`. Новый Lesson сразу проходит `codda test`. |
| `codda test [путь]` | Полная проверка курса, она же команда для CI. Если путь ведёт в папку Lesson, проверяется только этот Lesson и общий манифест. |
| `codda dev [путь] [--port]` | Сервер на `127.0.0.1:4173`. При правке файлов пересобирает `course.json` и перезагружает страницу (SSE). При изменении `package*.json` выполняет npm и пересобирает Dependency Artifact. Lesson с ошибками манифеста показывается страницей ошибок. Тесты сам не запускает. |
| `codda build [путь] [--out]` | Статическая сборка, по умолчанию в `<курс>/dist`. Проверяет манифест и зависимости, тестов не запускает. При любой ошибке ничего не пишет. Очищает `--out`, только если там есть маркер `.codda-build`. URL относительные. Одна сборка — один курс. |

Команд `ci` и `deps` нет: CI запускает `codda test`, а затем `codda build`, отличия включаются переменной `CI=true`.

**`codda test`:**

1. Манифест (тикет 03).
2. npm: при `CI=true` всегда `npm ci`, локально — только если `node_modules` нет или `node_modules/.package-lock.json` не совпадает с `package-lock.json`.
3. Dependency Artifact (ADR-0007). Если он упал, Lesson не проверяются.
4. Сборка курса как в `codda build`, но в `.codda/test/`, и сервер на `127.0.0.1` со случайным портом.
5. Полный Chromium через Playwright (не headless shell). Запросы на чужие origin'ы блокируются и считаются ошибкой. Служебная страница сборки делает прогревочный Run, затем по очереди Run для каждого Lesson: Solution, потом Starter. Лимит Run — 5 с, как у студента.

Lesson прошёл, если у Solution Test Report с тестами, их ≥1 и все PASS, а у Starter Test Report с тестами и ≥1 FAIL. Ошибка компиляции, runtime-ошибка или timeout считаются ошибкой и для Solution, и для Starter. Ошибки типов в Solution и Lesson Tests — ошибка, в Starter — предупреждение. Проверка идёт тем же TS и конфигом, что у Type Checker (детали — тикет 09).

**Вывод:** одна строка на Lesson (`✓` / `✗` / `⚠`), ошибки под ней с отступом, путь от корня Course, итоговая строка. Цвет только в TTY и без `NO_COLOR`, `--json` нет. Коды выхода: `0` — успех (предупреждения не влияют), `1` — ошибки курса, `2` — окружение или вызов (нет курса, нет Chromium, неизвестная команда или флаг). `--help` на русском, `--version`.

**Окружение:** кэш Dependency Artifact и временные файлы — в `.codda/` Course. Chromium ставится только командой `playwright install chromium` через внутреннее зеркало (`PLAYWRIGHT_DOWNLOAD_HOST`). Если его нет, выводится одна строка с командой установки.

**Запуск в MVP:** CLI на TypeScript лежит в `cli/codda.ts` и запускается как `node cli/codda.ts` или `npm run codda -- …` (Node 24). Аргументы разбирает `node:util` `parseArgs`. `bin` прописан в `package.json`, `npm link` упомянут в README. Готовый UI CLI берёт из `dist-tool/`. Если его нет или он устарел, CLI собирает его сам.
