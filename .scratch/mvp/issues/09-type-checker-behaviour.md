# 09: Type Checker: поведение в редакторе

Type: grilling
Status: resolved
Blocked by: None

## Question

Research (тикет «TypeScript language service в Web Worker для CodeMirror 6 без сети») рекомендует отдельный Worker «Type Checker» на TS 6 + `@typescript/vfs`. Подтвердить вариант и решить продуктовые вопросы, которые research оставил человеку:

- Блокирует ли Run ошибка типов, или Run работает всегда, а ошибки только подсвечиваются.
- Общий `target` для Type Checker и Compiler: поднять LS до `ESNext` или задать esbuild `target: "es2022"`.
- Холодный старт 1–2 с и ~1.1 МБ загрузки: грузить Type Checker сразу при открытии Lesson или лениво после первого ввода; что видит студент, пока он не готов.
- Что входит в MVP: diagnostics и autocomplete (hover и форматирование — «MVP, часть 2»).

Вопросы и ответы: [questions/09-type-checker-behaviour.md](../questions/09-type-checker-behaviour.md)

## Answer

Решение — [ADR-0009](../../../docs/adr/0009-type-checker-ts6-separate-worker.md), детали — в разделе «Общий итог» файла вопросов.

- Вариант B из research: отдельный Worker на `"typescript-6": "npm:typescript@6.0.3"` + `@typescript/vfs`, без CDN и ATA, своя обвязка CM6, узкий интерфейс под будущий TS 7.
- Ошибки типов Run не блокируют; Lesson засчитывается по Lesson Tests.
- Один модуль конфига для Compiler, Type Checker и `codda test`, `target`/`lib` — `ESNext`.
- Один воркер на сессию, старт после первой отрисовки; до готовности и при отказе редактор и Run работают, во вкладке «Проблемы» — статус.
- Только ошибки (без suggestions и `noUnused*`), debounce ~300 мс, английские сообщения с кодом `TSxxxx`.
- Autocomplete только от TS; auto-import, signature help, JSDoc — «MVP, часть 2».
