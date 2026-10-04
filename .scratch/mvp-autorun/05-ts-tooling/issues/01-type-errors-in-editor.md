# 01: Ошибки типов подчёркиваются в редакторе Workspace

**What to build:** самый тонкий сквозной путь Type Checker. Студент открывает Lesson, пишет `setOpen("yes")` при `useState(false)` и через ~300 мс после остановки набора видит красное подчёркивание. Наведение показывает `Argument of type 'string' is not assignable … (TS2345)`. Под капотом общий модуль конфига TS (ADR-0009), ядро проверки типов на `typescript-6` + `@typescript/vfs`, отдельный Web Worker с lib-файлами TS из JSON с нашего origin и `types.json` Dependency Artifact Course, `linter` из `@codemirror/lint`. Compiler переходит на тот же модуль конфига. Run от Type Checker не зависит. Вкладка «Проблемы» и статусы — тикет 02, autocomplete — тикет 03. Подробности — раздел «Модули» в [spec.md](../spec.md).

**Blocked by:** фича `lesson-manifest` (экран Lesson с редактором Workspace и вкладкой «Решение»), фича `dependency-artifacts` (`types.json` в `deps/<hash>/`)

**Status:** done

- [x] В зависимостях пакета `codda`: `"typescript-6": "npm:typescript@6.0.3"`, `@typescript/vfs`, `@codemirror/lint` (в версии, которая уже стоит через `codemirror`). `typescript@^7` и `tsc -b` не тронуты, `npm run typecheck` зелёный
- [x] Один модуль конфига TS по ADR-0009 (`ESNext` + `DOM` + `DOM.Iterable`, `react-jsx`, `strict`, `isolatedModules`, `bundler`, `skipLibCheck`, `types: []`, без `noUnused*`). Импортируется и из Worker, и из Node без сборки
- [x] Compiler берёт `jsx` и `target` из этого модуля. Существующие тесты Runner и e2e зелёные
- [x] Compiler выбирает loader по расширению (`.ts` → `ts`, `.tsx` → `tsx`) для Workspace и Lesson Tests. Тест Runner: в `main.ts` компилируются `<T>(x: T) => x` и `<number>value`, в `main.tsx` JSX по-прежнему работает
- [x] lib-файлы TS (только нужные по конфигу) отдаются одним JSON с content-hash в имени из сборки UI и из dev-сервера, версия — из `typescript-6`
- [x] Type Checker — отдельный Web Worker. Читает lib JSON и `types.json` из папки `deps` в `course.json`, той же, что у Compiler. Создаётся один раз на сессию, вне компонента редактора
- [x] e2e (фикстура `offline`): ошибка типа подчёркивается, у подсказки при наведении сообщение и код `(TS2345)`; внешних запросов ноль
- [x] e2e: Solution Lesson React Hooks, вставленная в редактор, не даёт ни одного подчёркивания (типы `react`, `react-dom/client` и JSX резолвятся из `types.json`)
- [x] e2e: синтаксическая ошибка (`return a +;`) подчёркивается с кодом TS
- [x] e2e: только ошибки. Неиспользуемая переменная и неиспользуемый импорт в Starter не подчёркиваются
- [x] e2e: `[3, 1, 2].toSorted()` и `Object.groupBy(...)` не подчёркиваются, и Run с ними проходит (общий `ESNext` у Compiler и Type Checker)
- [x] Course без Dependency Artifact (`deps: null` в `course.json`): Type Checker работает только с lib-файлами, `types.json` не запрашивается, ошибка в коде подчёркивается (тест — на курсе-фикстуре с `.ts`-Lesson без импортов)
- [x] e2e: импорт пакета, которого нет в Course, подчёркивается как `Cannot find module` (TS2307)
- [x] e2e: Run с ошибкой типов в коде выполняет тесты и даёт обычный Test Report (Run не блокируется)
- [x] Подчёркивание ошибки компиляции из `runtime-hardening/04` продолжает работать рядом с ошибками типов: два источника диагностик в одном редакторе не затирают друг друга (тест)
- [x] Debounce ~300 мс (`linter` с `delay: 300`). После исправления подчёркивание исчезает
- [x] Read-only редактор вкладки «Решение» не подчёркивает ничего
- [x] Unit-тесты ядра: сообщение из цепочки `messageText` склеено; `line`/`column` 1-based на многострочном коде; Lesson со Starter `main.ts` (без JSX) проверяется

## Comments

- Конфиг TS — `packages/codda/src/ts-config.ts` (`TS_COMPILER_OPTIONS`, tsconfig-JSON, без импортов). Compiler передаёт его в esbuild как `tsconfigRaw` и `target` (`esnext`), loader — по `sourceName`/`testsName` (`.ts` → `ts`, иначе `tsx`); Test Harness и точка входа — `ts`. Чтобы Compiler знал расширение Lesson Tests, в `LessonData` (`course.json`) добавлено поле `testsName`; в `CompileInput` `sourceName`/`testsName` необязательны, без них — `tsx`, как в PoC.
- lib-файлы — `cli/ts-lib.ts`: имена из `lib` конфига через `convertCompilerOptionsFromJson` TS 6 плюс все `/// <reference lib>` транзитивно, файлы — из папки пакета `typescript-6`. Плагин `codda-ts-lib` в `vite.config.ts` кладёт их в `assets/ts-lib-<hash8>.json` при сборке и отдаёт тот же JSON middleware'ом в dev; путь странице — через `define` `__CODDA_TS_LIB__` (относительный в сборке — работает с подпути `/codda/`).
- Ядро — `src/type-checker/core.ts` (`createTypeEnvironment(ts, files)` → `setFile`, `errors`), `ts` всегда передаётся явно. Worker — `type-checker.worker.ts`, клиент — `client.ts` (синглтон модуля, вне React; `failed` или `error` у Worker — все ответы пустые, без повторов). Autocomplete и удаление старого файла при смене расширения — тикеты 03 и 02.
- Type Checker стартует первым вызовом linter'а — через 300 мс после создания редактора Workspace, то есть после первой отрисовки; отдельного эффекта нет.
- Два источника диагностик — два `linter()`: ошибки компиляции стали lint-источником (вместо `setDiagnostics`), обновляются транзакцией с `userEvent` и `forceLinting`. Без `forceLinting` общая задержка (`delay` у `@codemirror/lint` — максимум по всем linter'ам, 300 мс) не давала подчёркиванию компиляции исчезнуть на старте Run (тест `App.test.tsx` «goes away when the next Run starts» это поймал).
- Заглушка `any` в `types.json` для пакета без типов изменена на shorthand ambient module `declare module "<specifier>";` (`PIPELINE_VERSION` = 3): с прежней `declare const m: any; export = m;` TS 6 даёт TS2305 на именованный импорт (`import { useState } from "react"` в курсе-фикстуре без `@types/react`). Unit-тест ядра это проверяет.
- `App.test.tsx` прогоняется без Type Checker: lib JSON на весь файл отклоняется командой `failRequests`, Type Checker `unavailable`. Иначе синтаксическая ошибка подчёркивалась ещё и как TS1109 и тесты подчёркивания компиляции не отличали источники; типы проверяет e2e (спека: компонентному тесту Type Checker не нужен).
- `golden-path.e2e.ts`: в ожидаемых запросах `deps/` добавлен `types.json` (Type Checker, один раз за сессию).
- Course без Dependency Artifact в e2e — `course.json` подменяется `page.route` (Lesson `.ts` без импортов), а не отдельный курс на диске: Course Build для e2e один.
- Дополнительно e2e: один Worker Type Checker на сессию при переходе к другому Lesson (пересоздание редактора его не перезапускает) — пересекается с тикетом 02, там добавятся счётчики запросов lib JSON и `types.json`.
- Проверки: `npm run typecheck` зелёный, `npm test` — 212 passed, 1 skipped; `npm run test:e2e` — 26 passed.
