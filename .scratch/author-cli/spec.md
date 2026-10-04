# Spec: author-cli

**Status:** needs-info

Вопросы — в [questions/00-grill.md](questions/00-grill.md). Спека и тикеты написаны по рекомендациям; пустой ответ означает согласие.

Источники решений: спеки фич `lesson-manifest` и `dependency-artifacts` (минимальный `codda build`, шаг npm и кэш артефакта — их), тикеты Плана решений [05: Команды CLI `codda`](../mvp/issues/05-codda-cli-commands.md) и [06: CI и хостинг пилота](../mvp/issues/06-ci-and-pilot-hosting.md), [ADR-0007](../../docs/adr/0007-dependency-artifact-per-course.md), [ADR-0008](../../docs/adr/0008-prebuilt-tool-course-as-data.md), [misc/03](../misc/issues/03-workspaces.md), «Договорённости между фичами» в [autorun.md](../mvp/autorun.md).

## Problem Statement

Author пишет Lesson файлами в Git, но проверить их одной командой не может. До этой фичи у `codda` есть только каркас CLI (`--help`, `--version`) и минимальный `codda build`: он копирует готовый UI и кладёт рядом `course.json` и Dependency Artifact. Чего не хватает:

- Проходит ли Solution свои Lesson Tests, а Starter — не проходит, Author узнаёт только руками в браузере, по одному Lesson. CI этого не проверяет, поэтому сломанный Lesson доезжает до пилота.
- Смотреть курс во время правки негде: каждый раз нужен ручной `codda build` и свой сервер.
- Новый Course и новый Lesson собираются руками, по памяти о соглашениях имён из Lesson Manifest. Ошибка в имени файла видна только при сборке.
- `codda build` молча берёт устаревший UI из `dist-tool/`, может стереть чужую папку в `--out` и при ошибке оставляет полусобранный результат.
- CI этого репозитория выкладывает на пилот сборку инструмента, а не проверенную сборку курса. Репозиторию курса вне `codda` взять готовый CI неоткуда.

## Solution

`codda` становится полным инструментом Author из пяти команд. Курс подключает его как `devDependency` (`"codda": "file:../../packages/codda"` в этом репозитории) и вызывает `npx codda …`. Путь к курсу необязателен: без него `course.yaml` ищется вверх от текущей папки.

- **`codda test`** — одна команда для Author и CI. Она проверяет манифест, ставит зависимости, собирает Dependency Artifact и сборку курса, а затем в полном Chromium выполняет Run для Solution и Starter каждого Lesson тем же Runtime, что у студента. Чужие origin'ы при этом заблокированы. На каждый Lesson печатается строка `✓` / `✗` / `⚠`, под ней ошибки. Коды выхода: `0`, `1` (ошибки курса), `2` (окружение или вызов). Путь к папке Lesson проверяет только этот Lesson.
- **`codda dev`** — локальный сервер на `127.0.0.1:4173`. После правки файла курса страница перезагружается. Lesson с ошибками манифеста показывается страницей ошибок, остальные Lesson работают.
- **`codda build`** — статическая сборка в `dist/` или `--out`. Сам пересобирает устаревший UI, пишет всё или ничего и не стирает папку, где нет маркера прошлой сборки.
- **`codda init`** создаёт новый Course, **`codda lesson`** — новый Lesson. Свежий Course и свежий Lesson сразу проходят `codda test`. `init --ci github|gitlab` кладёт готовый CI с проверкой и выкладкой.
- **CI этого репозитория** для каждого курса в `courses/` запускает `codda test` и `codda build`. На GitHub Pages выкладывается сборка пилотного курса.

## User Stories

1. As an Author, I want to run `npx codda test` inside my Course, so that one command tells me whether every Lesson is correct.
2. As an Author, I want `codda test` to find `course.yaml` by walking up from the current folder, so that I can run it from any subfolder of the Course.
3. As an Author, I want `codda test <путь к папке Lesson>` to check only that Lesson plus the shared manifest, so that my edit-check loop on one Lesson is fast.
4. As an Author, I want `codda test` to fail a Lesson whose Solution does not pass all of its Lesson Tests, so that a student never gets a task that cannot be solved.
5. As an Author, I want `codda test` to fail a Lesson whose Lesson Tests contain zero tests, so that an empty test file is not reported as success.
6. As an Author, I want `codda test` to fail a Lesson whose Starter already passes every Lesson Test, so that a student never gets a task that is solved before it is started.
7. As an Author, I want a compile error, runtime error or timeout in either the Solution or the Starter to fail the Lesson, so that the student's first Run never shows a broken Lesson instead of the task.
8. As an Author, I want Lesson Tests in `codda test` to run in the same Runtime and under the same 5-second Run limit as for the student, so that "passed in `codda test`" means "works for the student".
9. As an Author, I want a warm-up Run before the first Lesson, so that a cold Compiler does not produce a false timeout.
10. As an Author, I want `codda test` to run in full Chromium, so that the Sandbox runs in its own process just as in the student's Chrome.
11. As an Author, I want any request from the page to a foreign origin during `codda test` to be an error of the Lesson that made it, so that a package that fetches from the Internet is caught before the closed environment (ADR-0002).
12. As an Author, I want `codda test` to check the very build that `codda build` produces, opened from a subpath, so that a Lesson that passed also works on hosting.
13. As an Author, I want manifest errors to be printed as `<файл>: <путь к полю>: <сообщение>`, all of them at once, so that I can fix them in one pass.
14. As an Author, I want a Lesson with an invalid manifest to be skipped while other Lessons are still checked, so that one broken Lesson does not hide the state of the rest.
15. As an Author, I want a Dependency Artifact failure to stop the Lesson checks with a clear message, so that I do not get a page of misleading Lesson failures.
16. As an Author, I want `codda test` to install dependencies for me when needed (the npm step of `dependency-artifacts`), so that a fresh clone works with one command.
17. As a CI pipeline, I want `codda test` to use `npm ci` when `CI=true`, so that the check uses exactly the lockfile.
18. As an Author, I want one line per Lesson (`✓`, `✗`, `⚠`) with indented errors and a final summary line, so that I read the result at a glance.
19. As an Author, I want warnings not to change the exit code, so that CI fails only on real errors.
20. As an Author, I want colour only in a TTY and never with `NO_COLOR`, so that CI logs stay clean.
21. As a CI pipeline, I want exit code `1` for course errors and `2` for environment or invocation errors, so that a broken runner is distinguishable from a broken Lesson.
22. As an Author without Chromium installed, I want `codda test` to print one line with the exact install command, so that I fix my environment without searching.
23. As an Author, I want `npx codda dev` to serve my Course on `127.0.0.1:4173` and print the URL, so that I can look at it in Chrome.
24. As an Author, I want `codda dev --port <n>`, so that I can run it next to another server.
25. As an Author, I want the open page to reload after I save a Lesson file or `course.yaml`, so that I see my edit without manual steps.
26. As an Author, I want `codda dev` to reinstall dependencies and rebuild the Dependency Artifact when `package.json` or `package-lock.json` changes, and not to reload the page until that is done, so that I never see a half-updated Course.
27. As an Author, I want a Lesson with manifest errors to show an error page in `codda dev` instead of disappearing, while the other Lessons keep working, so that I see what to fix where I am looking.
28. As an Author, I want a broken `course.yaml` to show its errors full-screen in `codda dev`, so that I understand why nothing opens.
29. As an Author, I want `codda dev` to print manifest errors in the terminal in the `codda test` format, so that terminal and browser agree.
30. As an Author, I want `codda dev` to keep running after a manifest error, so that fixing the file is enough to recover.
31. As an Author, I want `npx codda build` to write a static build into `<курс>/dist` by default, so that I can host it anywhere.
32. As an Author, I want `codda build --out <папка>`, so that the build goes where my hosting expects it.
33. As an Author, I want `codda build` to write nothing at all when the manifest or dependencies have an error, so that a broken build never replaces a working one.
34. As an Author, I want `codda build` to refuse to clear a non-empty `--out` folder that has no `.codda-build` marker, so that a typo like `--out ~` does not delete my files.
35. As an Author, I want `codda build` to rebuild the prebuilt UI itself when `dist-tool/` is missing or older than the tool's sources, and to say so, so that I never ship a stale UI.
36. As an Author, I want `codda build` to list the written files and a summary line, so that I see what will be deployed.
37. As a new Author, I want `npx codda init` in an empty folder to create a working Course without questions, so that I start from something that already passes `codda test`.
38. As a new Author, I want `codda init` to refuse a non-empty folder (except `.git`), so that it never overwrites my files.
39. As a new Author, I want `codda init` to take the Course `id` from the folder name and fail with a hint if it is not kebab-case, so that the `id` is valid from the start.
40. As a new Author, I want `codda init` to create `.npmrc` with `save-exact=true` and `.gitignore` with `node_modules/`, `.codda/`, `dist/`, so that dependencies are exact and generated files stay out of Git.
41. As a new Author, I want `codda init` to add `codda` to the Course's `devDependencies` and run `npm install`, so that `npx codda` works in the new Course right away.
42. As a new Author, I want `codda init` to print the next steps (install React if needed, run `codda test`), so that I know what to do next.
43. As a new Author, I want `codda init --ci github`, so that my Course repository gets a GitHub Actions workflow that checks it and deploys it to GitHub Pages.
44. As a new Author in a closed environment, I want `codda init --ci gitlab`, so that my Course repository gets a GitLab CI pipeline that checks it with an internal image and deploys it to an internal S3.
45. As an Author, I want the CI template to name the Playwright version the image must match, so that I do not look it up when choosing the image.
46. As an Author, I want `npx codda lesson <id>` to create a Lesson folder from a template and append it to the last Module, so that a new Lesson takes one command.
47. As an Author, I want `codda lesson <id> --module <title>` to append it to a chosen Module, so that I can place it right away.
48. As an Author, I want `codda lesson` to keep the comments and formatting of `course.yaml`, so that my notes in it survive.
49. As an Author, I want `codda lesson` to fail on an existing folder, an existing id, a non-kebab-case id or an unknown Module, so that it never damages the Course.
50. As an Author, I want the default Lesson template to be plain `.ts` without dependencies and to pass `codda test` immediately, so that I edit a working example.
51. As an Author, I want `codda lesson <id> --tsx` to create a React component Lesson and to fail with an `npm install` hint when `react` or `react-dom` is not in `dependencies`, so that I do not get a Lesson that cannot compile.
52. As an Author, I want `codda --help`, `codda <команда> --help` in Russian and an exit code `2` for unknown commands and flags, so that the CLI explains itself.
53. As a maintainer of codda, I want this repository's CI to run `codda test` and `codda build` for every folder with `course.yaml` in `courses/`, so that a second Course needs no CI change.
54. As a maintainer of codda, I want the pilot on GitHub Pages to be exactly the `codda build` output that CI checked, so that what is deployed is what was tested.
55. As a pilot user, I want the pilot address to stay `https://dsvgit.github.io/codda/`, so that my links keep working.

## Implementation Decisions

**Как вызывается CLI.** CLI лежит в пакете `codda` и запускается из `.ts` без сборки (misc/03). Курс этого репозитория подключает его через `"codda": "file:../../packages/codda"` в `devDependencies`. В `dependencies` его класть нельзя: из них ADR-0007 собирает Dependency Artifact. `devDependencies` `codda` игнорирует. Скрипты разработки самого инструмента (typecheck, unit, e2e, сборка UI) остаются npm-скриптами корня. `playwright` — в `dependencies` пакета `codda`, его версия совпадает с `@playwright/test` в корне и с образом CI. Аргументы разбирает `node:util` `parseArgs`. Новых зависимостей, кроме `yaml`, фича не вводит.

**Модули CLI.** Ниже — модули с поведением, а не раскладка файлов.

- **Поиск курса.** На входе необязательный путь, на выходе корень Course и, если путь ведёт в папку Lesson, id этого Lesson. `course.yaml` ищется вверх от пути. Если его нет, выдаётся ошибка вызова с кодом `2`. Модулем пользуются все команды, кроме `init`.
- **Шаг npm** вводит фича `dependency-artifacts`, и `author-cli` его не меняет. npm запускается только при промахе кэша артефакта в `.codda/`. При `CI=true` выполняется `npm ci`, локально — только если нет `node_modules` или они расходятся с `package-lock.json`. Ошибки выводятся с префиксом `npm ci:`. `test`, `build` и `dev` вызывают этот шаг через сборку Dependency Artifact. В CI `codda build` после `codda test` попадает в кэш и npm не запускает.
- **Готовый UI (`dist-tool/`).** Перед любой сборкой CLI сравнивает hash исходников UI (исходники, `public/`, `index.html`, конфиг Vite, lockfile) с hash, записанным в `dist-tool/` при прошлой сборке. Hash выбран вместо mtime, потому что `git checkout` меняет mtime. Если `dist-tool/` нет или hash не совпадает, CLI печатает строку «Собираю UI codda…» и запускает сборку UI. Если она упала, код выхода `2`.
- **Сборка курса.** Функция «Course → папка» общая для `build`, `test` и `dev`: готовый UI, `course.json`, `deps/<hash>/`, маркер `.codda-build`. Сначала проверяется манифест и собирается Dependency Artifact, только потом что-то пишется. Запись идёт во временную папку внутри `.codda/` и в конце заменяет целевую. При любой ошибке целевая папка остаётся как была. Если `--out` не пуст и маркера `.codda-build` в нём нет, это ошибка вызова (`2`) до начала сборки. URL в сборке относительные.
- **Статический сервер.** Модуль на `node:http` без зависимостей, общий для `test` и `dev`. Отдаёт папку под заданным подпутём, `.wasm` — с `application/wasm`, слушает только `127.0.0.1`. Для `dev` у него есть два дополнения: SSE-эндпоинт для перезагрузки и вставка в отдаваемый `index.html` маленького inline-скрипта, который подписывается на этот эндпоинт. В сборку и в код UI скрипт перезагрузки не попадает.
- **Служебная страница прогонов** (решение по Q1 вопросов). Это фрагмент `#/__codda-test` того же `index.html`. Он не пересекается с id Lesson, потому что `_` не входит в kebab-case. На этом фрагменте UI вместо экрана Lesson загружает `course.json` и выставляет в `window` объект с двумя функциями:
  - `warmUp()` — прогревочный Run пустого кода, отчёт игнорируется;
  - `run(lessonId, "solution" | "starter")` — Run этого Lesson тем же Runtime, тем же путём «Lesson → вход Compiler», что и кнопка «Запустить тесты», с лимитом 5 с. Возвращает Test Report.

  Порядок задаёт Node: прогрев, затем по очереди Solution и Starter каждого Lesson, через `page.evaluate`. Так строка Lesson печатается сразу после его проверки. Страница входит в обычную сборку (тикет 05, Q4), ссылок на неё в UI нет.
- **Проверка в Chromium.** Playwright `chromium.launch` с `channel: "chromium"` (полный Chromium, не headless shell, как в `vite.config.ts`). Context перехватывает все запросы. Запрос не на origin сервера отменяется и записывается как ошибка того Lesson, во время Run которого он случился (`запрос на чужой адрес: <url>`). Если Chromium не найден, `codda test` печатает одну строку `Chromium не найден. Установите: npx playwright install chromium (зеркало — PLAYWRIGHT_DOWNLOAD_HOST)` и выходит с кодом `2`.
- **Вердикт Lesson.** Чистая функция «Test Report Solution + Test Report Starter → ошибки и предупреждения». Solution: вид `tests`, ≥1 тест, все PASS. Starter: вид `tests`, ≥1 FAIL. Если все тесты Starter проходят, ошибка «Starter уже проходит все тесты». `compile-error`, `runtime-error` и `timeout` — ошибка для обоих. Если Solution не прошёл, Starter не запускается. Предупреждения в этой фиче приходят только от шагов, которые их уже выдают (Dependency Artifact). Проверку типов добавит `ts-tooling` в тот же формат.
- **Отчёт `codda test`.** Сначала строка зависимостей. Затем по строке на Lesson: `✓ id`, `✗ id` или `⚠ id`, под ней ошибки с отступом и путём файла от корня Course. В конце итог `N из M Lesson прошли[, K предупреждений]`. Ошибки манифеста печатаются в формате тикета 03, Lesson с такой ошибкой получает `✗` и в Chromium не проверяется. Если упал Dependency Artifact, строк Lesson нет, код `1`. Цвет включается только при TTY и без `NO_COLOR`.
- **`course.json` в режиме dev.** Только в `codda dev` сборка курса допускает ошибки манифеста. У Lesson с ошибками в `course.json` есть поле `errors: string[]` вместо содержимого, у сломанного `course.yaml` — поле `errors` верхнего уровня без Lesson. UI показывает такой Lesson страницей ошибок, а при ошибках верхнего уровня — ошибки на весь экран. `codda build` и `codda test` такой `course.json` не пишут никогда. Zod-схема `course.json` (фича `lesson-manifest`) расширяется этими необязательными полями.
- **`codda dev`.** `fs.watch` с `recursive` по корню Course. `node_modules/`, `.codda/` и `dist/` не отслеживаются. События за ~100 мс сливаются в одну пересборку. Правка Lesson или `course.yaml` пересобирает только `course.json`. Правка `package*.json` запускает пересборку Dependency Artifact вместе с её шагом npm, перезагрузки до конца нет. Готовый UI в `dev` проверяется один раз при старте. Порт по умолчанию `4173`, занятый порт — ошибка `2`. `--port 0` берёт свободный порт (так его используют тесты), в выводе печатается настоящий URL.
- **Шаблоны.** Шаблоны Course, Lesson (`ts`, `tsx`) и CI лежат в пакете `codda` рядом с CLI и копируются с подстановкой `id`, `title` и версии Playwright.
  - `lesson.md` получает `title: <id>` и подсказку в теле.
  - Шаблон `.ts`: Starter экспортирует функцию-заглушку, Solution её реализует, в `lesson.test.ts` два теста, Starter проваливает хотя бы один.
  - Шаблон `.tsx` повторяет Spoiler из React Hooks в миниатюре: `react` + `react-dom/client` + `act`.
- **`codda init`** (решение по Q2 вопросов).
  - Только в пустой папке (разрешена `.git`). `id` — имя папки в kebab-case, `title` = `id`.
  - Создаёт `course.yaml` с одним Module «Основы» и Lesson `hello`, `package.json` (`private`, пустые `dependencies`), `.npmrc`, `.gitignore`, `hello/`.
  - В `devDependencies` добавляет `codda`. Если пакет `codda` запущен не из `node_modules` (этот репозиторий), это `file:` с относительным путём до пакета, иначе `"<версия codda>"`.
  - Затем `npm install`. Он ходит только к `file:`, а после публикации пакета — к registry из `.npmrc`.
  - С `--ci github|gitlab` кладёт `.github/workflows/codda.yml` или `.gitlab-ci.yml`.
  - Печатает созданные файлы и подсказку.
- **`codda lesson`.** `course.yaml` правится через `yaml` `parseDocument`, поэтому комментарии и форматирование сохраняются. Lesson дописывается в `lessons` последнего Module или Module с точным `title` из `--module`. Ошибки — код `1`: папка уже есть, id уже в `course.yaml`, id не в kebab-case, неизвестный Module, `--tsx` без `react` и `react-dom` в `dependencies` (с командой `npm install react react-dom @types/react @types/react-dom`).
- **Шаблоны CI** (тикет 06).
  - Шаги: `npm ci` → `npx codda test` → `npx codda build` → отдельная job выкладки, только на push в `main`. Выкладывается тот же `dist/`, без пересборки.
  - GitHub: контейнер `mcr.microsoft.com/playwright:v<версия>-noble`, `actions/upload-pages-artifact` + `actions/deploy-pages`.
  - GitLab: `image: $CODDA_IMAGE` с комментарием о Node 24 и версии Playwright. Выкладка — `aws s3 sync dist/ s3://$CODDA_S3_BUCKET/ --delete` с `AWS_ENDPOINT_URL`. Для `index.html` и `course.json` ставится `Cache-Control: no-cache`, для остального — `immutable`. Образ job'ы выкладки тоже плейсхолдер, в комментарии — требование HTTPS.
- **CI этого репозитория** (решение по Q3 вопросов).
  - Job `check` после проверок инструмента для каждой папки `courses/*` с `course.yaml` выполняет `npm ci`, `npx codda test` и `npx codda build`.
  - Выкладывается `dist/` пилотного курса. Его путь задан одной переменной в начале workflow (`courses/react-hooks`), он отдаётся из корня Pages: адрес пилота `https://dsvgit.github.io/codda/` не меняется.
  - Job `deploy` остаётся как есть.

**Коды выхода.** `0` — успех, предупреждения не влияют. `1` — ошибки курса: манифест, зависимости, вердикты Lesson, ошибки `lesson`. `2` — окружение и вызов: нет курса, нет Chromium, упала сборка UI, занят порт, неизвестная команда или флаг, `--out` без маркера, непустая папка у `init`.

## Testing Decisions

- **Хороший тест** проверяет внешнее поведение команды: запускает CLI процессом на временной копии курса и проверяет код выхода, stdout/stderr и файлы на диске. Для `dev` тест смотрит ещё ответы сервера и поведение страницы. Внутренние модули отдельно тестируются, только если через процесс дорого перебрать случаи: вердикт Lesson и отчёт (`✓/✗/⚠`, цвет).
- **Главный шов — CLI как процесс.** Тесты CLI идут в vitest в Node: в конфиге появляется отдельный node-проект рядом с текущим браузерным. Курсы-фикстуры — маленькие `.ts`-курсы без зависимостей, тест создаёт их во временной папке. Тогда `npm` не ходит в сеть, а `codda test` работает за секунды. Каждый сломанный случай делается правкой одного файла фикстуры: Solution с FAIL, Starter, который всё проходит, `throw` при импорте, `while(true){}`, ноль тестов, `fetch("https://example.com")`, невалидный `lesson.md`.
- **Курс с зависимостями** (React Hooks) проверяется не в unit-тестах, а шагом CI `npx codda test` по `courses/`: там уже есть `node_modules` и Chromium из образа.
- **`dev`** проверяется процессом с `--port 0`. Тест читает SSE-поток через `fetch` и смотрит `course.json` до и после правки файла. Страница ошибок и перезагрузка проверяются одним Playwright-тестом поверх запущенного `codda dev`.
- **Шаблоны CI**: unit-тест разбирает оба шаблона пакетом `yaml` и проверяет job'ы и шаги (тикет 06: «GitLab-шаблон — валидный YAML с ожидаемыми job'ами»). Это тест инструмента, а не проверка внутри `codda test` курса.
- **Prior art.**
  - Тест `npx codda --version` / `--bogus` из misc/03 — CLI как процесс.
  - `e2e/offline.ts` — перехват и отмена запросов на чужие origin'ы, тот же приём в проверке Chromium.
  - Проект `pages` в `playwright.config.ts` — сборка из подпути.
  - `src/runtime/runner.test.ts` — Run в Chromium.
  - `courses/courses.test.ts` — «Solution проходит тесты»; его заменяет `codda test` (тикет 03).
- **Строже PoC:** ошибки и граничные случаи каждой команды тестируются в её тикете.

## Out of Scope

- Проверка типов в `codda test` (ошибки типов Solution и Lesson Tests, предупреждения Starter) — фича `ts-tooling`, договорённость 5. Отчёт уже умеет `⚠`, `ts-tooling` только добавляет источник.
- Публикация пакета `codda`, сборка CLI в JS, отказ от самосборки UI у установленного пакета — misc/04.
- `codda ci`, `codda deps`, `--json`, `--timeout`, `--base`, каталог из нескольких курсов в одной сборке, preview-сборки на PR, кэш `.codda/` в CI, HMR в `dev`, открытие браузера из `dev`.
- Workspace после перезагрузки в `codda dev`: до фичи `course-ux` Workspace не сохраняется, и перезагрузка возвращает Starter. Это ожидаемо (тикет 05, Q14 исходил из сохранения, которое приносит `course-ux`).
- Сохранение `dist-tool/` в git и проверка «UI в пакете свежий» для опубликованного пакета — misc/04.

## Further Notes

- **Двойной `npm ci` в CI.** `npx codda` из репозитория курса требует установленного `codda`, поэтому шаблоны CI и workflow этого репозитория сначала делают `npm ci`. На свежем клоне кэша артефакта нет, и `codda test` при `CI=true` делает `npm ci` ещё раз (тикет 05, Q6; шаг npm фичи `dependency-artifacts`). Это лишние секунды, решение не пересматриваем. `npm ci` внутри `codda test` удаляет и ставит заново `node_modules/codda`, из которого запущен сам процесс. В этом репозитории это симлинк на `packages/codda`, и ничего не ломается. Для установленного пакета (misc/04) `playwright` нужно импортировать уже после шага npm. Это записано и в тикет.
- **Версия Playwright** записана в трёх местах: `playwright` в пакете `codda`, `@playwright/test` в корне и образ в `ci.yml` и шаблоне GitHub. Шаблон берёт версию из `package.json` пакета `codda` при `init`.
- **Где появляется `#/__codda-test`.** Экран Lesson и разбор фрагмента `#/<lesson id>` вводит `lesson-manifest`. Эта фича добавляет одну ветку в выборе экрана по фрагменту.
- **Подпуть в `codda test`** — `/<course id>/`. Так каждая проверка открывает сборку не из корня, как на Pages.
