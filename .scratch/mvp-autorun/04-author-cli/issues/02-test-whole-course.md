# 02: `codda test` проверяет весь Course в Chromium

**What to build:** Author запускает `npx codda test` и узнаёт, правилен ли каждый Lesson. Порядок шагов:

1. Проверяется манифест.
2. Собирается Dependency Artifact, с шагом npm фичи `dependency-artifacts`.
3. Курс собирается, как в `codda build`, в `.codda/test/` и раздаётся сервером на `127.0.0.1` со случайным портом по подпути `/<course id>/`.
4. Полный Chromium через Playwright открывает служебную страницу `#/__codda-test`. Node вызывает на ней прогревочный Run, а затем Run для Solution и Starter каждого Lesson тем же Runtime, с лимитом 5 с.

По каждому Lesson печатается строка `✓` / `✗` / `⚠` с ошибками под ней, в конце итоговая строка. Код выхода `0` или `1`. Спека — «Статический сервер», «Служебная страница прогонов», «Проверка в Chromium», «Вердикт Lesson», «Отчёт `codda test`».

**Blocked by:** 01

**Status:** done

- [x] Статический сервер на `node:http`: только `127.0.0.1`, порт `0` (случайный), отдаёт папку под подпутём, `.wasm` с `application/wasm`, вне подпути — 404
- [x] Служебная страница: на фрагменте `#/__codda-test` UI вместо экрана Lesson загружает `course.json` и выставляет `warmUp()` и `run(lessonId, "solution" | "starter") → Test Report`. Путь «Lesson → вход Compiler» — тот же, что у кнопки «Запустить тесты», без копии. Ссылок на страницу в UI нет
- [x] Chromium запускается с `channel: "chromium"` (полный, не headless shell). Сначала прогрев, потом Lesson по порядку `course.yaml`. Для каждого: Solution, затем Starter, если Solution прошёл
- [x] Вердикт — чистая функция с unit-тестом на все случаи. Solution: вид `tests`, ≥1 тест, все PASS. Starter: вид `tests`, ≥1 FAIL, иначе «Starter уже проходит все тесты». `compile-error` / `runtime-error` / `timeout`, а также `cancelled` и `internal-error` из `runtime-hardening` — ошибка для обоих, текст ошибки и файл (`<lesson>/solution.ts`, `<lesson>/main.ts`) в строке
- [x] Ошибки манифеста печатаются все сразу в формате `<файл>: <путь к полю>: <сообщение>`. Lesson с ошибкой получает `✗` и в Chromium не проверяется, остальные проверяются. Если упала сборка Dependency Artifact, строк Lesson нет, код `1`
- [x] Вывод: строка зависимостей, одна строка на Lesson с ошибками под ней с отступом, итог `N из M Lesson прошли[, K предупреждений]`. Модуль отчёта умеет `⚠` (предупреждения не меняют код выхода), это покрыто unit-тестом. Цвета в этом тикете нет, только текст
- [x] Код `0`, если ошибок нет, иначе `1`. Браузер и сервер закрываются в любом исходе, и после выхода процесса не остаётся ни одного дочернего процесса
- [x] Тесты (CLI процессом на фикстуре `.ts`-курса из 01): все Lesson ✓ (код `0`); Solution с FAIL; Solution с нулём тестов; Starter, который проходит всё; Starter с `throw` при импорте; Solution с `while(true){}` (timeout, тест укладывается в разумное время); compile-error в Starter; невалидный `lesson.md` у одного Lesson при валидных остальных
- [x] `npx codda test` в `courses/react-hooks` проходит локально: все 5 Lesson ✓
- [x] `npm run typecheck`, `npm test`, `npm run test:e2e` зелёные

## Comments

- Импорт `playwright` в CLI делается после шага npm, а не при запуске: локально без `node_modules` шаг npm их ставит (Further Notes спеки).
- **Сделано.** `codda test [путь]`: манифест → Dependency Artifact → сборка курса тем же `assemble`, что у `codda build`, во временную `.codda/test-*` и замена `.codda/test/` → `cli/static-server.ts` (`node:http`, `127.0.0.1`, порт `0`, подпуть `/<course id>/`, `.wasm` — `application/wasm`, вне подпути и за пределами папки — 404) → Playwright `chromium.launch({ channel: "chromium" })`, одна страница `#/__codda-test` на все Lesson, `warmUp()`, затем Solution и (если Solution прошёл) Starter по порядку `course.yaml`. Браузер и сервер закрываются в `finally`; что дочерних процессов после выхода нет, проверено руками (`ps` после `npx codda test`), отдельного теста нет.
- **Служебная страница** — ветка в `src/main.tsx`: на `#/__codda-test` после загрузки `course.json` в `window.__codda` кладутся `warmUp()` (Run пустого кода, без `importMap`) и `run(lessonId, which)`. Путь «Lesson → Compiler» вынесен из `onRun` экрана в `runLesson()` (`src/App.tsx`), им пользуются и кнопка, и страница. На экране — строка «Служебная страница codda test».
- **Вердикт** — `cli/verdict.ts`, **отчёт** — `cli/report.ts` (`formatLesson`, `formatSummary` с русским склонением «предупреждение/-я/-й»), оба с unit-тестами. Тексты: `<lesson>/solution.ts: тест «<имя>» не прошёл: <ошибка>`, `…: в Lesson Tests нет ни одного теста`, `<lesson>/main.ts: Starter уже проходит все тесты`, `…: [строка N: ]ошибка компиляции: …`, `…: ошибка при выполнении: …`, `…: тесты не завершились за 5 с`, `…: Run отменён`, `…: внутренняя ошибка: …`.
- **Ошибки манифеста.** `readCourse` при ошибках отдаёт ещё `partial`, если сам `course.yaml` валиден: курс только с исправными Lesson, ошибки каждого Lesson (сюда же `course.yaml: …: нет папки урока <id>`) и ошибки «ничьи» (повтор id, папка не в `course.yaml`). «Ничьи» печатаются в начале отчёта, Lesson проверяются, код `1`. Если невалиден `course.yaml` или упал Dependency Artifact — ошибки в stderr, строк Lesson нет, код `1`. У курса без пакетов строка зависимостей — `Зависимости: нет`.
- **Обход (правило 6):** сканер импортов Dependency Artifact (`entryPoints` в `dependency-artifact.ts`) падал процессом на синтаксической ошибке в файле Lesson — теперь ошибка esbuild глотается, импорты разобранных файлов собираются как раньше, а саму ошибку показывает Run (`compile-error`). Заодно `codda build` больше не падает со стеком на сломанном Starter.
- Сбой Playwright/страницы (не загрузился `course.json`, упал браузер) — одна строка `codda: не удалось проверить курс в Chromium: …`, код `2`; тестом не покрыто. Нет Chromium, цвет, путь к папке Lesson — тикет 03 (сейчас путь к Lesson проверяет весь курс).
- `playwright` перенесён в `dependencies` пакета `codda` (та же версия 1.63.0); `package-lock.json` корня и `courses/react-hooks` обновлены `npm install --offline`.
- **Тесты CLI** (`cli/test-command.test.ts`) берут настоящий `dist-tool/` и сами пересобирают его, если он устарел (в CI его ещё нет на шаге `npm test` — проверено удалением `dist-tool/`, ~13 с на файл). Все сломанные случаи — один курс из 9 Lesson в одном процессе (один запуск Chromium); Lesson с `while(true){}` стоит последним — Run после бесконечного цикла флейкует («Отложенные проблемы» README). `npx codda test` в `courses/react-hooks`: 5 из 5 ✓, ~7 с.
- **Тесты после кода:** «упал Dependency Artifact» и «невалиден `course.yaml`» в `test-command.test.ts` и случай `%E0` в `static-server.test.ts` написаны после кода и сразу зелёные (кроме первой версии теста артефакта, где TS выкинул неиспользуемый импорт). Остальные тесты увидены красными.

