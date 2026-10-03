# Type Checker: TypeScript 6 в отдельном Web Worker, Run не блокирует

Diagnostics и autocomplete в редакторе даёт Type Checker — отдельный Web Worker, не тот, в котором работает Compiler (esbuild-wasm). Внутри — TypeScript 6 (`"typescript-6": "npm:typescript@6.0.3"`) и `@typescript/vfs` (только `createSystem` / `createVirtualTypeScriptEnvironment`). TS 7, который у нас стоит для `tsc -b`, — нативный порт на Go без JS-API и без WASM-сборки, в браузере не запускается. lib-файлы — JSON-артефакт из того же пакета TS с нашего origin, `.d.ts` зависимостей — `types.json` Dependency Artifact Course (ADR-0007); `createDefaultMapFromCDN` и ATA не используются (ADR-0002). К CodeMirror 6 — своя тонкая обвязка (`@codemirror/lint`, `@codemirror/autocomplete`), а не архивированный `@valtown/codemirror-ts`. Интерфейс воркера узкий (файл → diagnostics, completions), чтобы позже заменить реализацию на TS 7 в WASM через `@codemirror/lsp-client`.

Отдельный воркер, потому что Type Checker вызывается на каждое нажатие, а Compiler — на Run: в одном потоке они блокировали бы друг друга, а падение одного клало бы другой. Памяти объединение не экономит.

Ошибки типов Run не блокируют, и на оценку не влияют: Lesson засчитывается по Lesson Tests. Type Checker помогает студенту, но не судит его; поэтому Run не зависит от его холодного старта (1–2 с) и не застревает на ложной или непонятной ошибке.

Compiler, Type Checker и проверка типов в `codda test` читают параметры из одного модуля конфига: `target`/`lib` — `ESNext` (+ `dom`, `dom.iterable`), `jsx: react-jsx`, `strict`, `isolatedModules`, `moduleResolution: bundler`, `skipLibCheck`, `types: []`. Код студента исполняется в актуальном Chrome; когда понадобятся другие браузеры, `target` меняется в одном месте для всех трёх.

## Consequences

- Два TypeScript в проекте: TS 7 для `tsc -b`, TS 6 для браузера и `codda test`. Мелкие расхождения диагностик между ними возможны; студент и `codda test` видят одну и ту же TS 6.
- Цена загрузки ~1.1 МБ br (воркер, lib, типы React) и ~70 МБ памяти. Воркер один на сессию и стартует после первой отрисовки; при смене Lesson меняется только файл, потому что `types.json` один на Course.
- Если Type Checker не загрузился или упал, редактор и Run работают, а вкладка «Проблемы» показывает «Проверка типов недоступна».
- TS 6 — последняя JS-линия без объявленного срока поддержки; переход на TS 7 — когда появится официальная WASM/LSP-сборка.
