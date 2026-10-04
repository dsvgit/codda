# 01: Ошибки типов подчёркиваются в редакторе Workspace

**What to build:** самый тонкий сквозной путь Type Checker. Студент открывает Lesson, пишет `setOpen("yes")` при `useState(false)` и через ~300 мс после остановки набора видит красное подчёркивание. Наведение показывает `Argument of type 'string' is not assignable … (TS2345)`. Под капотом общий модуль конфига TS (ADR-0009), ядро проверки типов на `typescript-6` + `@typescript/vfs`, отдельный Web Worker с lib-файлами TS из JSON с нашего origin и `types.json` Dependency Artifact Course, `linter` из `@codemirror/lint`. Compiler переходит на тот же модуль конфига. Run от Type Checker не зависит. Вкладка «Проблемы» и статусы — тикет 02, autocomplete — тикет 03. Подробности — раздел «Модули» в [spec.md](../spec.md).

**Blocked by:** фича `lesson-manifest` (экран Lesson с редактором Workspace и вкладкой «Решение»), фича `dependency-artifacts` (`types.json` в `deps/<hash>/`)

**Status:** ready-for-agent

- [ ] В зависимостях пакета `codda`: `"typescript-6": "npm:typescript@6.0.3"`, `@typescript/vfs`, `@codemirror/lint` (в версии, которая уже стоит через `codemirror`). `typescript@^7` и `tsc -b` не тронуты, `npm run typecheck` зелёный
- [ ] Один модуль конфига TS по ADR-0009 (`ESNext` + `DOM` + `DOM.Iterable`, `react-jsx`, `strict`, `isolatedModules`, `bundler`, `skipLibCheck`, `types: []`, без `noUnused*`). Импортируется и из Worker, и из Node без сборки
- [ ] Compiler берёт `jsx` и `target` из этого модуля. Существующие тесты Runner и e2e зелёные
- [ ] Compiler выбирает loader по расширению (`.ts` → `ts`, `.tsx` → `tsx`) для Workspace и Lesson Tests. Тест Runner: в `main.ts` компилируются `<T>(x: T) => x` и `<number>value`, в `main.tsx` JSX по-прежнему работает
- [ ] lib-файлы TS (только нужные по конфигу) отдаются одним JSON с content-hash в имени из сборки UI и из dev-сервера, версия — из `typescript-6`
- [ ] Type Checker — отдельный Web Worker. Читает lib JSON и `types.json` из папки `deps` в `course.json`, той же, что у Compiler. Создаётся один раз на сессию, вне компонента редактора
- [ ] e2e (фикстура `offline`): ошибка типа подчёркивается, у подсказки при наведении сообщение и код `(TS2345)`; внешних запросов ноль
- [ ] e2e: Solution Lesson React Hooks, вставленная в редактор, не даёт ни одного подчёркивания (типы `react`, `react-dom/client` и JSX резолвятся из `types.json`)
- [ ] e2e: синтаксическая ошибка (`return a +;`) подчёркивается с кодом TS
- [ ] e2e: только ошибки. Неиспользуемая переменная и неиспользуемый импорт в Starter не подчёркиваются
- [ ] e2e: `[3, 1, 2].toSorted()` и `Object.groupBy(...)` не подчёркиваются, и Run с ними проходит (общий `ESNext` у Compiler и Type Checker)
- [ ] Course без Dependency Artifact (`deps: null` в `course.json`): Type Checker работает только с lib-файлами, `types.json` не запрашивается, ошибка в коде подчёркивается (тест — на курсе-фикстуре с `.ts`-Lesson без импортов)
- [ ] e2e: импорт пакета, которого нет в Course, подчёркивается как `Cannot find module` (TS2307)
- [ ] e2e: Run с ошибкой типов в коде выполняет тесты и даёт обычный Test Report (Run не блокируется)
- [ ] Подчёркивание ошибки компиляции из `runtime-hardening/04` продолжает работать рядом с ошибками типов: два источника диагностик в одном редакторе не затирают друг друга (тест)
- [ ] Debounce ~300 мс (`linter` с `delay: 300`). После исправления подчёркивание исчезает
- [ ] Read-only редактор вкладки «Решение» не подчёркивает ничего
- [ ] Unit-тесты ядра: сообщение из цепочки `messageText` склеено; `line`/`column` 1-based на многострочном коде; Lesson со Starter `main.ts` (без JSX) проверяется

## Comments
