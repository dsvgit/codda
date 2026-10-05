# 03: Autocomplete от TypeScript

**What to build:** студент набирает `useSta` и видит в списке `useState` с видом «функция» и короткой сигнатурой. После `document.` или `items.` видит члены объекта. По Ctrl/Cmd+Space список открывается в любом месте кода. Источник один — TS через Type Checker (`autocompletion({ override: [tsSource] })` из `@codemirror/autocomplete`), keyword-completion `lang-javascript` не смешивается. Без JSDoc, auto-import и signature help (ADR-0009, Q7 тикета 09). Подробности — «Ядро проверки типов» и «Обвязка CodeMirror» в [spec.md](../spec.md).

**Blocked by:** 01

**Status:** done

- [x] `@codemirror/autocomplete` — явная зависимость в версии, которая уже стоит через `codemirror`
- [x] e2e: набор `useSta` в Lesson React Hooks показывает `useState` с `detail`. Выбор Enter заменяет набранный префикс, а не дописывается к нему
- [x] e2e: после `document.` в списке есть `querySelector`. После `.` у массива — `map` и `toSorted` (`ESNext`)
- [x] e2e: Ctrl/Cmd+Space открывает список без набора
- [x] e2e: в списке нет дублей (одна метка — один пункт), то есть keyword-completion `lang-javascript` отключён
- [x] e2e: внутри строки и комментария список не появляется
- [x] e2e: при недоступном Type Checker (lib JSON оборван через `page.route`) набор работает, список не появляется, ошибок в консоли страницы нет
- [x] e2e: auto-import не происходит. Выбор подсказки ничего не дописывает в импорты
- [x] Read-only редактор вкладки «Решение» подсказок не даёт
- [x] Unit-тест ядра: `kind` TS переводится в `type` CodeMirror (функция, переменная, свойство, метод, ключевое слово, класс, интерфейс/тип); неизвестный `kind` даёт пункт без `type`

## Comments

- Ядро (`src/type-checker/core.ts`) — операция `completions(name, pos)` → `{ from, to, items: { label, type?, detail? }[] }`. `getCompletionsAtPosition` с `includeCompletionsForModuleExports: false`; `from` — `optionalReplacementSpan` (начало набранного идентификатора), без него — позиция курсора. `kind` TS → `type` CodeMirror таблицей (функция, переменная, свойство, метод, ключевое слово, класс, интерфейс, тип); прочие (`module`, `string`, `enum` …) — без `type`.
- Импортированное имя у TS — `alias` (`useState` из `import { useState }`). Его `type` берётся из первого ключевого слова сигнатуры (`(alias) function useState…` → `function`).
- `detail` — `displayParts` из `getCompletionEntryDetails`: первая строка, без префикса вида `(method) `. Детали запрашиваются по одной, ~2 мс каждая, а без префикса у глобальной области больше 1000 пунктов. Поэтому детали считаются только для пунктов, которые начинаются с набранного префикса (без учёта регистра), не больше 50 на список. У остальных пунктов `detail` нет. `validFor` у результата нет: каждый набранный символ запрашивает список заново, поэтому детали догоняют сужающийся префикс.
- Строка и комментарий — внутренние `ts.isInString` / `ts.isInComment` из модуля `typescript-6`. Их нет в публичных типах, но они есть в модуле: ими пользуются сами completions TS. Версия зафиксирована точно (`6.0.3`), unit-тест ловит поломку. Без проверки TS отдаёт в строке подсказки строковых литералов: имена тегов в `querySelector("di")`. Подстановка `${…}` в шаблоне считается кодом.
- Клиент: `completions(file, text, pos)` → `Completions | undefined`. `undefined` приходит в `unavailable`, в том числе на запрос в полёте, когда Worker падает. Запросы обоих видов идут через общий `ask`. Worker отвечает `{ type: "completions", id, completions }`.
- Редактор: `autocompletion({ override: [source] })` у Workspace. Read-only «Решение» и любой редактор без `complete` получают `override: []`, то есть источников нет вовсе: `basicSetup` иначе подключает keyword/local completion `lang-javascript`. При наборе источник спрашивает TS только после символа слова или `.`, по Ctrl+Space — всегда. Пустой ответ — `null`, списка нет.
- Ctrl+Space — привязка `completionKeymap` CodeMirror (`Ctrl-Space`, на macOS тоже Control). Cmd+Space в macOS занят Spotlight и до браузера не доходит, отдельной привязки нет.
- e2e — `e2e/autocomplete.e2e.ts` (8 тестов). Тесты Ctrl+Space и недоступного Type Checker сначала проходили на подсказках `lang-javascript`, поэтому их усилили: глобал `AbortController` из lib-файлов TS и локальное `items`, которое `lang-javascript` показал бы.
- Проверки: `npm run typecheck` зелёный; `npm test` — 220 passed, 1 skipped (без `CI=true`, load average ~3); `npm run test:e2e` — 43 passed.
