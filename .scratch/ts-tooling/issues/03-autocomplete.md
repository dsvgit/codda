# 03: Autocomplete от TypeScript

**What to build:** студент набирает `useSta` и видит в списке `useState` с видом «функция» и короткой сигнатурой. После `document.` или `items.` видит члены объекта. По Ctrl/Cmd+Space список открывается в любом месте кода. Источник один — TS через Type Checker (`autocompletion({ override: [tsSource] })` из `@codemirror/autocomplete`), keyword-completion `lang-javascript` не смешивается. Без JSDoc, auto-import и signature help (ADR-0009, Q7 тикета 09). Подробности — «Ядро проверки типов» и «Обвязка CodeMirror» в [spec.md](../spec.md).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `@codemirror/autocomplete` — явная зависимость в версии, которая уже стоит через `codemirror`
- [ ] e2e: набор `useSta` в Lesson React Hooks показывает `useState` с `detail`. Выбор Enter заменяет набранный префикс, а не дописывается к нему
- [ ] e2e: после `document.` в списке есть `querySelector`. После `.` у массива — `map` и `toSorted` (`ESNext`)
- [ ] e2e: Ctrl/Cmd+Space открывает список без набора
- [ ] e2e: в списке нет дублей (одна метка — один пункт), то есть keyword-completion `lang-javascript` отключён
- [ ] e2e: внутри строки и комментария список не появляется
- [ ] e2e: при недоступном Type Checker (lib JSON оборван через `page.route`) набор работает, список не появляется, ошибок в консоли страницы нет
- [ ] e2e: auto-import не происходит. Выбор подсказки ничего не дописывает в импорты
- [ ] Read-only редактор вкладки «Решение» подсказок не даёт
- [ ] Unit-тест ядра: `kind` TS переводится в `type` CodeMirror (функция, переменная, свойство, метод, ключевое слово, класс, интерфейс/тип); неизвестный `kind` даёт пункт без `type`

## Comments
