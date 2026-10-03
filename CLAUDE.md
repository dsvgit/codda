# codda

Платформа интерактивных курсов по программированию: студент читает задание, правит код в браузере, жмёт **Run tests** и получает PASS/FAIL. Весь код студента компилируется и исполняется **в браузере**, на собственном runtime, внутри полностью внутренней инфраструктуры.

Текущая стадия: **Golden Path PoC** — `.scratch/golden-path-poc/`. Дорожная карта — `docs/roadmap.md`. Как двигаться дальше — `docs/HOW-TO-PROCEED.md`.

## Жёсткие ограничения

- Никаких внешних сетевых зависимостей в runtime: ни CodeSandbox/Sandpack, ни CDN (unpkg, jsDelivr, esm.sh), ни npmjs.org. Всё, что грузит браузер, отдаётся с нашего origin. См. `docs/adr/0002-*`.
- Код студента исполняется только в `<iframe sandbox="allow-scripts">` **без** `allow-same-origin`. Общение с parent — только через `postMessage` с проверкой формы сообщения. См. `docs/adr/0003-*`.
- Компиляция — `esbuild-wasm` в Web Worker. `.wasm` отдаётся локально (`wasmURL`), не с CDN.
- Скоуп текущей стадии фиксирован в спеке. Не добавлять ни одной функции, которая не нужна для прохождения одного задания от начала до конца.

## Agent skills

### Issue tracker

Локальный markdown в `.scratch/<feature>/` (spec.md + issues/NN-*.md). См. `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` в корне репозитория. См. `docs/agents/domain.md`.
