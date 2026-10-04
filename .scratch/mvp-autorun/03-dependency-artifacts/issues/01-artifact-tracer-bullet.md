# 01: `codda build` собирает Dependency Artifact Course, Run берёт зависимости из него

**What to build:** Сквозной путь по [спеке](../spec.md) без кэша и без разбора ошибок. `codda build` пилотного Course React Hooks выводит точки входа из импортов Starter, Solution и Lesson Tests всех Lesson, выполняет `npm ci`, одним вызовом esbuild (`esm`, `splitting`, `browser`, development) собирает `deps/<hash>/` с CJS-обёртками (имена через `require()` в Node, `export default` = `module.exports`) и `importmap.json` (`imports` + `integrity` sha384 на каждый файл, включая chunk'и), и пишет в `course.json` поле `deps`. Compiler скачивает файлы по `importmap.json` один раз (`fetch` с `integrity`), разрешает specifier'ы и chunk'и из памяти и вшивает их в бандл. Golden Path и все Lesson React Hooks проходят на новом артефакте. PoC-скрипт зависимостей, `build:deps` и `public/deps/` удалены.

**Blocked by:** фича `lesson-manifest` (минимальный `codda build`, `course.json`, загрузчик Course), фича `runtime-hardening` (порядок фич в `README.md`)

**Status:** done

- [x] У пилотного Course есть `package.json` (`react`, `react-dom`, `@types/react`, `@types/react-dom`, точные версии) и `package-lock.json`, если их ещё нет
- [x] Точки входа — bare specifier'ы из Starter, Solution и Lesson Tests всех Lesson, разобранные esbuild'ом с `jsx: "automatic"` (`react/jsx-runtime` из TSX попадает сам); `./main` и `@codda/test` не попадают; список отсортирован и без повторов
- [x] `<hash>` папки — sha256 (16 hex) от `package-lock.json`, списка точек входа, версии esbuild, конфига сборки и константы версии пайплайна
- [x] Один вызов esbuild на все точки входа; ESM-модуль — как есть, CJS — обёртка; `@types/*` в JS не входят; шима `react-as-esm` нет
- [x] `importmap.json`: адреса `./deps/<hash>/<файл>` относительно корня сборки; `integrity` есть у каждого JS-файла папки и совпадает с sha384 файла
- [x] `course.json` содержит `"deps": "deps/<hash>/"`; страница разрешает его от своего адреса и передаёт адрес `importmap.json` в Compiler
- [x] Compiler скачивает `importmap.json` и файлы один раз за жизнь Worker'а; второй Run не делает запросов к `deps/`
- [x] Тест CLI как процесс: `codda build` на курсе-фикстуре с поддельными пакетами в `node_modules` (готовые `node_modules`, npm не вызывается, без сети): CJS-пакет с именованными экспортами — в выходе `deps/<hash>/`, `importmap.json` с `imports` на каждую точку входа и `integrity` на каждый файл, `course.json` с полем `deps`
- [x] Тест Runner: global setup собирает артефакт курса-фикстуры с настоящими `react`/`react-dom`; React-Lesson с `act` и `react-dom/client` даёт все PASS (один экземпляр React); `import React from "react"` (default) и `import { useState } from "react"` работают в одном файле
- [x] Тест Runner: CJS-пакет без `__esModule` — `import x from "pkg"` равен объекту `module.exports`
- [x] e2e Golden Path и офлайн-проверка зелёные на выходе `codda build`; в списке запросов `deps/<hash>/importmap.json` и файлы артефакта, все на наш origin
- [x] Удалены PoC-скрипт сборки зависимостей, npm-скрипт `build:deps`, `public/deps/`, копирование PoC-артефакта в `codda build`; `grep` по коду инструмента не находит `manifest.json` зависимостей и `build-deps`
- [x] `npm run typecheck`, `npm test`, `npm run test:e2e` зелёные; CI `check` зелёный (там `npm ci` курса-фикстуры идёт в registry по умолчанию) — прогон 37211927030 на `3c5249e`

## Comments

- Последний чекбокс не отмечен: `npm run typecheck`, `npm test` (107 passed, 1 skipped — прежний skip `runtime-hardening/02`), `npm run test:e2e` (14 passed) зелёные локально, в том числе с нуля без `node_modules` курсов; CI `check` подтвердит оркестратор после push.
- Сборщик — `packages/codda/cli/dependency-artifact.ts`, `buildDependencyArtifact(courseRoot, lessonIds, out)` → `{ deps }` (`"deps/<hash>/"` или `null`) или `{ errors }`. Его зовут `codda build`, dev-сервер (`vite.config.ts`) и global setup Runner-тестов.
- Точки входа: один esbuild-проход по `main.*`, `solution.*`, `lesson.test.*` каждого Lesson (все как TSX, `jsx: "automatic"`), плагин записывает каждый не относительный импорт кроме `@codda/test`. `import type` и неиспользуемые импорты esbuild выбрасывает — так же, как Compiler, поэтому набор совпадает с тем, что увидит Run.
- ESM или CJS — по файлу, в который esbuild разрешил точку входа: `.mjs`/`.cjs`, затем `"type"` ближайшего `package.json`, иначе регулярное выражение на `import`/`export` в начале строки (правило 6: грубо, но для пилота хватает; статический лексер — «MVP, часть 2» по спеке). ESM-модуль — сам себе точка входа, CJS — обёртка `const m = require(…); export default m; export { … }` с именами из `require()` в Node; имена экспортов в кавычках, так что подходят любые ключи.
- Имя файла точки входа — specifier с `/` → `__` (`react-dom__client-<hash>.js`), chunk'и — `chunk-<hash>.js`. Specifier файла берётся из metafile (`entryPoint`), а не из имени.
- npm в этом тикете: `npm ci` только когда нет `node_modules` Course; полное правило (сверка с `.package-lock.json`, вывод с префиксом `npm ci:`) — тикет 02. Кэша нет: артефакт собирается при каждом `codda build` прямо в `<out>/deps/<hash>/`.
- Compiler получает абсолютный адрес `importmap.json` в `CompileInput.importMap` (нет артефакта — поля нет). Адреса из `importmap.json` разрешаются от корня сборки — `new URL("../../", importMap)`. Артефакт загружается при первом Run, который импортирует пакет, и хранится в Worker по адресу `importmap.json`; провал загрузки не кэшируется. Текст ошибок загрузки и «не предусмотрен заданием» — тикет 04, пока прежний `Cannot resolve`.
- `npm run dev`: middleware `course.json` собирает артефакт заново на каждый запрос во временную папку и отдаёт `/deps/` байт в байт (Vite иначе трансформирует `.js` и ломает `integrity`). С кэшем тикета 02 повтор станет дешёвым.
- Runner-тесты: курс-фикстура `packages/codda/fixtures/react-course/` (один Lesson, `react`/`react-dom` 19.3.0, закоммичены `package.json` и `package-lock.json`). Global setup `vitest.global-setup.ts` собирает его артефакт в `fixtures/react-course/dist/` и отдаёт путь `importmap.json` через `provide`; сервер тестов раздаёт папку на `/fixture-build/`. `fixtures/` исключена из скана `boundary.test.ts` — это файлы Course, а не исходники.
- CJS без `__esModule` проверен на `react` (`import React from "react"` — обычный объект с `useState`, без `default`), отдельного поддельного CJS-пакета в браузере нет: его пришлось бы ставить `file:`-зависимостью, а это не точная версия.
- Фикстура `build.test.ts`: Lesson `alpha` (`.tsx`) больше не использует JSX — иначе ему нужен `react/jsx-runtime` и объявленный `react`; первый тест теперь проверяет `"deps": null` и отсутствие `deps/` (это же — пункт тикета 02 «Course без импортов пакетов», сам тикет 02 его отметит своим тестом Run).
- Тесты после кода: проверки запросов к `deps/` в `e2e/golden-path.e2e.ts` (список запросов первого Run, второй Run без запросов) дописаны после изменения Compiler и сразу были зелёными. CLI- и Runner-тесты написаны до кода и видены красными.
- Вне критериев, на заметку: native `esbuild` нужен CLI во время работы, а в `packages/codda/package.json` он в `devDependencies` (в репозитории это не мешает) — для `author-cli`.
