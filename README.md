# codda

Платформа интерактивных курсов по программированию. Студент читает задание, правит код в браузере, жмёт **Run tests** и получает PASS/FAIL. Код студента компилируется и исполняется **прямо в браузере**, на собственном Runtime, без обращения к внешним сервисам.

Сейчас это **Golden Path PoC**: одна страница, один захардкоженный Lesson, один редактируемый файл. Цель — проверить техническую гипотезу, а не сделать продукт. Подробности — в [спеке PoC](.scratch/golden-path-poc/spec.md).

## Требования

- **Node.js 22.12+ или 24** (проверено на 24.20) и npm.
- **Chrome / Chromium.** Другие браузеры в PoC не поддерживаются.
- Для тестов нужен Chromium для Playwright: он ставится один раз командой ниже, и для этого нужен доступ к сети или к внутреннему зеркалу. Само приложение в работе сеть не использует.

## Быстрый старт

```bash
npm install
npx playwright install chromium   # один раз, нужен только для тестов
npm run dev
```

Откройте адрес, который напечатает Vite (обычно http://localhost:5173), и пройдите сценарий:

1. Нажмите **Run tests** — увидите `0 / 2 passed` и ошибки вида `expected 5, got -1`.
2. В редакторе замените `a - b` на `a + b`.
3. Снова **Run tests** — `2 / 2 passed`.

Первый Run занимает около секунды, потому что загружается и инициализируется `esbuild.wasm` (~14 МБ). Последующие — около 100–150 мс.

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | Dev-сервер Vite с hot reload |
| `npm test` | Все тесты в headless Chromium (Vitest browser mode + Playwright) |
| `npx vitest run src/runtime/runner.test.ts` | Один файл тестов |
| `npx vitest` | Тесты в watch-режиме |
| `npm run typecheck` | Проверка типов TypeScript |
| `npm run build` | Typecheck + production-сборка в `dist/` |
| `npm run preview` | Отдать собранный `dist/` локально, чтобы проверить сборку |

## Тесты

Тесты запускаются в настоящем браузере, а не в jsdom: Runtime нужны Web Worker, WebAssembly и iframe.

- `src/runtime/runner.test.ts` — главный шов, `run({ source, tests }) → TestReport`: исходник студента и Lesson Tests на входе, Test Report на выходе.
- `src/App.test.tsx` — основной сценарий через UI: Run → FAIL → исправление в редакторе → Run → PASS.

На стадии PoC действует упрощённое правило: на каждом шаге — один happy-path тест, остальные случаи потом (см. раздел «Тесты» в [CLAUDE.md](CLAUDE.md)).

## Как это устроено

```
CodeMirror ──source──▶ Runner ──▶ Compiler (Web Worker, esbuild-wasm)
                         │              │ один IIFE-бандл: код студента + Lesson Tests + Test Harness
                         ▼              ▼
                     Sandbox: новый <iframe sandbox="allow-scripts"> на каждый Run
                         │ Test Harness выполняет тесты
                         ▼
                   postMessage { type: "codda:report", runId, report } ──▶ UI: ✓/✗ и «N / M passed»
```

| Файл | Роль |
|---|---|
| `src/lesson.ts` | Lesson: `instructions`, `starter`, `tests` — строковые константы |
| `src/App.tsx`, `src/Editor.tsx` | Страница: Instructions, CodeMirror, кнопка Run, Test Report |
| `src/runtime/runner.ts` | Runner: компиляция → новый Sandbox → ожидание отчёта; проверяет `event.source`, `type`, `runId` и форму отчёта |
| `src/runtime/compiler.ts` | Клиент Compiler в основном потоке: держит Worker «тёплым» между Run |
| `src/runtime/compiler.worker.ts` | Compiler: esbuild-wasm с виртуальным резолвером, всё собирается из памяти |
| `src/runtime/harness.ts` | Test Harness: `test`, `expect().toBe/toEqual`, async-тесты; вшивается в бандл как модуль `@codda/test` |
| `src/runtime/types.ts` | `TestReport`, `CompileResult` и форма сообщения Sandbox → parent |

### Как поменять задание

Всё задание лежит в `src/lesson.ts`. Lesson Tests импортируют `test`/`expect` из `@codda/test`, а код студента — из `./App`:

```ts
import { test, expect } from "@codda/test";
import { add } from "./App";

test("adds two positive numbers", () => {
  expect(add(2, 3)).toBe(5);
});
```

## Жёсткие ограничения

- **Никакой внешней сети в runtime:** ни CDN, ни npmjs.org, ни CodeSandbox. Всё, включая `esbuild.wasm`, отдаётся с нашего origin ([ADR-0002](docs/adr/0002-fully-internal-infrastructure.md)).
- **Код студента — только в `<iframe sandbox="allow-scripts">` без `allow-same-origin`.** Общение с parent — только через `postMessage` с проверкой формы ([ADR-0003](docs/adr/0003-sandbox-iframe-without-same-origin.md)).
- **Скоуп PoC зафиксирован в спеке.** Не добавлять функций, которые не нужны для прохождения одного задания.

## Известные ограничения на текущем этапе

- Если код студента бросает исключение вне теста или зацикливается, Run висит на «Running…» — помогает только перезагрузка страницы. Ошибки компиляции, runtime-ошибки и timeout — тикет [02](.scratch/golden-path-poc/issues/02-compile-runtime-timeout-errors.md).
- Отчёты, отличные от списка тестов, UI пока показывает сырым JSON.
- React/TSX и Dependency Artifact — тикет [03](.scratch/golden-path-poc/issues/03-react-counter-with-dependency-artifact.md); e2e с заблокированной сетью — тикет [04](.scratch/golden-path-poc/issues/04-offline-isolation-e2e.md).

## Если что-то не работает

- **`npm test` ругается, что не найден браузер** — выполните `npx playwright install chromium`.
- **Vitest пишет «Vite unexpectedly reloaded a test»** или тест падает на первом прогоне после установки новой зависимости — добавьте её в `optimizeDeps.include` в `vite.config.ts`.
- **Run ничего не показывает** — откройте DevTools: ошибки esbuild-wasm видны в консоли Worker, ошибки кода студента — в консоли iframe.

## Документация

- [CONTEXT.md](CONTEXT.md) — глоссарий: Lesson, Run, Sandbox, Test Report, Dependency Artifact…
- [docs/adr/](docs/adr/) — архитектурные решения
- [docs/roadmap.md](docs/roadmap.md) — дорожная карта до MVP
- [docs/HOW-TO-PROCEED.md](docs/HOW-TO-PROCEED.md) — как работать над проектом (скиллы, порядок тикетов)
- [.scratch/golden-path-poc/](.scratch/golden-path-poc/) — спека и тикеты PoC
