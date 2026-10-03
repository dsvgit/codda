# 01: Как собирать и доставлять Dependency Artifacts для произвольных npm-пакетов

Type: research
Status: open
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
