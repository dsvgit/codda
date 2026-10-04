# 04: Ошибка компиляции в Workspace — строка и подчёркивание

**What to build:** ошибка компиляции получает `Строка N:M — сообщение`, только если она в файле Workspace, и подчёркивается в редакторе до следующей правки или Run. Ошибка компиляции в Lesson Tests (например, студент переименовал экспорт) показывается без строки, а не строкой в файле, которого студент не видит. Строка берётся из `location` esbuild, source map не нужен. Runtime-ошибка показывает только сообщение: stack бандла уходит из публичного Test Report и из UI. Подчёркивание — через `@codemirror/lint`. Строка runtime-ошибки и проваленного теста (source maps) — «MVP, часть 2», решение Q11/Q13 [раундов 2–3](../../questions/00-mvp-autorun.md). Детали — в спеке, разделы «Форма Test Report», «Ошибки компиляции», «Подчёркивание в редакторе».

**Blocked by:** `lesson-manifest` (вкладка «Тесты», Compiler отдаёт Workspace как `./main`)

**Status:** done

- [x] Ошибка компиляции в Workspace → `line/column` (1-based) этой строки Workspace — тест на шве Runner
- [x] Ошибка с `location` в Lesson Tests (`No matching export in "main" for import "add"` после переименования экспорта) → без `line/column` — тест
- [x] `throw new Error("boom")` в коде студента → `{ kind: "runtime-error", message: "boom" }`, поля `stack` в отчёте нет — тест
- [x] Экран Lesson: ошибка компиляции подчёркнута в редакторе (`@codemirror/lint`, от позиции до конца строки); подчёркивание снимается на первой правке и на старте Run; ошибка без строки не подчёркивает ничего — UI-тест
- [x] Экран Lesson: `runtime-error` показывает «Ошибка выполнения» и сообщение, без stack — UI-тест
- [x] Новая зависимость — только `@codemirror/lint` (в версии, которая уже стоит через `codemirror`)
- [x] `npm run typecheck`, `npm test`, `npm run test:e2e` зелёные

## Comments

- **Workspace в Compiler** резолвится в `{ path: "/main", namespace: "file" }` (остальные виртуальные файлы — по-прежнему `codda`), `absWorkingDir: "/"`. Так esbuild называет его просто `main`: и в `location.file` (по нему ошибка отличается от ошибок Lesson Tests), и в тексте — `No matching export in "main" for import "add"`, как в тикете. В прежнем namespace текст был `"codda:./main"`.
- `line/column` — только у ошибок с `location.file === "main"`; ошибка в Lesson Tests приходит одним `message`.
- `runtime-error` — `{ kind, message }`: Test Harness шлёт `message` у `Error` (было `String(err)`, то есть `Error: boom`) и не шлёт `stack`; поле убрано из типа и из проверки формы в Runner. Экран показывает сообщение в `<p>`, правило `.report pre` удалено.
- Подчёркивание: `Editor` получает проп `errors` (`CompileError[]`) и отдаёт их в `setDiagnostics` `@codemirror/lint` (от позиции до конца строки, ошибки без строки пропускаются). Экран Lesson держит их в состоянии: ставит из отчёта `compile-error`, сбрасывает на старте Run и в `onChange` редактора (константа `NO_ERRORS`, чтобы набор текста не перерисовывал диагностики). Отдельного `linter()` нет: `setDiagnostics` включает расширение сам; `ts-tooling/01` добавит второй источник.
- `@codemirror/lint@^6.9.7` — уже стоял через `codemirror`, теперь прямая зависимость пакета `codda`; в lock-файле одна строка.
- **Тесты после кода (честно):** UI-тесты «runtime-error без stack» и «ошибка в Lesson Tests без строки и без подчёркивания» были зелёными при первом запуске — их поведение уже дал срез Runner (там те же случаи видены красными). Тест «подчёркивание снимается на старте Run» проверен красным, временно убрав сброс.
- Граничные случаи не проверялись: ошибка в самом конце строки даёт пустой диапазон (видна только иконка в gutter, если она есть); несколько ошибок в Workspace — каждая подчёркнута, отдельного теста нет.
