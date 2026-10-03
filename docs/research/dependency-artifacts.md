# Research: как собирать и доставлять Dependency Artifacts

Тикет: [`.scratch/mvp/issues/01-dependency-artifacts.md`](../../.scratch/mvp/issues/01-dependency-artifacts.md). Связанные документы: ADR-0002, ADR-0003, ADR-0005, ADR-0006, [PoC Report](../poc-report.md) (R4, R5, R9).

Это материал для решения, а не решение. ADR пишет человек.

Обозначения: **[факт]** — подтверждено первоисточником по ссылке. **[PoC]** — видно в коде или замерах этого репозитория. **[вывод]** — моё рассуждение, первоисточником не подтверждено. **[проверить]** — нужен замер в эксперименте.

## 0. Как сейчас (PoC)

- `scripts/build-deps.mjs` собирает три артефакта (`react`, `react/jsx-runtime`, `react-dom/client`) обычным `esbuild` под Node: `format: "esm"`, `platform: "browser"`, `define: process.env.NODE_ENV = "development"`. Результат лежит в `public/deps/`, к нему `manifest.json` (specifier → файл). **[PoC]**
- Именованные экспорты для ESM-обёртки получаются так: `require(specifier)` в Node и `Object.keys`. Поэтому default-экспорта нет, и `import React from "react"` даёт compile-error (R9). **[PoC]**
- `require("react")` внутри `react-dom` и JSX runtime плагин `react-as-esm` подменяет на `export * from "react"` с `external`. Иначе в бандле оказалось бы две копии React. **[PoC]**
- Compiler (`src/runtime/compiler.worker.ts`) скачивает все артефакты в Worker и на **каждом** Run вшивает их в IIFE вместе с кодом студента. Результат уходит в `srcdoc`. Отсюда R4: esbuild-wasm каждый раз заново парсит 1.1 МБ `react-dom`. **[PoC]**
- Hash нигде не проверяется. Имена файлов содержат версию, но не hash. **[PoC]**

## 1. CommonJS → ESM (R9)

**Факты**

- esbuild при бандлинге CJS в ESM выдаёт только `default` = `module.exports`. Именованных экспортов он не порождает: это открытый запрос [esbuild#442](https://github.com/evanw/esbuild/issues/442). **[факт]**
- Когда ESM импортирует CJS, у esbuild две семантики `default` ([Content types → «The default export can be error-prone»](https://esbuild.github.io/content-types/#default-interop)). По умолчанию работает Babel-семантика: если есть маркер `__esModule`, то `default` = `exports.default`. Node-семантика (`default` = `module.exports`) включается только для импортёров из `.mjs`/`.mts` или из пакета с `"type": "module"`. **[факт]**
- В Node `default` для CJS всегда равен `module.exports`. Именованные экспорты Node находит эвристическим статическим анализом исходника и предупреждает, что анализ «does not always correctly detect named exports» ([Node: CommonJS namespaces](https://nodejs.org/api/esm.html#commonjs-namespaces); Node использует [cjs-module-lexer](https://github.com/nodejs/cjs-module-lexer)). **[факт]**
- `react/index.js` выбирает файл через `if (process.env.NODE_ENV === 'production') module.exports = require(...)`. Стандартный лексер видит здесь только reexport. Лексер esm.sh ([esm-dev/cjs-module-lexer](https://github.com/esm-dev/cjs-module-lexer)) умеет ветвиться по `process.env.NODE_ENV` (опция `nodeEnv`), а ещё разбирает UMD, reexports и IIFE. **[факт]**
- Vite решает ту же задачу при pre-bundling: делает «smart import analysis», чтобы named imports из CJS работали «even if the exports are dynamically assigned (e.g. React)» ([Vite: Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling)). **[факт]**
- Если ESM-выход содержит `require()` модуля, помеченного как external, esbuild оставляет shim, который в браузере падает с `Dynamic require of "x" is not supported` ([esbuild#1921](https://github.com/evanw/esbuild/issues/1921)). Именно это PoC обходит плагином `react-as-esm`. **[факт]**

**Варианты генерации ESM-обёртки для CJS-entry**

| | Как получить имена | Плюсы | Минусы |
|---|---|---|---|
| a. `require()` в Node (как в PoC) | исполнить модуль в Node и взять `Object.keys` | точный список для обычных пакетов | исполняет код пакета в CI. Пакет, который падает в Node (обращается к `window`/`document` при импорте), не соберётся |
| b. Статический лексер | `cjs-module-lexer` (Node) или лексер esm.sh с `nodeEnv: "development"`, рекурсивно по reexports | код не исполняется, так работают Node и esm.sh | эвристика, бывают промахи |
| c. b, а при промахе — a | | покрывает оба случая | две ветки кода |

Обёртку в любом варианте генерировать по Node-семантике: `export default mod` плюс `export const { a, b } = mod` (или `export { … }` через промежуточную переменную). Тогда работают и `import React from "react"`, и `import { useState } from "react"`. **[вывод]**

`__esModule`-пакеты (собранные Babel/TS из ESM) составляют отдельный случай. Если у пакета есть ESM-entry (`exports.import`/`module`), брать его, и вопрос пропадает. Если есть только CJS с `__esModule`, то `default` = `exports.default` (Babel-семантика, её ждут авторы таких пакетов). **[вывод]**

## 2. `package.json` `exports`/`imports`, условия

**Факты** ([Node: Packages](https://nodejs.org/api/packages.html))

- Если `exports` задан, все неперечисленные subpath'ы закрыты (`ERR_PACKAGE_PATH_NOT_EXPORTED`). Порядок ключей условий значим: выигрывает первый подходящий.
- Subpath patterns `"./features/*.js"`: `*` подставляется как строка и может содержать `/`. Значение `null` исключает путь.
- `imports` (`#internal`) — приватные алиасы пакета. Они резолвятся внутри пакета при сборке и наружу не видны.
- Условия Node: `node-addons`, `node`, `import`, `require`, `module-sync`, `default`. Community-условия: `types`, `browser`, `development`, `production`.
- esbuild с `platform: "browser"` добавляет условие `browser`, а если свои conditions не заданы, ещё и `module`. Main fields при этом `browser,module,main` ([esbuild API: platform](https://esbuild.github.io/api/#platform), [conditions](https://esbuild.github.io/api/#conditions)). Условия `development`/`production` esbuild сам **не** включает.
- esm.sh при `?dev` выставляет `process.env.NODE_ENV = "development"` **и** включает условие `development` ([esm.sh README](https://github.com/esm-dev/esm.sh/blob/main/README.md)).

**Что из этого следует для пайплайна** **[вывод]**

- Резолвинг `exports`/`imports`/conditions целиком отдать esbuild в CI (Node, обычный `node_modules`). В браузер не тащить: это и есть смысл ADR-0005.
- Единица артефакта — **публичная точка входа** (`react`, `react/jsx-runtime`, `react-dom/client`), а не пакет. Список точек входа:
  - явный: Author перечисляет specifier'ы в Course/Lesson (например, `react-dom/client`). Просто, предсказуемо, подходит для MVP;
  - или автоматический: все ключи `exports` без `*`. Patterns с `*` раскрывать по файлам опасно, их стоит брать только явно.
- Все точки входа одного набора собирать **одним** вызовом esbuild с `splitting: true` (работает только для `format: "esm"`, [esbuild API: splitting](https://esbuild.github.io/api/#splitting)). Общий код (`react-dom` ↔ `react-dom/client`, `react` внутри всего) уходит в общие chunks. Так экземпляр каждого модуля один, без плагинов-шимов вроде `react-as-esm`.
- Conditions: `["browser", "development", "module", "import", "default"]`. Свои conditions отключают автоматический `module`, поэтому его надо указать явно. `define: { "process.env.NODE_ENV": '"development"' }` оставить (см. §5).
- Specifier, которого нет в списке точек входа, Compiler отклоняет с compile-error «пакет X/Y не объявлен». Так PoC уже работает с несуществующими пакетами.

## 3. peer/shared-зависимости и конфликты версий

**Факты**

- `react-dom@19.3.0` объявляет `peerDependencies: { react: "^19.3.0" }` и `dependencies: { scheduler: "^0.28.0" }`. Внутри CJS-кода он делает `require("react")`, `require("react-dom")`, `require("scheduler")`. **[PoC]** (`node_modules/react-dom/package.json`, `cjs/react-dom-client.development.js`)
- Если в Sandbox окажутся две копии `react`, хуки сломаются. Именно поэтому PoC держит один экземпляр. **[PoC]**
- Import maps умеют `scopes`: один и тот же specifier может по-разному резолвиться в зависимости от URL импортирующего модуля ([MDN: importmap → scopes](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap)). Так esm.sh даёт разным пакетам разные версии зависимости (`?deps=`, `?external=`, [README](https://github.com/esm-dev/esm.sh/blob/main/README.md)). **[факт]**
- Vite инвалидирует pre-bundle по lockfile, своему конфигу и `NODE_ENV` ([Vite](https://vite.dev/guide/dep-pre-bundling)). **[факт]**

**Две модели гранулярности**

| | A. Артефакт на пакет (модель esm.sh) | B. Артефакт на набор зависимостей (модель Vite pre-bundle) |
|---|---|---|
| Что собирается | каждый `name@version` отдельно, все bare-импорты external, связывание через import map | все точки входа набора одним esbuild-вызовом со `splitting` |
| Один экземпляр `react` | обеспечивает import map: один URL на specifier | обеспечивает esbuild: общий chunk |
| CJS → внешний пакет (`require("react")` в `react-dom`) | надо переписывать `require` в `import` (как esm.sh) или ставить шим на каждый пакет. Иначе `Dynamic require … not supported` | проблемы нет: всё внутри одного бандла |
| Переиспользование между Lesson/Course | максимальное | один артефакт на уникальный набор. В MVP набор почти всегда равен набору Course, так что их будет 1–3 |
| Разные версии транзитивной зависимости | `scopes` в import map | решает npm/esbuild при установке (вложенные `node_modules`) |
| Сложность пайплайна | высокая: свой переписчик CJS, свой резолвер графа | низкая: `npm ci` и один `esbuild.build` |

**Course vs Lesson** (из `.scratch/mvp/map.md`: Course задаёт зависимости, Lesson добавляет свои) **[вывод]**

- Набор Lesson = зависимости Course ∪ зависимости Lesson. Если Lesson объявляет пакет, который уже есть в Course, с другой версией, `codda test` падает с ошибкой. Это самый простой вариант. Его альтернатива — разрешить Lesson переопределять версию; технически это возможно, потому что у каждого Run свой Sandbox и свой import map. Выбор за человеком.
- Транзитивные версии фиксирует lockfile. «Точная версия» в манифесте фиксирует только верхний уровень, а `scheduler: ^0.28.0` без lockfile со временем поплывёт. Рекомендация: `codda` генерирует `package.json` + `package-lock.json` для каждого набора, а CI ставит пакеты через `npm ci` (registry из `.npmrc`, ADR-0006).
- Peer-зависимости проверяет сам npm: `npm install` с npm 7+ ставит peers и падает на конфликте (флаг `--strict-peer-deps` делает проверку строже). Ошибку `codda test` показывает как есть. **[вывод, проверить формулировку ошибок npm]**

## 4. Вшивать в бандл или грузить в Sandbox отдельно (R4); совместимость с ADR-0003

**Факты**

- Module scripts (и статические `import` внутри них) загружаются запросом с `mode: "cors"` ([HTML: fetch a single module script](https://html.spec.whatwg.org/multipage/webappapis.html#fetch-a-single-module-script)). У Sandbox origin opaque, запрос уходит с `Origin: null`. Поэтому сервер артефактов должен отвечать `Access-Control-Allow-Origin: *`. Credentials mode у module scripts по умолчанию `same-origin`, так что для cross-origin cookies не шлются, и `*` допустим ([Fetch: CORS check](https://fetch.spec.whatwg.org/#cors-check)). ADR-0003 это уже предусматривает. **[факт]**
- Import map можно добавить и инлайном в `srcdoc`. Он должен быть обработан до module-скриптов, которые его используют. Несколько import maps сливаются (Chrome 133+); в старых версиях разрешена только одна карта до первого модуля ([MDN importmap](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap), [caniuse](https://caniuse.com/mdn-html_elements_script_type_importmap_multiple_import_maps)). **[факт]**
- Blob URL можно загрузить только из окружения с тем же storage key, что и у окружения, где его создали ([File API](https://w3c.github.io/FileAPI/)). Значит, blob URL, созданный parent или Worker, opaque-origin Sandbox загрузить не сможет. Blob нужно создавать **внутри** Sandbox. **[факт]**
- HTTP-кэш Chrome партиционирован. Раньше подресурсы opaque-origin фреймов в HTTP-кэш вообще не попадали. Эксперимент с «is-cross-site bit» должен был это изменить, но в обсуждении 2023 года окончательное решение не зафиксировано ([blink-dev: Intent to Experiment](https://groups.google.com/a/chromium.org/g/blink-dev/c/cG65eYPYf9w), [Chrome: HTTP cache partitioning](https://developer.chrome.com/blog/http-cache-partitioning)). Кэшируются ли артефакты, которые Sandbox грузит по URL, в текущем Chrome — неизвестно. **[факт + проверить]**
- esbuild incremental (`context` + `rebuild`) не парсит повторно файлы с неизменённым содержимым, «This optimization applies to virtual modules created by plugins» ([esbuild API: incremental](https://esbuild.github.io/api/#incremental)). Линковка и печать бандла при этом всё равно повторяются. **[факт]**

**Варианты**

| | Что делает Run | Плюсы | Минусы / риски |
|---|---|---|---|
| **1. Вшивать (как PoC)** | esbuild бандлит студента, тесты и артефакты в IIFE | уже работает, без CORS, один `srcdoc` | R4: время растёт с каждым пакетом. Парсинг 1.1 МБ на каждом Run. Source maps студента смешаны с вендором |
| **1′. Вшивать + `esbuild.context`** | то же, но `rebuild()` | маленькое изменение | парсинг уходит, линковка и печать 1.2 МБ остаются. Sandbox всё равно исполняет всё **[проверить выигрыш]** |
| **2. Import map → URL на нашем origin** | esbuild компилирует только студента и тесты (`format: "esm"`, артефакты `external`). `srcdoc` = `<script type="importmap">` с абсолютными URL и `integrity` + inline `<script type="module">` | компиляция не зависит от размера зависимостей. Нативный `integrity`. Файлы на диске immutable, по hash. Работает с будущим отдельным origin Sandbox и CSP (`script-src` на origin артефактов, `connect-src 'none'`) | нужен `Access-Control-Allow-Origin: *` на статике (и в `codda dev`/`preview`, и на хостинге, тикет 06). Если HTTP-кэш для opaque-фреймов не работает, каждый Run заново скачивает ~1.2 МБ с сервера **[проверить]** |
| **3. Import map → blob URL внутри Sandbox** | Worker/parent один раз скачивает текст артефактов (с проверкой hash). На Run передаёт их в iframe через `postMessage`. Bootstrap-скрипт в iframe делает `URL.createObjectURL`, вставляет import map, потом модуль студента | не зависит ни от CORS-заголовков, ни от HTTP-кэша. Скачивание один раз за сессию | blob URL каждый раз новые, поэтому V8 code cache не работает, и `react-dom` компилируется заново на каждом Run **[проверить]**. Динамическая вставка import map до первого модуля **[проверить]**. Bootstrap-протокол усложняет контракт `postMessage` (ADR-0003) |
| 4. Переиспользовать iframe между Run | модули загружены один раз | самый быстрый | ломает изоляцию: состояние предыдущего Run и код студента живут дальше. Противоречит модели «свежий Sandbox на Run». Не рекомендую |

В вариантах 1–3 Sandbox всё равно **исполняет** `react-dom` на каждом Run, потому что новый iframe — новый realm. Варианты 2–3 убирают из Run стоимость esbuild. Вариант 2 вдобавок может получить code cache. **[вывод]**

**Integrity и кэширование** **[факт + вывод]**

- Имя файла: `<name>@<version>-<contenthash>.js` (или hash набора для модели B плюс hash chunk'ов от esbuild: `chunkNames: "[name]-[hash]"`). Отдавать с `Cache-Control: public, max-age=31536000, immutable`.
- Проверка: в варианте 2 — `integrity` в import map (sha384, Chrome 127+, Firefox 138+, Safari 18.4+; [Chrome 127 release notes](https://developer.chrome.com/release-notes/127), [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap)). Integrity для cross-origin требует CORS, а он и так нужен. В вариантах 1/3 — `fetch(url, { integrity })` в Worker.
- Манифест артефактов (`specifier → url + integrity`) генерируется `codda build` и входит в статическую сборку. Он сам не immutable и кэшируется вместе с приложением.
- Кэш CI: ключ = hash(lockfile набора, версия esbuild, конфиг сборки: conditions, `NODE_ENV`, target, версия формата пайплайна). Совпал — пересборки нет. Тот же набор правил, что у Vite.

## 5. Development-сборка React для `act` (R5)

- В `react/cjs/react.production.js` экспорта `act` **нет**, а в `react.development.js` есть `exports.act = function (callback) {…}` (проверено grep'ом в `node_modules/react@19.3.0`). **[PoC]**
- `act` требует `IS_REACT_ACT_ENVIRONMENT = true` ([react.dev: act](https://react.dev/reference/react/act)). **[факт]**
- Development-сборка нужна и для полезных студенту предупреждений React (keys, hooks), а Run — это учебная обратная связь, ADR-0004. **[вывод]**

Рекомендация: в MVP только development-сборка (`NODE_ENV=development` + условие `development`), одна на набор. Production-сборка не нужна, пока нет сценария «показать результат вне тестов». Параметр `mode` оставить в ключе кэша, чтобы потом её можно было добавить. **[вывод]**

## 6. «Работает в браузере»: проверка в `codda test`

**Факты**

- esbuild с `platform: "node"` автоматически делает built-ins (`fs` и т. д.) external ([esbuild API: platform](https://esbuild.github.io/api/#platform)). С `platform: "browser"` такого нет, и `require("fs")` превращается в ошибку резолвинга при сборке. **[факт + вывод по поведению]**
- `define` подменяет только перечисленные выражения. Свободный `process`, `global`, `Buffer`, `__dirname` останутся в коде и упадут в браузере только при исполнении. **[вывод]**
- Opaque origin не отрезает Sandbox от сети (ADR-0003, R2). Сетевое обращение при импорте ловится только снаружи. **[факт из ADR]**

**Рекомендуемая трёхступенчатая проверка в CI** **[вывод]**

1. **Сборка.** Ошибка резолвинга Node built-in (`fs`, `path`, `node:*`) превращается в понятное сообщение: «пакет X импортирует Node-модуль `fs` и в браузере не работает». Полифиллов в MVP нет.
2. **Статический скан выхода** по metafile/AST на свободные `process`, `Buffer`, `global`, `require`, `__dirname`. Это предупреждение, а не ошибка: многие обращения стоят за `typeof`-проверками.
3. **Smoke-импорт в Chromium (Playwright уже есть в проекте).** Каждая точка входа импортируется в настоящем Sandbox (`allow-scripts`, тот же путь доставки, что в Run), а все запросы не на наш origin перехватываются. Исключение при импорте или попытка внешнего запроса — ошибка `codda test` с именем пакета и сообщением. Это единственная проверка, которая видит телеметрию, шрифты и lazy-chunks с CDN (ADR-0002).

Сверх того `codda test` прогоняет Solution против Lesson Tests, и это проверяет пакет на реальном сценарии.

## 7. `.d.ts` для TS-подсказок

**Факты**

- `react@19.3.0` своих типов не публикует: в `package.json` нет `types`/`typings`. Они лежат в `@types/react` (436 КБ, зависит от `csstype`). **[PoC]**
- Условие `types` в `exports` — community-конвенция, его ставят первым ([Node: Packages, community conditions](https://nodejs.org/api/packages.html#community-conditions-definitions)). **[факт]**
- TypeScript Playground берёт типы через Automatic Type Acquisition ([`@typescript/ata`](https://github.com/microsoft/TypeScript-Website/tree/v2/packages/ata)) с внешнего CDN (jsDelivr). Нам это запрещено ADR-0002. **[факт + вывод]**

**Рекомендация** **[вывод]**

- Типы — **отдельный артефакт** рядом с JS-артефактом того же набора: JSON `{ "node_modules/<pkg>/…d.ts": "<текст>", "node_modules/<pkg>/package.json": "…" }`, неизменяемый, по hash. В JS-бандл их не класть: JS нужен Sandbox, `.d.ts` нужны только TS Worker (тикет 02). Им нужны разные загрузчики и разное время загрузки (типы можно лениво).
- Источник: `types`/`typings`/условие `types` пакета. Если их нет — `@types/<name>` с той же major. `codda` может подбирать его автоматически или требовать объявить явно; это решение за человеком. Транзитивные типы (`csstype`) включать по графу импортов `.d.ts`.
- Файлы копировать как есть, без «склейки» `.d.ts` в один (api-extractor, dts-bundle-generator): копия надёжнее, а TS language service и так работает поверх виртуальной FS.

## 8. Рекомендация

1. **Гранулярность: модель B, артефакт на набор зависимостей.** Lesson получает набор Course ∪ Lesson. Конфликт версий с Course — ошибка `codda test`. В CI `codda` пишет `package.json` + lockfile набора, выполняет `npm ci` (registry из `.npmrc`), затем делает **один** `esbuild.build` по всем объявленным точкам входа: `format: "esm"`, `splitting: true`, `platform: "browser"`, conditions с `development`, `NODE_ENV=development`. Так снимаются проблема двух экземпляров React и `Dynamic require` без самописных шимов. К модели A (на пакет, как esm.sh) имеет смысл вернуться, только если наборов станет много.
2. **CJS-обёртки:** генерировать точку входа с `export default` = `module.exports` и именованными экспортами из статического лексера (лексер esm.sh с `nodeEnv`), а при неудаче — через `require` в Node. Это закрывает R9.
3. **Доставка: отдельно от кода студента, через import map в `srcdoc`.** Compiler компилирует только студента, тесты и Test Harness, с `external` на объявленные specifier'ы. Транспорт выбрать коротким замером в Chrome:
   - по умолчанию **вариант 2** (URL на нашем origin + `Access-Control-Allow-Origin: *` + `integrity` в import map), если артефакты в opaque-origin Sandbox берутся из HTTP-кэша;
   - иначе **вариант 3** (текст из Worker → `postMessage` → blob внутри Sandbox, hash проверяется `fetch(…, { integrity })` в Worker).
   
   Пока замера нет, вариант 1′ (`esbuild.context`) годится как дешёвая страховка, но R4 он не решает.
4. **Только development-сборка в MVP** (R5).
5. **Integrity:** content-hash в имени, `immutable`-кэш, sha384 в манифесте и при загрузке.
6. **Проверка «работает в браузере»:** ошибка сборки на Node built-ins, скан на `process`/`Buffer`, smoke-импорт в Playwright с заблокированной внешней сетью.
7. **`.d.ts`:** отдельный JSON-артефакт типов набора (пакет или `@types/*`), его грузит TS Worker.

## 9. Что проверить в эксперименте перед ADR

- [ ] Кэширует ли Chrome module scripts, которые opaque-origin `srcdoc`-iframe грузит с нашего origin: DevTools «(disk cache)» на втором Run. Это вопрос выбора между вариантами 2 и 3.
- [ ] Warm Run для вариантов 1, 1′, 2 и 3 на React-задании (базовая точка из PoC: ~0.5 с) и на наборе из 3–4 пакетов.
- [ ] Вариант 3: можно ли вставить import map из inline classic-скрипта после `postMessage`, до первого модуля.
- [ ] Работает ли `integrity` из import map для статических импортов внутри артефактов (chunks), а не только для entry.
- [ ] Лексер esm.sh на `react`, `react-dom/client`, `scheduler` и паре популярных CJS-пакетов: совпадает ли с `Object.keys(require(...))`.
- [ ] Формулировки ошибок `npm ci` при конфликте peer-зависимостей. Достаточно ли их показать как есть.

## Источники

- esbuild: [Content types — default interop](https://esbuild.github.io/content-types/#default-interop), [API: platform](https://esbuild.github.io/api/#platform), [conditions](https://esbuild.github.io/api/#conditions), [splitting](https://esbuild.github.io/api/#splitting), [incremental](https://esbuild.github.io/api/#incremental); issues [#442](https://github.com/evanw/esbuild/issues/442), [#1921](https://github.com/evanw/esbuild/issues/1921)
- Node.js: [Packages (exports, imports, conditions)](https://nodejs.org/api/packages.html), [ESM — CommonJS namespaces](https://nodejs.org/api/esm.html#commonjs-namespaces), [nodejs/cjs-module-lexer](https://github.com/nodejs/cjs-module-lexer)
- esm.sh: [README](https://github.com/esm-dev/esm.sh/blob/main/README.md), [esm-dev/cjs-module-lexer](https://github.com/esm-dev/cjs-module-lexer)
- Vite: [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling)
- HTML/Fetch/File API: [fetch a single module script](https://html.spec.whatwg.org/multipage/webappapis.html#fetch-a-single-module-script), [CORS check](https://fetch.spec.whatwg.org/#cors-check), [File API (blob URL storage key)](https://w3c.github.io/FileAPI/)
- Import maps: [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap), [Chrome 127 (integrity)](https://developer.chrome.com/release-notes/127), [caniuse: multiple import maps](https://caniuse.com/mdn-html_elements_script_type_importmap_multiple_import_maps)
- Chrome HTTP cache: [HTTP cache partitioning](https://developer.chrome.com/blog/http-cache-partitioning), [blink-dev: is-cross-site bit](https://groups.google.com/a/chromium.org/g/blink-dev/c/cG65eYPYf9w)
- React: [act](https://react.dev/reference/react/act)
- Sandpack: [Hosting the bundler](https://sandpack.codesandbox.io/docs/guides/hosting-the-bundler). Self-hosted бандлер не снимает вопрос, откуда берутся npm-пакеты: в документации это не описано.
- TypeScript: [@typescript/ata](https://github.com/microsoft/TypeScript-Website/tree/v2/packages/ata)
