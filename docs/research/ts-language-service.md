# Research: TypeScript language service в Web Worker для CodeMirror 6 без сети

Тикет: `.scratch/mvp/issues/02-ts-language-service.md`. Дата: 2026-10-03.
Ограничения: ADR-0002 (браузер ничего не грузит с внешних хостов), ADR-0005 (зависимости Lesson — заранее собранные Dependency Artifacts).

## TL;DR

- **Главная находка:** у нас в `package.json` стоит `typescript@^7.0.2` — это нативный порт на Go. В нём **нет JS-API и нет `typescript.js`**: пакет — это `bin/tsc` и `unstable/*`-обёртки, которые общаются с нативным бинарником по IPC (`node_modules/typescript/package.json`, `optionalDependencies: @typescript/typescript-<os>-<arch>`). В браузере TS 7 сейчас запустить нельзя: официальной WASM-сборки нет, API обещан только в 7.1 «новый и другой» ([Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)).
- Поэтому language service в браузере — это **TypeScript 6.0.x (последний JS-релиз)**, подключённый отдельным npm-алиасом рядом с TS 7 (который остаётся для `tsc -b`).
- **Рекомендация:** отдельный Web Worker «Type Checker» на `typescript@6.0.3` + `@typescript/vfs` (только `createSystem` / `createVirtualTypeScriptEnvironment`, без `createDefaultMapFromCDN`), lib-файлы и `.d.ts` зависимостей — JSON-артефакты с нашего origin; к CodeMirror — **своя тонкая обвязка** (`@codemirror/lint` + `@codemirror/autocomplete` + `hoverTooltip`) по образцу `@valtown/codemirror-ts`, потому что сам этот пакет архивирован.
- Цена (замер, см. ниже): воркер ~781 КБ brotli + lib-файлы ~284 КБ br + типы React ~77 КБ br; холодный старт ~0.7 с в Node на Intel Mac до первых diagnostics; ~55 МБ heap на окружение + ~16 МБ на сам модуль TS; инкрементальная перепроверка после правки ~50 мс.

## 1. Варианты

| | A. TS 6 + `@typescript/vfs` + `@valtown/codemirror-ts` | B. TS 6 + `@typescript/vfs` + своя обвязка CM6 (**рекомендуется**) | C. TS 7 (Go→WASM) + `@codemirror/lsp-client` | D. Monaco Editor |
|---|---|---|---|---|
| Работает без сети | да, если не вызывать `createDefaultMapFromCDN` и ATA | да | официальной сборки нет; только community (`@ttsc/wasm`) | возможно, но это замена редактора |
| Совместимость с `src/Editor.tsx` (CM 6) | да, peer `@codemirror/{view,state,lint,autocomplete}@^6` | да, только наши пакеты CM 6 | да, `@codemirror/lsp-client` 6.3.0 | нет — другой редактор |
| Поддержка | **репозиторий архивирован** (2025-09), `latest` = 2.3.1 (2024-12), `next` = 3.0.0-15 (2025-08) | наш код, ~200–300 строк | TS 7.0 без API; WASM «в работе», сроков нет | — |
| Размер | ≈ B + ~126 КБ unpacked пакета | ~3.5 МБ min / ~1.0 МБ gz / ~781 КБ br (воркер целиком) | неизвестен; команда TS прямо допускает больший payload | крупнее и тянет свой TS |
| Риск | заброшенная зависимость, тянет `import ts from "typescript"` (у нас это TS 7 — нужен alias) | своя поддержка, но маленькая | нет стабильного артефакта сегодня | переписать редактор |

**A vs B.** По функциональности одно и то же: `@valtown/codemirror-ts` — это тонкий слой поверх `env.languageService` (`getLints`, `getAutocompletion`, `getHover`, `createWorker` + Comlink). Его README теперь начинается с «Maintenance notice: Val Town now uses vtlsp … We won't be doing any first-party feature work on this codebase anymore» ([README](https://github.com/val-town/codemirror-ts)); репозиторий `archived: true` (GitHub API, 2026-10-03). Его преемник `vtlsp` запускает Deno LS **на сервере** — для нас не подходит (ADR-0004, весь код студента — в браузере). Отсюда B: написать свою обвязку, при желании скопировав подход/код (MIT) из `codemirror-ts`: `tsSync` → `updateFile`, `linter()` → `getSyntacticDiagnostics + getSemanticDiagnostics`, `autocompletion({override})` → `getCompletionsAtPosition`, `hoverTooltip` → `getQuickInfoAtPosition`. Это ещё и снимает вопрос, какой `typescript` резолвится в `import ts from "typescript"` внутри чужого пакета.

**C — не сейчас.** На TS 7 нет ни JS-API (обещан в 7.1), ни официальной WASM-сборки. Команда подтверждала, что браузер будет поддержан, а цели — Playground и VS Code Web ([discussion #458](https://github.com/microsoft/typescript-go/discussions/458)), но Go-WASM пока медленный: ~650 мс первой компиляции в community-плейграунде ([discussion #514](https://github.com/microsoft/typescript-go/discussions/514)). Community-пакет `@ttsc/wasm` 0.30.4 весит ~35 МБ unpacked (npm registry). Хорошая новость: если TS 7 выйдет как LSP-сервер в WASM, то к CodeMirror его подключит официальный `@codemirror/lsp-client` со своим `Transport` поверх `postMessage` ([lsp-client](https://github.com/codemirror/lsp-client)). Поэтому интерфейс Type Checker стоит держать узким (diagnostics / completions / hover), чтобы потом заменить реализацию.

**D — нет.** Monaco — это замена CodeMirror целиком, а не language service для него.

## 2. Что тянется из сети по умолчанию

- `@typescript/vfs`: `createDefaultMapFromCDN` качает lib-файлы с `https://playgroundcdn.typescriptlang.org/cdn/${version}/typescript/lib/` ([src/index.ts](https://github.com/microsoft/TypeScript-Website/blob/v2/packages/typescript-vfs/src/index.ts)). **Не вызывать.** `createSystem(fsMap)` и `createVirtualTypeScriptEnvironment(sys, rootFiles, ts, compilerOptions)` работают только с переданным `Map` и в сеть не ходят.
- `@typescript/ata` (Automatic Type Acquisition, в примерах `codemirror-ts`) тянет `.d.ts` с jsDelivr/npm. **Не подключать** — типы приходят из Dependency Artifacts.
- `@typescript/vfs` содержит `require(String.fromCharCode(112,97,116,104))` (`path`) и `fs` для Node-путей (`createDefaultMapFromNodeModules`, `createFSBackedSystem`). esbuild сворачивает эти константы и падает на `Could not resolve "path"` при `platform: "browser"`; лечится `external: ["path","fs"]` (Vite отдаёт для builtins пустую заглушку). В браузерном пути эти функции не вызываются.
- Проверка: собранный esbuild'ом воркер (TS 6.0.3 + vfs + `createWorker`) — среди URL-строк в бандле только ссылки в текстах сообщений (`aka.ms/tsconfig`, MDN и т.п.), `playgroundcdn` вытрясен tree-shaking'ом. В рантайме это нужно закрепить e2e-тестом с заблокированной внешней сетью (ADR-0002).

## 3. Отдельный Worker или вместе с esbuild-wasm

**Отдельный.** Причины:

- Язык-сервис дёргается на каждое нажатие (lint debounce, completion), Compiler — на Run. В одном потоке они блокируют друг друга: Run ждал бы проверку типов и наоборот.
- Разный жизненный цикл: TS-окружение можно грузить лениво после монтирования редактора и пересоздавать при смене Lesson, не трогая инициализированный `esbuild.wasm` (~13.3 МБ raw / ~3.6 МБ gz, `node_modules/esbuild-wasm/esbuild.wasm`).
- Память суммируется в любом случае; объединение ничего не экономит, зато падение одного не кладёт другой.

Компилятор при этом не меняется: esbuild типы не проверяет ([esbuild: TypeScript caveats](https://esbuild.github.io/content-types/#typescript-caveats)), Run остаётся возможным при type errors. Блокировать ли Run при ошибках типов — продуктовое решение (вопрос человеку).

### Замеры (Node 24.20, macOS Intel x64, TS 6.0.3, `@typescript/vfs` 1.6.5)

Скрипт в scratchpad, не в репозитории. Окружение: lib `es2022 + dom + dom.iterable`, `@types/react` + `@types/react-dom` 19.3.0 + `csstype`, один `/App.tsx` с `useState` и ошибкой типа.

| Что | Значение |
|---|---|
| `lib/typescript.js` | 8 930 КБ raw / 1 603 КБ gz / 1 128 КБ br |
| Воркер целиком (TS + vfs + обвязка, esbuild `--minify`) | 3 500 КБ raw / 1 005 КБ gz / 781 КБ br |
| lib-файлы, реально попавшие в Program (59 шт.) | 2 754 КБ raw / 396 КБ gz / 284 КБ br |
| Все `lib.*.d.ts` в пакете | 3 695 КБ raw / 539 КБ gz / 301 КБ br |
| `.d.ts` `@types/react` + `@types/react-dom` + `csstype` | 1 108 КБ raw / 125 КБ gz / 77 КБ br |
| `require("typescript")` | ~200 мс, ~16 МБ heap |
| `createVirtualTypeScriptEnvironment` (парсинг libs + Program) | ~420 мс |
| Первые syntactic+semantic diagnostics | ~85 мс |
| Completions | ~35 мс |
| Diagnostics после `updateFile` | ~50 мс |
| Heap окружения после GC | ~55 МБ |

Итого холодный старт до первых diagnostics ≈ 0.7 с в Node; в браузерном Worker на слабых ноутбуках студентов ожидать 1–2 с плюс загрузка ~1.1 МБ br. Diagnostics: `Type 'number' is not assignable to type 'string'.` — работает, JSX-типы React резолвятся через `react/jsx-runtime`.

## 4. lib-файлы без CDN

Брать из того же `typescript@6.0.3`, что и сам LS (версии lib-файлов и компилятора должны совпадать). Два способа, оба с нашего origin:

1. **Артефакт-JSON** (предпочтительно): скрипт сборки (как `scripts/build-deps.mjs`) пишет `public/ts/lib@6.0.3.json` — `{ "/lib.es2022.d.ts": "...", ... }` только с нужными файлами. Один запрос, кэшируется, content-hash в имени.
2. `import.meta.glob("…/lib/lib.*.d.ts", { query: "?raw" })` в воркере — Vite сам кладёт их в чанки. Проще, но список файлов размазывается по бандлу.

Список нужных файлов: `knownLibFilesForCompilerOptions(opts, ts)` из `@typescript/vfs` возвращает с запасом (79), реально в Program попадает 59 — точный список можно получить один раз из `program.getSourceFiles()` на этапе сборки.

Нюанс: в программном API `compilerOptions.lib` задаётся **именами файлов** (`"lib.es2022.d.ts"`), а не как в tsconfig (`"es2022"`); иначе `TS6054: File '/dom.iterable' has an unsupported extension`. Либо прогонять tsconfig-вид через `ts.convertCompilerOptionsFromJson`.

## 5. `.d.ts` зависимостей Lesson из Dependency Artifacts

Сейчас Dependency Artifacts — только JS (`public/deps/*.js` + `manifest.json`). Предложение: рядом с JS-артефактом публиковать **типовой артефакт** — JSON `{ виртуальный путь: содержимое }` со всеми `.d.ts` и `package.json` пакета и его типовых зависимостей:

- `react` → `@types/react/**/*.d.ts`, `@types/react/package.json` и транзитивно `csstype/index.d.ts` (без них `import "react"` не резолвится);
- `react-dom/client` → `@types/react-dom/**`.

Класть в fsMap под `/node_modules/<pkg>/…`, тогда `moduleResolution: "bundler"` находит их штатно, без `paths`. Для пакетов со встроенными типами — их собственные `.d.ts` по `types`/`exports`. В PoC-подобном режиме это делает `build-deps.mjs`, в MVP — CI-пайплайн из ADR-0005 (там `.d.ts` уже в списке Consequences). Манифест расширяется: `{ "react": { "js": "react@19.3.0.js", "types": "react-types@19.3.0.json" } }`. Type Checker и Compiler читают один манифест, поэтому набор импортируемых модулей в редакторе и в Run совпадает: импорт пакета, которого нет в Lesson Manifest, даст и ошибку TS `Cannot find module`, и ошибку Compiler `Cannot resolve`.

Тестовые файлы (`./tests`, `@codda/test`) в окружение LS добавлять не нужно — студент правит только `App.tsx`.

## 6. `compilerOptions`, совпадающие с Compiler

Compiler (`src/runtime/compiler.worker.ts`): esbuild, `loader: "tsx"`, `jsx: "automatic"`, `format: "iife"`, target по умолчанию (`esnext`), tsconfig не передаётся. esbuild из tsconfig смотрит только `jsx*`, `target`, `useDefineForClassFields`, `strict/alwaysStrict`, `verbatimModuleSyntax`, `experimentalDecorators`, `paths/baseUrl` и рекомендует `isolatedModules`, потому что компилирует файлы по одному ([esbuild docs](https://esbuild.github.io/content-types/#typescript-caveats)).

```ts
{
  target: ts.ScriptTarget.ES2022,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"], // без WebWorker: код студента — в iframe
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,        // = esbuild jsx: "automatic"
  jsxImportSource: "react",        // по умолчанию и так react
  strict: true,
  isolatedModules: true,           // ловит то, что esbuild скомпилирует неверно
  noEmit: true,
  skipLibCheck: true,              // не проверять @types — быстрее и без шума
  types: [],                       // не подхватывать ambient @types из fsMap
  allowImportingTsExtensions: true,
}
```

Это совпадает с корневым `tsconfig.json`, кроме `lib` (без `WebWorker`) и `types`. Если Lesson Tests или Compiler когда-нибудь получат свой tsconfig — генерировать оба из одного источника. `target` у esbuild сейчас `esnext`, у LS — `ES2022`: синтаксис новее ES2022 TS пометит ошибкой, а esbuild соберёт; либо поднять LS до `ESNext`/`lib.esnext`, либо задать esbuild `target: "es2022"` — выбрать одно.

## 7. Совместимость с `src/Editor.tsx`

Редактор: `codemirror` 6.0.2 (`basicSetup`), `@codemirror/lang-javascript` 6.2.5 (`typescript: true, jsx: true`), установлены `@codemirror/lint` 6.9.7, `@codemirror/autocomplete` 6.20.3, `@codemirror/view` 6.43.13. Всё нужное для обвязки уже в зависимостях через `basicSetup`, новых CM-пакетов не требуется (для варианта A — те же peer-диапазоны `^6`).

Что добавить: расширения `linter(source)` (diagnostics с позициями `start/length` из TS — это уже offset'ы документа CM), `autocompletion({ override: [tsSource] })` (иначе `basicSetup` смешает с keyword-completion `lang-javascript`), `hoverTooltip`, и `updateListener`, шлющий текст в Type Checker (уже есть для `onChange`). Сейчас `EditorView` пересоздаётся при смене `initialValue` — Type Checker надо держать снаружи компонента, чтобы не перезапускать TS на каждый ремаунт.

## 8. Подключение TS 6 рядом с TS 7

- `"typescript-6": "npm:typescript@6.0.3"` в `dependencies` и `import ts from "typescript-6"` в воркере; либо официальный `@typescript/typescript6` (6.0.2, `main: lib/typescript.js`, зависит от `@typescript/old: npm:typescript@^6`) — он сделан именно для «TS 7 рядом с API 6.0» ([Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)).
- Версия TS в редакторе (6.0) и в `tsc -b` (7.0) различаются; 7.0 заявлен совместимым с 6.0 по type-checking, но мелкие расхождения диагностик возможны. Для студента это не важно — он видит только LS.
- TS 6 — последняя JS-линия; сроков поддержки 6.x анонс 7.0 не называет. Когда появится официальный WASM/LSP TS 7 — менять реализацию за тем же интерфейсом (вариант C).

## Рекомендация

Вариант **B**: отдельный Worker «Type Checker» на `typescript@6.0.3` + `@typescript/vfs` (без CDN-функций и ATA); lib-файлы — JSON-артефакт из того же пакета с нашего origin; `.d.ts` зависимостей — типовые Dependency Artifacts рядом с JS в общем манифесте; compilerOptions из §6; своя тонкая обвязка CM6 (lint + completion + hover) с узким интерфейсом, чтобы позже заменить на TS 7 WASM через `@codemirror/lsp-client`. Ждать TS 7 не стоит: сроков нет. Брать `@valtown/codemirror-ts` как зависимость не стоит: он архивирован; как образец кода — да.

Открытые вопросы для человека: блокировать ли Run при type errors; какой `target` общий для LS и esbuild; приемлем ли холодный старт 1–2 с (или грузить Type Checker лениво после первого ввода).

## Источники

- TypeScript 7.0 announcement — нет API в 7.0, `@typescript/typescript6`, новые дефолты: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- typescript-go, браузер/WASM: https://github.com/microsoft/typescript-go/discussions/458 , производительность Go-WASM: https://github.com/microsoft/typescript-go/discussions/514
- `@typescript/vfs` README и исходник (CDN-URL, API): https://github.com/microsoft/TypeScript-Website/tree/v2/packages/typescript-vfs , https://github.com/microsoft/TypeScript-Website/blob/v2/packages/typescript-vfs/src/index.ts
- `@valtown/codemirror-ts` (README с maintenance notice, archived): https://github.com/val-town/codemirror-ts
- `@codemirror/lsp-client`: https://github.com/codemirror/lsp-client
- esbuild — TypeScript caveats, учитываемые поля tsconfig, `isolatedModules`: https://esbuild.github.io/content-types/#typescript-caveats
- npm registry (версии, даты, размеры): `typescript` (latest 7.0.2, 6.0.3 от 2026-04-16), `@typescript/vfs` 1.6.5 (2026-09-22), `@valtown/codemirror-ts` 2.3.1 / 3.0.0-15, `@codemirror/lsp-client` 6.3.0, `@typescript/typescript6` 6.0.2, `@ttsc/wasm` 0.30.4
- Локально: `node_modules/typescript/package.json` (7.0.2: `bin/tsc`, `unstable/*`, нативные optionalDependencies), `node_modules/esbuild-wasm/esbuild.wasm`, `src/Editor.tsx`, `src/runtime/compiler.worker.ts`, `scripts/build-deps.mjs`
