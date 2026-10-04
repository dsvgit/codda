# 02: `codda test` проверяет весь Course в Chromium

**What to build:** Author запускает `npx codda test` и узнаёт, правилен ли каждый Lesson. Порядок шагов:

1. Проверяется манифест.
2. Собирается Dependency Artifact, с шагом npm фичи `dependency-artifacts`.
3. Курс собирается, как в `codda build`, в `.codda/test/` и раздаётся сервером на `127.0.0.1` со случайным портом по подпути `/<course id>/`.
4. Полный Chromium через Playwright открывает служебную страницу `#/__codda-test`. Node вызывает на ней прогревочный Run, а затем Run для Solution и Starter каждого Lesson тем же Runtime, с лимитом 5 с.

По каждому Lesson печатается строка `✓` / `✗` / `⚠` с ошибками под ней, в конце итоговая строка. Код выхода `0` или `1`. Спека — «Статический сервер», «Служебная страница прогонов», «Проверка в Chromium», «Вердикт Lesson», «Отчёт `codda test`».

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Статический сервер на `node:http`: только `127.0.0.1`, порт `0` (случайный), отдаёт папку под подпутём, `.wasm` с `application/wasm`, вне подпути — 404
- [ ] Служебная страница: на фрагменте `#/__codda-test` UI вместо экрана Lesson загружает `course.json` и выставляет `warmUp()` и `run(lessonId, "solution" | "starter") → Test Report`. Путь «Lesson → вход Compiler» — тот же, что у кнопки «Запустить тесты», без копии. Ссылок на страницу в UI нет
- [ ] Chromium запускается с `channel: "chromium"` (полный, не headless shell). Сначала прогрев, потом Lesson по порядку `course.yaml`. Для каждого: Solution, затем Starter, если Solution прошёл
- [ ] Вердикт — чистая функция с unit-тестом на все случаи. Solution: вид `tests`, ≥1 тест, все PASS. Starter: вид `tests`, ≥1 FAIL, иначе «Starter уже проходит все тесты». `compile-error` / `runtime-error` / `timeout`, а также `cancelled` и `internal-error` из `runtime-hardening` — ошибка для обоих, текст ошибки и файл (`<lesson>/solution.ts`, `<lesson>/main.ts`) в строке
- [ ] Ошибки манифеста печатаются все сразу в формате `<файл>: <путь к полю>: <сообщение>`. Lesson с ошибкой получает `✗` и в Chromium не проверяется, остальные проверяются. Если упала сборка Dependency Artifact, строк Lesson нет, код `1`
- [ ] Вывод: строка зависимостей, одна строка на Lesson с ошибками под ней с отступом, итог `N из M Lesson прошли[, K предупреждений]`. Модуль отчёта умеет `⚠` (предупреждения не меняют код выхода), это покрыто unit-тестом. Цвета в этом тикете нет, только текст
- [ ] Код `0`, если ошибок нет, иначе `1`. Браузер и сервер закрываются в любом исходе, и после выхода процесса не остаётся ни одного дочернего процесса
- [ ] Тесты (CLI процессом на фикстуре `.ts`-курса из 01): все Lesson ✓ (код `0`); Solution с FAIL; Solution с нулём тестов; Starter, который проходит всё; Starter с `throw` при импорте; Solution с `while(true){}` (timeout, тест укладывается в разумное время); compile-error в Starter; невалидный `lesson.md` у одного Lesson при валидных остальных
- [ ] `npx codda test` в `courses/react-hooks` проходит локально: все 5 Lesson ✓
- [ ] `npm run typecheck`, `npm test`, `npm run test:e2e` зелёные

## Comments

- Импорт `playwright` в CLI делается после шага npm, а не при запуске: `npm ci` переустанавливает `node_modules` (Further Notes спеки).
