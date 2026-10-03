# 09: Type Checker: поведение в редакторе

Type: grilling
Status: open
Blocked by: None

## Question

Research (тикет «TypeScript language service в Web Worker для CodeMirror 6 без сети») рекомендует отдельный Worker «Type Checker» на TS 6 + `@typescript/vfs`. Подтвердить вариант и решить продуктовые вопросы, которые research оставил человеку:

- Блокирует ли Run ошибка типов, или Run работает всегда, а ошибки только подсвечиваются.
- Общий `target` для Type Checker и Compiler: поднять LS до `ESNext` или задать esbuild `target: "es2022"`.
- Холодный старт 1–2 с и ~1.1 МБ загрузки: грузить Type Checker сразу при открытии Lesson или лениво после первого ввода; что видит студент, пока он не готов.
- Что входит в MVP: diagnostics и autocomplete (hover и форматирование — «MVP, часть 2»).
