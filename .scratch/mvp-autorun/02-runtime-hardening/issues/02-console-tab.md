# 02: Console студента во вкладке «Console»

**What to build:** `console.log/info/warn/error/debug` из Sandbox — код студента, Lesson Tests, предупреждения React — видны во вкладке «Console» нижней панели (между «Тесты» и «Решение»), по мере появления. На вкладке счётчик строк. Console очищается на старте каждого Run; строки, выведенные до timeout или отмены, остаются. Test Harness перехватывает console и шлёт каждую строку сообщением `codda:console`; Runner проверяет форму (ADR-0003) и отдаёт строки через `onConsole`. Лимиты — 1000 строк за Run и 10 000 символов на строку, с обеих сторон. Форматирование и лимиты — в спеке, раздел «Console в Sandbox».

**Blocked by:** `lesson-manifest` (нижняя панель экрана Lesson)

**Status:** ready-for-agent

- [ ] `run(input, { onConsole })`: `console.log("a", 1, { x: [1] })` в коде студента → строка `{ level: "log", text: 'a 1 {"x":[1]}' }`; `warn` и `error` приходят со своим `level`; `console.log(new Error("boom"))` → `Error: boom` — тест на шве Runner
- [ ] Порядок строк сохраняется; строки из Lesson Tests тоже приходят — тест
- [ ] `console.log("start"); while (true) {}` → строка `start` пришла, отчёт `timeout` — тест
- [ ] `while (true) console.log(1)` → ровно 1000 строк и одна строка `warn` про отброшенный вывод, затем `timeout`; страница отзывчива — тест
- [ ] Строка длиннее 10 000 символов обрезается — тест
- [ ] Код студента шлёт `parent.postMessage` с типом `codda:console` и верным `__coddaRunId`, но неверной формы (`text` не строка, неизвестный `level`) или с чужим `runId` → строка не доходит до `onConsole` — тест
- [ ] Строки, отправленные после отчёта, не доходят; два перекрывающихся Run получают каждый только свои строки — тест
- [ ] Экран Lesson: вкладка «Console» со счётчиком строк; `warn`/`error` выделены; новый Run очищает её; после Run открыта «Тесты» — UI-тест
- [ ] `npm run typecheck`, `npm test`, `npm run test:e2e` зелёные
