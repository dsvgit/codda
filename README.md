# codda

Платформа интерактивных курсов по программированию. Студент читает задание, правит код в браузере, жмёт **▶ Запустить тесты** и получает PASS/FAIL. Код студента компилируется и исполняется **прямо в браузере**, на собственном Runtime, без обращения к внешним сервисам.

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

`npm run dev` открывает курс React Hooks из `courses/react-hooks/`: `course.json` на каждый запрос собирает из файлов курса middleware Vite (`packages/codda/vite.config.ts`, курс задаёт переменная `CODDA_COURSE` в корневом скрипте). Правка UI видна сразу, правка курса — после перезагрузки страницы. Откройте адрес, который напечатает Vite (обычно http://localhost:5173), и пройдите сценарий:

1. Нажмите **▶ Запустить тесты** — увидите `FAIL · 2 / 3` и `✗ opens on click — …`.
2. В редакторе допишите `Spoiler` (готовое решение — `courses/react-hooks/use-state/solution.tsx`).
3. Снова **▶ Запустить тесты** — `PASS · 3 / 3` и баннер «Все тесты пройдены». **↺ Сбросить** возвращает Starter (`Ctrl/Cmd+Z` отменяет), **Показать решение** открывает Solution во вкладке «Решение».

Другой Lesson открывается фрагментом `#/<id Lesson>`, например `/#/use-effect`; без фрагмента — первый Lesson курса.

Пилот: [dsvgit.github.io/codda](https://dsvgit.github.io/codda/). Каждый push в `main` после зелёной проверки CI выкладывается туда (`.github/workflows/ci.yml`): Course Build `codda build courses/react-hooks`, тот же, что проверил e2e. Сборка использует относительные URL, поэтому работает из любого подпути.

Первый Run занимает около секунды, потому что загружаются и инициализируются `esbuild.wasm` (~14 МБ) и Dependency Artifacts с React (~1.2 МБ). Последующие — около 0.5 с: React вшивается в бандл заново на каждый Run.

## Раскладка репозитория

Репозиторий — npm workspaces с одним пакетом. Код инструмента (UI, Runtime, CLI) лежит в `packages/codda/`, курсы — в `courses/` и в workspaces не входят: у Course свои зависимости (ADR-0007). В корне — общие npm-скрипты, e2e (`e2e/`, `playwright.config.ts`) и один `package-lock.json`.

CLI `codda` запускается без сборки (TypeScript в Node 24): `npx codda --help` из корня или из папки курса. Пока есть `--help`, `--version` и минимальный `codda build <путь к курсу> [--out <папка>]`: проверяет Course, копирует собранный UI из `packages/codda/dist-tool/` (сначала `npm run build`), кладёт рядом `course.json` и `deps/`; по умолчанию в `<путь>/dist`. Остальные команды для авторов курсов появятся позже. Курс вне этого репозитория подключит его через `"codda": "file:…/packages/codda"` в `devDependencies`.

## Команды

Все команды — из корня репозитория.


| Команда | Что делает |
|---|---|
| `npm run dev` | Dev-сервер Vite с hot reload на курсе `courses/react-hooks` |
| `npm test` | Все тесты в headless Chromium (Vitest browser mode + Playwright) |
| `npm run test:e2e` | Собирает UI в `packages/codda/dist-tool/`, затем `codda build courses/react-hooks` (в `courses/react-hooks/dist/`) и гоняет e2e на Playwright по этой сборке из подпути `/codda/`, как на GitHub Pages (проект `pages`); на `npm run dev` — один smoke-тест (проект `dev`). Внешняя сеть заблокирована |
| `npm test -- src/runtime/runner.test.ts` | Один файл тестов (путь от `packages/codda/`) |
| `npm test -- --project cli` | Только тесты CLI (Node), без браузера |
| `npm run typecheck` | Проверка типов TypeScript |
| `npm run build` | Typecheck + production-сборка UI в `packages/codda/dist-tool/` |
| `npm run preview` | Отдать собранный `dist-tool/` локально, чтобы проверить сборку |

## Тесты

Тесты запускаются в настоящем браузере, а не в jsdom: Runtime нужны Web Worker, WebAssembly и iframe.

- `packages/codda/src/runtime/runner.test.ts` — главный шов, `run({ source, tests }) → TestReport`: исходник студента и Lesson Tests на входе, Test Report на выходе.
- `packages/codda/src/App.test.tsx` — экран Lesson на Course-литерале: Test Report (FAIL, PASS, ошибка компиляции, runtime-ошибка, timeout), вкладки «Тесты» и «Решение», Reset и его отмена, раскладка на 1280×800, заголовки, неизвестный id, смена Lesson.
- `packages/codda/cli/codda.test.ts` — CLI как его вызывает автор: `npx codda …` из корня и из `courses/`, коды выхода.
- `packages/codda/cli/build.test.ts` — `codda build` процессом на временном Course, который пишет сам тест: содержимое сборки, ошибки Course, коды выхода.
- `packages/codda/cli/deps.test.ts` — Dependency Artifact из `codda build` на Course с поддельными пакетами в `node_modules` (без npm и сети). Runner-тесты берут артефакт `packages/codda/fixtures/react-course/` с настоящим React: его собирает global setup (`vitest.global-setup.ts`, `npm ci` из registry, если нет `node_modules`).
- `packages/codda/cli/dev-server.test.ts` — настоящий dev-сервер Vite отдаёт `course.json` временного Course, ошибки Course — ответ 500.
- `packages/codda/cli/boundary.test.ts` — граница ADR-0006: ни один импорт исходников пакета `codda` (включая `?raw` и `?url` Vite) не ведёт за пределы пакета, кроме `node_modules`. Обычные импорты ловит ещё и `rootDir` в tsconfig пакета.
- `e2e/` — Playwright против Course Build из `/codda/` и dev-сервера (`npm run test:e2e`). Тесты открывают страницу относительно `baseURL` (`page.goto("./")`), а не `"/"`. `golden-path.e2e.ts` проходит Lesson `use-state`. `course.e2e.ts` — загрузка `course.json` (ожидание, 404, обрыв сети), `#/<id>`, неизвестный id и Solution каждого Lesson → PASS. `dev.e2e.ts` — smoke-тест `npm run dev`. `sandbox-isolation.e2e.ts` подсовывает через редактор враждебный код студента: чтение parent/cookies/storage, поддельные сообщения, `fetch` в Internet. Фикстура `e2e/offline.ts` обрывает любой запрос не на localhost, печатает список всех запросов страницы и валит тест, если был хоть один внешний.

На стадии PoC действует упрощённое правило: на каждом шаге — один happy-path тест, остальные случаи потом (см. раздел «Тесты» в [CLAUDE.md](CLAUDE.md)).

## Как это устроено

```
CodeMirror ──source──▶ Runner ──▶ Compiler (Web Worker, esbuild-wasm)
                         │              │ один IIFE-бандл: код студента + Lesson Tests + Test Harness
                         ▼              ▼
                     Sandbox: новый <iframe sandbox="allow-scripts"> на каждый Run
                         │ Test Harness выполняет тесты
                         ▼
                   postMessage { type: "codda:report", runId, report } ──▶ UI: ✓/✗ и «PASS/FAIL · N / M»
```

| Файл (в `packages/codda/`) | Роль |
|---|---|
| `src/main.tsx` | Загрузка `course.json` и выбор Lesson по `#/<id>` |
| `src/course-data.ts` | Тип `course.json` — граница курса и инструмента (ADR-0006, ADR-0008) |
| `src/App.tsx`, `src/Editor.tsx` | Экран Lesson: Instructions, тулбар, CodeMirror, вкладки «Тесты» и «Решение», Test Report |
| `src/runtime/runner.ts` | Runner: компиляция → новый Sandbox → ожидание отчёта; проверяет `event.source`, `type`, `runId` и форму отчёта |
| `src/runtime/compiler.ts` | Клиент Compiler в основном потоке: держит Worker «тёплым» между Run |
| `src/runtime/compiler.worker.ts` | Compiler: esbuild-wasm с виртуальным резолвером, всё собирается из памяти; JSX — automatic runtime |
| `cli/dependency-artifact.ts` | Dependency Artifact Course (ADR-0007): точки входа из импортов Lesson, `npm ci`, один вызов native esbuild в `deps/<hash>/` и `importmap.json` с `integrity`. Compiler скачивает файлы со своего origin и вшивает в бандл — Sandbox с opaque origin сам их загрузить не может (ADR-0003) |
| `src/runtime/harness.ts` | Test Harness: `test`, `expect().toBe/toEqual`, async-тесты; вшивается в бандл как модуль `@codda/test` |
| `src/runtime/types.ts` | `TestReport`, `CompileResult` и форма сообщения Sandbox → parent |

### Как поменять задание

Lesson — папка курса (`lesson.md`, `main.tsx`, `solution.tsx`, `lesson.test.tsx`), порядок задаёт `course.yaml`. Lesson Tests импортируют `test`/`expect` из `@codda/test`, код студента — из `./main`, а React — как обычно, из `react` и `react-dom/client` (резолвится в Dependency Artifacts). Пример задания на чистом TypeScript:

```ts
import { test, expect } from "@codda/test";
import { add } from "./main";

test("adds two positive numbers", () => {
  expect(add(2, 3)).toBe(5);
});
```

## Жёсткие ограничения

- **Никакой внешней сети в runtime:** ни CDN, ни npmjs.org, ни CodeSandbox. Всё, включая `esbuild.wasm`, отдаётся с нашего origin ([ADR-0002](docs/adr/0002-fully-internal-infrastructure.md)).
- **Код студента — только в `<iframe sandbox="allow-scripts">` без `allow-same-origin`.** Общение с parent — только через `postMessage` с проверкой формы ([ADR-0003](docs/adr/0003-sandbox-iframe-without-same-origin.md)).
- **Скоуп PoC зафиксирован в спеке.** Не добавлять функций, которые не нужны для прохождения одного задания.

## Известные ограничения на текущем этапе

- Timeout (5 с) работает, только пока Sandbox живёт в отдельном процессе от страницы. Chrome так делает по умолчанию; Playwright-овский `chrome-headless-shell` — нет, поэтому тесты запускаются в полном Chromium (`channel: "chromium"` в `packages/codda/vite.config.ts`).
- Если исключение вылетает из асинхронного кода уже во время выполнения тестов, весь Run показывается как runtime-ошибка, а не как упавший тест.
- Импортировать можно только `react` (именованные экспорты, без `import React from "react"`), `react/jsx-runtime` и `react-dom/client`. Артефакты — development-сборка React: `act` в production-сборке не работает.
- Sandbox не закрыт от сети: `fetch` из кода студента уходит наружу (с `Origin: null`, ответ отрезает CORS). В e2e такие запросы блокирует сам тест; CSP и отдельный origin для Sandbox — этап Security после PoC. Подробности — в [тикете 04](.scratch/golden-path-poc/issues/04-offline-isolation-e2e.md).
- Код студента может прислать поддельный отчёт со своим `runId`. Результат в браузере — подсказка студенту, а не оценка ([ADR-0004](docs/adr/0004-browser-only-grading-first.md)).

## Если что-то не работает

- **`npm test` ругается, что не найден браузер** — выполните `npx playwright install chromium`.
- **Тест с бесконечным циклом висит дольше 20 с, а Vitest не может его прервать** — тесты запущены в `chrome-headless-shell`, где Sandbox делит процесс со страницей. Проверьте `launchOptions.channel` в `packages/codda/vite.config.ts`.
- **Vitest пишет «Vite unexpectedly reloaded a test»** или тест падает на первом прогоне после установки новой зависимости — добавьте её в `optimizeDeps.include` в `packages/codda/vite.config.ts`.
- **Run ничего не показывает** — откройте DevTools: ошибки esbuild-wasm видны в консоли Worker, ошибки кода студента — в консоли iframe.

## Документация

- [CONTEXT.md](CONTEXT.md) — глоссарий: Lesson, Run, Sandbox, Test Report, Dependency Artifact…
- [docs/adr/](docs/adr/) — архитектурные решения
- [docs/roadmap.md](docs/roadmap.md) — дорожная карта до MVP
- [docs/poc-report.md](docs/poc-report.md) — итоги PoC: ответы на пять вопросов, замеры, риски, решение GO
- [docs/ai-workflow.md](docs/ai-workflow.md) — процесс разработки с AI: скиллы, тикеты, роли человека и агента
- [docs/HOW-TO-PROCEED.md](docs/HOW-TO-PROCEED.md) — следующие шаги: от PoC к MVP
- [.scratch/golden-path-poc/](.scratch/golden-path-poc/) — спека и тикеты PoC
