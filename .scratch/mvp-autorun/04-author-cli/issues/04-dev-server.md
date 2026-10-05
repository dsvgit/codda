# 04: `codda dev` — сервер, пересборка, перезагрузка, страница ошибок

**What to build:** Author запускает `npx codda dev [путь] [--port <n>]`, открывает напечатанный URL в Chrome и правит курс.

- Сохранение Lesson-файла или `course.yaml` пересобирает `course.json`, и открытая страница перезагружается через SSE.
- Правка `package.json` или `package-lock.json` запускает пересборку Dependency Artifact вместе с её шагом npm. Страница перезагружается только после них.
- Lesson с ошибками манифеста показывается страницей ошибок, остальные Lesson работают. Если сломан `course.yaml`, ошибки показываются на весь экран.
- Ошибки печатаются и в терминале, в формате `codda test`. Lesson Tests `dev` сам не запускает.

Спека — «`codda dev`», «`course.json` в режиме dev», «Статический сервер».

**Blocked by:** 02

**Status:** done

- [x] Сервер на `127.0.0.1`, порт по умолчанию `4173`, `--port <n>`, `--port 0` берёт свободный порт. Печатается настоящий URL, браузер не открывается. Занятый порт — ошибка и код `2`
- [x] Раздаёт сборку курса из `.codda/dev/`. В отдаваемый `index.html` сервер вставляет inline-скрипт подписки на SSE-эндпоинт. В `dist-tool/` и в `codda build` скрипта нет
- [x] `fs.watch` с `recursive` по корню Course, без `node_modules/`, `.codda/` и `dist/`. События за ~100 мс сливаются в одну пересборку, после неё одно событие `reload`
- [x] Правка `package*.json`: пересборка Dependency Artifact (с её шагом npm), `reload` — после неё. Ошибка npm или артефакта печатается в терминале, сервер продолжает работать
- [x] `course.json` в режиме dev: у Lesson с ошибками манифеста поле `errors: string[]` вместо содержимого, у сломанного `course.yaml` — `errors` верхнего уровня. Тип `CourseData` расширен этими необязательными полями (Zod-схемы у `course.json` нет: его пишет только наш `codda build`). `build` и `test` такой `course.json` не пишут (покрыто тестом `build` с ошибкой из 01)
- [x] UI: Lesson с `errors` показывается страницей «Ошибки в Lesson» со списком строк, остальные Lesson открываются как обычно. При `errors` верхнего уровня все ошибки показываются на весь экран
- [x] Ошибки манифеста печатаются в терминале при старте и после каждой пересборки. Если ошибка исправлена, сервер работает дальше без перезапуска
- [x] Ctrl+C (SIGINT) закрывает сервер и watcher, код `0`
- [x] Тесты (CLI процессом, `--port 0`): `course.json` меняется после правки `lesson.md` и приходит `reload` в SSE-потоке (`fetch`); несколько быстрых правок дают одно событие `reload`; невалидный `lesson.md` даёт `errors` у этого Lesson, остальные Lesson без изменений, процесс жив; сломанный `course.yaml` даёт `errors` верхнего уровня; занятый порт даёт код `2`. Один Playwright-тест поверх `codda dev`: страница ошибок Lesson видна, после исправления файла страница сама перезагружается и показывает Lesson
- [x] `npm run typecheck`, `npm test`, `npm run test:e2e` зелёные

## Comments

- Workspace после перезагрузки вернётся к Starter, пока фича `course-ux` не сохраняет его в `localStorage`. Это ожидаемо (Out of Scope спеки).
- **Сервер.** `serveFolder` из `cli/static-server.ts` получил опции `port` и `live`: с `live` — SSE-эндпоинт `/__codda/events` (событие `reload`) и inline-скрипт `new EventSource(…)` перед `</head>` отдаваемого `index.html` (если `</head>` нет — в конец). Второго сервера нет. `codda dev` раздаёт `.codda/dev/` с корня `/`, а не с `/<course id>/`: при сломанном `course.yaml` id неизвестен. Занятый порт — `EADDRINUSE` при `listen` → `порт N занят: укажите другой, например --port 0`, код `2`. Напечатанные строки: `Курс: http://127.0.0.1:<порт>/` и `Ctrl+C — остановить` — последними, после установки watcher и обработчика SIGINT (иначе ранний SIGINT убивал процесс с сигналом).
- **Пересборка.** Каждая пересборка — `readCourse` → временная `.codda/dev-*` → общая `assemble` (UI, `course.json`, артефакт, маркер) → замена `.codda/dev/` целиком. Dependency Artifact пересобирается **всегда**, а не только на `package*.json` (буква спеки — «только `course.json`»): его кэш в `.codda/deps/` делает правку Lesson дешёвой, а новый импорт пакета в Lesson не ломает Run. Правка `package-lock.json` промахивается мимо кэша и запускает шаг npm, `reload` — после. Пересборки идут по одной: события во время пересборки дают ещё одну после неё. Debounce 100 мс через `setTimeout`.
- **`course.json` в dev.** `readCourse` при валидном `course.yaml` (`partial`) теперь оставляет Lesson с ошибками на своём месте как `BrokenLesson` `{ id, title: id, errors }` (title — id: его источник, `lesson.md`, может быть сломан). `codda test` и `assemble` такие Lesson отбрасывают, поэтому `build`/`test` их не пишут. Верхний `errors` — все строки ошибок, если сломан `course.yaml` (тогда `id`/`title` пустые, `modules: []`), если есть ошибки курса целиком (повтор id, папка вне `course.yaml`) или если упал Dependency Artifact (тогда `modules: []`, `deps: null`).
- **Терминал.** Как в `codda test`: ошибки курса и `✗ <id>` с ошибками Lesson — в stdout, ошибки сломанного `course.yaml` и артефакта — в stderr. После пересборки без ошибок — `Курс собран без ошибок`.
- **UI.** `App` показывает `Ошибки в курсе` на весь экран при верхнем `errors` и `Ошибки в Lesson <id>` со списком строк вместо экрана Lesson. Тип `CourseData`: `errors?` и lessons `LessonData | BrokenLesson`; e2e, читающие `course.json` сборки, приводят Lesson к `LessonData`.
- **Отложено (правило 7):** в полном `npm test` локально 1 из 3 прогонов падал тест `codda test` «from a Lesson folder… a foreign request is its error» (author-cli/03): запрос на чужой адрес не попал в ошибки. Тест — `test.skip`, запись в «Отложенные проблемы» README.
- **Тесты.** `cli/dev-command.test.ts` (10 тестов процессом, `--port 0`, SSE через `fetch`), 2 теста в `src/App.test.tsx`, Playwright `e2e/codda-dev.e2e.ts`. Красными увидены: первый тест `dev-command` (нет команды `dev`), вставка скрипта (у заглушки UI нет `</head>`), SIGINT (код `null` — обработчик ставился после URL), оба теста `App`. **После кода, зелёными сразу** (реализация `codda dev` была написана целиком на первом срезе): несколько правок → один `reload`, ошибки `lesson.md`, ошибки при старте, сломанный `course.yaml`, занятый порт, оба теста `package*.json`, Playwright-тест (UI к нему уже был сделан по красным тестам `App`).
- Ручная проверка: `npx codda dev --port 0` в `courses/react-hooks` — `course.json` и `deps/<hash>/importmap.json` отдаются (200), SIGINT закрывает.
