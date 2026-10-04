# 01: `codda build` собирает Dependency Artifact Course, Run берёт зависимости из него

**What to build:** Сквозной путь по [спеке](../spec.md) без кэша и без разбора ошибок. `codda build` пилотного Course React Hooks выводит точки входа из импортов Starter, Solution и Lesson Tests всех Lesson, выполняет `npm ci`, одним вызовом esbuild (`esm`, `splitting`, `browser`, development) собирает `deps/<hash>/` с CJS-обёртками (имена через `require()` в Node, `export default` = `module.exports`) и `importmap.json` (`imports` + `integrity` sha384 на каждый файл, включая chunk'и), и пишет в `course.json` поле `deps`. Compiler скачивает файлы по `importmap.json` один раз (`fetch` с `integrity`), разрешает specifier'ы и chunk'и из памяти и вшивает их в бандл. Golden Path и все Lesson React Hooks проходят на новом артефакте. PoC-скрипт зависимостей, `build:deps` и `public/deps/` удалены.

**Blocked by:** фича `lesson-manifest` (минимальный `codda build`, `course.json`, загрузчик Course), фича `runtime-hardening` (порядок фич в `autorun.md`)

**Status:** ready-for-agent

- [ ] У пилотного Course есть `package.json` (`react`, `react-dom`, `@types/react`, `@types/react-dom`, точные версии) и `package-lock.json`, если их ещё нет
- [ ] Точки входа — bare specifier'ы из Starter, Solution и Lesson Tests всех Lesson, разобранные esbuild'ом с `jsx: "automatic"` (`react/jsx-runtime` из TSX попадает сам); `./main` и `@codda/test` не попадают; список отсортирован и без повторов
- [ ] `<hash>` папки — sha256 (16 hex) от `package-lock.json`, списка точек входа, версии esbuild, конфига сборки и константы версии пайплайна
- [ ] Один вызов esbuild на все точки входа; ESM-модуль — как есть, CJS — обёртка; `@types/*` в JS не входят; шима `react-as-esm` нет
- [ ] `importmap.json`: адреса `./deps/<hash>/<файл>` относительно корня сборки; `integrity` есть у каждого JS-файла папки и совпадает с sha384 файла
- [ ] `course.json` содержит `"deps": "deps/<hash>/"`; страница разрешает его от своего адреса и передаёт адрес `importmap.json` в Compiler
- [ ] Compiler скачивает `importmap.json` и файлы один раз за жизнь Worker'а; второй Run не делает запросов к `deps/`
- [ ] Тест CLI как процесс: `codda build` на курсе-фикстуре с поддельными пакетами в `node_modules` (без `CI`, без сети): CJS-пакет с именованными экспортами — в выходе `deps/<hash>/`, `importmap.json` с `imports` на каждую точку входа и `integrity` на каждый файл, `course.json` с полем `deps`
- [ ] Тест Runner: global setup собирает артефакт курса-фикстуры с настоящими `react`/`react-dom`; React-Lesson с `act` и `react-dom/client` даёт все PASS (один экземпляр React); `import React from "react"` (default) и `import { useState } from "react"` работают в одном файле
- [ ] Тест Runner: CJS-пакет без `__esModule` — `import x from "pkg"` равен объекту `module.exports`
- [ ] e2e Golden Path и офлайн-проверка зелёные на выходе `codda build`; в списке запросов `deps/<hash>/importmap.json` и файлы артефакта, все на наш origin
- [ ] Удалены PoC-скрипт сборки зависимостей, npm-скрипт `build:deps`, `public/deps/`, копирование PoC-артефакта в `codda build`; `grep` по коду инструмента не находит `manifest.json` зависимостей и `build-deps`
- [ ] `npm run typecheck`, `npm test`, `npm run test:e2e` зелёные; CI `check` зелёный (там `npm ci` курса-фикстуры идёт в registry по умолчанию)
