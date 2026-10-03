# 01: Как собирать и доставлять Dependency Artifacts для произвольных npm-пакетов

Type: research
Status: resolved
Blocked by: None

## Question

Как CI превращает произвольный npm-пакет с точной версией в Dependency Artifact, который Compiler и Sandbox используют без сети (ADR-0002, ADR-0005)? Нужны факты из первоисточников (документация esbuild, спецификации import maps, исходники и опыт CodeSandbox, StackBlitz, esm.sh) по таким вопросам:

- CommonJS → ESM: default- и named-импорты CJS-пакетов, `__esModule`, interop esbuild (R9).
- `package.json` `exports`/`imports`, subpath-импорты, условия `browser`/`development`.
- peer- и shared-зависимости: один экземпляр `react` на Lesson, конфликты версий между Course и Lesson (зависимости задаются на уровне Course, Lesson добавляет свои).
- Вшивать артефакты в бандл на каждый Run или грузить в Sandbox отдельно (import maps, blob URLs) (R4). Что совместимо с `sandbox="allow-scripts"` без `allow-same-origin` (ADR-0003)?
- Development-сборка React для `act` (R5).
- Проверка целостности по content-hash; кэширование.
- Как определить, что пакет «работает в браузере» (Node built-ins, `process`, сетевые обращения при импорте), чтобы `codda test` падал с понятной ошибкой.
- Откуда брать `.d.ts` пакета для TS-подсказок: из того же артефакта или отдельно.

Registry берётся из `.npmrc` или используется registry по умолчанию (ADR-0006).

Ответ — сравнение вариантов с рекомендацией и ссылками на первоисточники. Решение принимается на его основе (ADR).

Research: docs/research/dependency-artifacts.md (ветка research/dependency-artifacts)

## Answer

Факты и сравнение вариантов — в [docs/research/dependency-artifacts.md](../../../docs/research/dependency-artifacts.md). Это рекомендация; решение (ADR) — в тикете «ADR: сборка и доставка Dependency Artifacts», после замеров из тикета «Эксперимент: транспорт Dependency Artifacts в Sandbox».

Рекомендация research (§8):

1. **Артефакт на набор зависимостей** (Course ∪ Lesson), а не на пакет: `npm ci` по lockfile набора + один `esbuild.build` (`esm`, `splitting`, `platform: browser`, `development`). Один экземпляр React без шимов. Конфликт версий Course/Lesson — ошибка `codda test`.
2. **CJS → ESM (R9):** обёртка с `export default = module.exports` + именованные экспорты из статического лексера (esm.sh), fallback — `require` в Node.
3. **Доставка (R4):** отдельно от кода студента, через import map в `srcdoc`; Compiler собирает только код студента, тесты и Test Harness с `external` на specifier'ы набора. Транспорт: URL на нашем origin + CORS + `integrity` (вариант 2), если Chrome кэширует модули в opaque-origin Sandbox; иначе blob из Worker через `postMessage` (вариант 3). Нужен замер.
4. **Только development-сборка** в MVP (R5: `act` есть только в ней); `mode` — в ключе кэша.
5. **Integrity:** content-hash в имени, `immutable`, sha384 в манифесте.
6. **«Работает в браузере»:** ошибка сборки на Node built-ins → предупреждение на свободные `process`/`Buffer` → smoke-импорт в Chromium (Playwright) с перехватом внешних запросов.
7. **`.d.ts`:** отдельный JSON-артефакт типов набора (типы пакета или `@types/*`), его грузит TS Worker.
