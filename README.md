# codda

Платформа интерактивных курсов по программированию. Студент читает задание, правит код в браузере, жмёт **Run tests** и получает PASS/FAIL. Код студента компилируется и исполняется **прямо в браузере**, на собственном Runtime, без обращения к внешним сервисам.

Сейчас это **Golden Path PoC** (завершён, решение GO — [PoC Report](docs/poc-report.md)): одна страница, один захардкоженный Lesson, один редактируемый файл. Цель — проверить техническую гипотезу, а не сделать продукт. Подробности — в [спеке PoC](.scratch/golden-path-poc/spec.md).

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

1. Нажмите **Run tests** — увидите `0 / 3 passed` и ошибки вида `expected "1", got "?"`.
2. В редакторе допишите `Counter`: `useState(0)`, число в `<output>`, `onClick` у кнопок `+` и `−` (готовое решение — `lesson.solution` в `src/lesson.ts`).
3. Снова **Run tests** — `3 / 3 passed`.

Другие Lesson для ручного прогона — курс React Hooks в `courses/react-hooks/`: откройте `/?lesson=react-hooks/01-use-state` (id — ключи в `courses/index.ts`). Решение каждого — поле `solution` в файле Lesson.

Первый Run занимает около секунды, потому что загружаются и инициализируются `esbuild.wasm` (~14 МБ) и Dependency Artifacts с React (~1.2 МБ). Последующие — около 0.5 с: React вшивается в бандл заново на каждый Run.

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | Dev-сервер Vite с hot reload |
| `npm test` | Все тесты в headless Chromium (Vitest browser mode + Playwright) |
| `npm run test:e2e` | e2e на Playwright: сам поднимает dev-сервер, проходит Golden Path и проверяет изоляцию Sandbox; внешняя сеть заблокирована |
| `npx vitest run src/runtime/runner.test.ts` | Один файл тестов |
| `npx vitest` | Тесты в watch-режиме |
| `npm run typecheck` | Проверка типов TypeScript |
| `npm run build` | Typecheck + production-сборка в `dist/` |
| `npm run preview` | Отдать собранный `dist/` локально, чтобы проверить сборку |
| `npm run build:deps` | Пересобрать Dependency Artifacts (`react`, `react/jsx-runtime`, `react-dom/client`) в `public/deps/` из `node_modules`; результат коммитится |

## Тесты

Тесты запускаются в настоящем браузере, а не в jsdom: Runtime нужны Web Worker, WebAssembly и iframe.

- `src/runtime/runner.test.ts` — главный шов, `run({ source, tests }) → TestReport`: исходник студента и Lesson Tests на входе, Test Report на выходе.
- `src/App.test.tsx` — основной сценарий через UI: Run → FAIL → исправление в редакторе → Run → PASS.
- `e2e/` — Playwright против настоящего dev-сервера (`npm run test:e2e`). `golden-path.e2e.ts` проходит тот же сценарий на странице приложения. `sandbox-isolation.e2e.ts` подсовывает через редактор враждебный код студента: чтение parent/cookies/storage, поддельные сообщения, `fetch` в Internet. Фикстура `e2e/offline.ts` обрывает любой запрос не на localhost, печатает список всех запросов страницы и валит тест, если был хоть один внешний.

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
| `src/lesson.ts` | Lesson «React: Counter»: `instructions`, `starter`, `solution`, `tests` — строковые константы |
| `src/App.tsx`, `src/Editor.tsx` | Страница: Instructions, CodeMirror, кнопка Run, Test Report |
| `src/runtime/runner.ts` | Runner: компиляция → новый Sandbox → ожидание отчёта; проверяет `event.source`, `type`, `runId` и форму отчёта |
| `src/runtime/compiler.ts` | Клиент Compiler в основном потоке: держит Worker «тёплым» между Run |
| `src/runtime/compiler.worker.ts` | Compiler: esbuild-wasm с виртуальным резолвером, всё собирается из памяти; JSX — automatic runtime |
| `scripts/build-deps.mjs`, `public/deps/` | Dependency Artifacts: React, собранный native esbuild в ESM, и `manifest.json` «specifier → файл». Compiler скачивает их со своего origin и вшивает в бандл — Sandbox с opaque origin сам их загрузить не может (ADR-0003) |
| `src/runtime/harness.ts` | Test Harness: `test`, `expect().toBe/toEqual`, async-тесты; вшивается в бандл как модуль `@codda/test` |
| `src/runtime/types.ts` | `TestReport`, `CompileResult` и форма сообщения Sandbox → parent |

### Как поменять задание

Всё задание лежит в `src/lesson.ts`. Lesson Tests импортируют `test`/`expect` из `@codda/test`, код студента — из `./App`, а React — как обычно, из `react` и `react-dom/client` (резолвится в Dependency Artifacts). Пример задания на чистом TypeScript:

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

- Timeout (5 с) работает, только пока Sandbox живёт в отдельном процессе от страницы. Chrome так делает по умолчанию; Playwright-овский `chrome-headless-shell` — нет, поэтому тесты запускаются в полном Chromium (`channel: "chromium"` в `vite.config.ts`).
- Если исключение вылетает из асинхронного кода уже во время выполнения тестов, весь Run показывается как runtime-ошибка, а не как упавший тест.
- Импортировать можно только `react` (именованные экспорты, без `import React from "react"`), `react/jsx-runtime` и `react-dom/client`. Артефакты — development-сборка React: `act` в production-сборке не работает.
- Sandbox не закрыт от сети: `fetch` из кода студента уходит наружу (с `Origin: null`, ответ отрезает CORS). В e2e такие запросы блокирует сам тест; CSP и отдельный origin для Sandbox — этап Security после PoC. Подробности — в [тикете 04](.scratch/golden-path-poc/issues/04-offline-isolation-e2e.md).
- Код студента может прислать поддельный отчёт со своим `runId`. Результат в браузере — подсказка студенту, а не оценка ([ADR-0004](docs/adr/0004-browser-only-grading-first.md)).

## Если что-то не работает

- **`npm test` ругается, что не найден браузер** — выполните `npx playwright install chromium`.
- **Тест с бесконечным циклом висит дольше 20 с, а Vitest не может его прервать** — тесты запущены в `chrome-headless-shell`, где Sandbox делит процесс со страницей. Проверьте `launchOptions.channel` в `vite.config.ts`.
- **Vitest пишет «Vite unexpectedly reloaded a test»** или тест падает на первом прогоне после установки новой зависимости — добавьте её в `optimizeDeps.include` в `vite.config.ts`.
- **Run ничего не показывает** — откройте DevTools: ошибки esbuild-wasm видны в консоли Worker, ошибки кода студента — в консоли iframe.

## Документация

- [CONTEXT.md](CONTEXT.md) — глоссарий: Lesson, Run, Sandbox, Test Report, Dependency Artifact…
- [docs/adr/](docs/adr/) — архитектурные решения
- [docs/roadmap.md](docs/roadmap.md) — дорожная карта до MVP
- [docs/poc-report.md](docs/poc-report.md) — итоги PoC: ответы на пять вопросов, замеры, риски, решение GO
- [docs/ai-workflow.md](docs/ai-workflow.md) — процесс разработки с AI: скиллы, тикеты, роли человека и агента
- [docs/HOW-TO-PROCEED.md](docs/HOW-TO-PROCEED.md) — следующие шаги: от PoC к MVP
- [.scratch/golden-path-poc/](.scratch/golden-path-poc/) — спека и тикеты PoC
