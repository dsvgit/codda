# 04: Ошибка компиляции в Workspace — строка и подчёркивание

**What to build:** ошибка компиляции получает `Строка N:M — сообщение`, только если она в файле Workspace, и подчёркивается в редакторе до следующей правки или Run. Ошибка компиляции в Lesson Tests (например, студент переименовал экспорт) показывается без строки, а не строкой в файле, которого студент не видит. Строка берётся из `location` esbuild, source map не нужен. Runtime-ошибка показывает только сообщение: stack бандла уходит из публичного Test Report и из UI. Подчёркивание — через `@codemirror/lint`. Строка runtime-ошибки и проваленного теста (source maps) — «MVP, часть 2», решение Q11/Q13 [раундов 2–3](../../questions/00-mvp-autorun.md). Детали — в спеке, разделы «Форма Test Report», «Ошибки компиляции», «Подчёркивание в редакторе».

**Blocked by:** `lesson-manifest` (вкладка «Тесты», Compiler отдаёт Workspace как `./main`)

**Status:** ready-for-agent

- [ ] Ошибка компиляции в Workspace → `line/column` (1-based) этой строки Workspace — тест на шве Runner
- [ ] Ошибка с `location` в Lesson Tests (`No matching export in "main" for import "add"` после переименования экспорта) → без `line/column` — тест
- [ ] `throw new Error("boom")` в коде студента → `{ kind: "runtime-error", message: "boom" }`, поля `stack` в отчёте нет — тест
- [ ] Экран Lesson: ошибка компиляции подчёркнута в редакторе (`@codemirror/lint`, от позиции до конца строки); подчёркивание снимается на первой правке и на старте Run; ошибка без строки не подчёркивает ничего — UI-тест
- [ ] Экран Lesson: `runtime-error` показывает «Ошибка выполнения» и сообщение, без stack — UI-тест
- [ ] Новая зависимость — только `@codemirror/lint` (в версии, которая уже стоит через `codemirror`)
- [ ] `npm run typecheck`, `npm test`, `npm run test:e2e` зелёные
