# codda

Платформа интерактивных курсов по программированию. Студент читает задание, правит код в браузере, жмёт **▶ Запустить тесты** и получает PASS/FAIL. Код студента компилируется и исполняется **прямо в браузере**, на собственном Runtime, без обращения к внешним сервисам.

**MVP собран, идёт пилот на людях.** Пилот — Course React Hooks (5 Lesson) по адресу [dsvgit.github.io/codda](https://dsvgit.github.io/codda/), только Chrome. Итог MVP и сверка с «Определением MVP» — в `## Итог` [спеки `pilot-course`](.scratch/mvp-autorun/07-pilot-course/spec.md), сценарий пилота — в [тикете 03](.scratch/mvp-autorun/07-pilot-course/issues/03-pilot-on-people.md).

**Как сделать свой курс** — [README пакета `codda`](packages/codda/README.md): от `codda init` до CI.

Каждый push в `main` после зелёной проверки CI выкладывается на пилот (`.github/workflows/ci.yml`): `dist/` пилотного курса (переменная `PILOT_COURSE`, сейчас `courses/react-hooks`), который тот же прогон проверил `npx codda test` и собрал `npx codda build`. Прогресс студента хранится в `localStorage` и привязан к адресу, поэтому адрес пилота до конца пилота не меняется.

## Разработка инструмента

### Требования

- **Node.js 24** (проверено на 24.20) и npm.
- **Chromium для Playwright** — для тестов и `codda test`: `npx playwright install chromium` один раз (нужен доступ к сети или к зеркалу, `PLAYWRIGHT_DOWNLOAD_HOST`). Сам курс в работе сеть не использует.

### Быстрый старт

```bash
npm install
npx playwright install chromium   # один раз
npm run dev
```

`npm run dev` открывает курс React Hooks из `courses/react-hooks/` на dev-сервере Vite (обычно http://localhost:5173). `course.json` на каждый запрос собирает из файлов курса middleware Vite (`packages/codda/vite.config.ts`, курс задаёт переменная `CODDA_COURSE` в корневом скрипте). Правка UI видна сразу, правка курса — после перезагрузки страницы. Посмотреть курс глазами автора, с пересборкой по правке файлов курса, — `npx codda dev courses/react-hooks`.

## Раскладка репозитория

Репозиторий — npm workspaces с одним пакетом. Код инструмента (UI, Runtime, CLI) лежит в `packages/codda/`, курсы — в `courses/` и в workspaces не входят: у Course свои зависимости (ADR-0007). В корне — общие npm-скрипты, e2e (`e2e/`, `playwright.config.ts`) и один `package-lock.json`.

CLI `codda` запускается без сборки (TypeScript в Node 24): `npx codda --help` из корня или из папки курса. Команды автора (`codda init`, `lesson`, `dev`, `test`, `build`) описаны в [README пакета](packages/codda/README.md). Курс этого репозитория подключает пакет через `"codda": "file:../../packages/codda"` в `devDependencies`.

CI этого репозитория после проверок инструмента в каждой папке `courses/*` с `course.yaml` выполняет то же, что CI репозитория курса: `npm ci`, `npx codda test`, `npx codda build`. Новый курс в `courses/` в workflow добавлять не нужно. Шаблоны CI для репозитория курса (`codda init --ci github|gitlab`) — `packages/codda/templates/ci/`.

## Команды

Все команды — из корня репозитория.


| Команда | Что делает |
|---|---|
| `npm run dev` | Dev-сервер Vite с hot reload на курсе `courses/react-hooks` |
| `npm test` | Все тесты в headless Chromium (Vitest browser mode + Playwright) |
| `npm run test:e2e` | Собирает UI в `packages/codda/dist-tool/`, затем `codda build courses/react-hooks` (в `courses/react-hooks/dist/`) и гоняет e2e на Playwright по этой сборке из подпути `/codda/`, как на GitHub Pages (проект `pages`); на `npm run dev` (проект `dev`) — smoke-тест `dev.e2e.ts` и `navigation`, `workspace`, `progress`, которые идут и по сборке. Внешняя сеть заблокирована |
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
- `packages/codda/cli/ci-templates.test.ts` — `codda init --ci github|gitlab`: шаблон после подстановки разбирается пакетом `yaml` — job'ы, порядок команд `codda`, выкладка только на `main`.
- `packages/codda/cli/deps.test.ts` — Dependency Artifact из `codda build` на Course с поддельными пакетами в `node_modules` (без npm и сети). Runner-тесты берут артефакт `packages/codda/fixtures/react-course/` с настоящим React: его собирает global setup (`vitest.global-setup.ts`, `npm ci` из registry, если нет `node_modules`).
- `packages/codda/cli/dev-server.test.ts` — настоящий dev-сервер Vite отдаёт `course.json` временного Course, ошибки Course — ответ 500.
- `packages/codda/cli/boundary.test.ts` — граница ADR-0006: ни один импорт исходников пакета `codda` (включая `?raw` и `?url` Vite) не ведёт за пределы пакета, кроме `node_modules`. Обычные импорты ловит ещё и `rootDir` в tsconfig пакета.
- `e2e/` — Playwright против Course Build из `/codda/` и dev-сервера (`npm run test:e2e`). Тесты открывают страницу относительно `baseURL` (`page.goto("./")`), а не `"/"`. `golden-path.e2e.ts` проходит Lesson `use-state`. `course.e2e.ts` — загрузка `course.json` (ожидание, 404, обрыв сети), `#/<id>`, неизвестный id и Solution каждого Lesson → PASS. `dev.e2e.ts` — smoke-тест `npm run dev`. `sandbox-isolation.e2e.ts` подсовывает через редактор враждебный код студента: чтение parent/cookies/storage, поддельные сообщения, `fetch` в Internet. Фикстура `e2e/offline.ts` обрывает любой запрос не на localhost, печатает список всех запросов страницы и валит тест, если был хоть один внешний.

С MVP ошибки и граничные случаи тестируются в том же тикете, что и happy path (раздел «Тесты» в [CLAUDE.md](CLAUDE.md)). Сквозной сценарий пилота — `e2e/pilot.e2e.ts`: 5 Lesson React Hooks подряд по сборке `codda build`, offline.

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

Как устроен Lesson и что писать в его файлах — [README пакета `codda`](packages/codda/README.md#файлы-курса).

## Жёсткие ограничения

- **Никакой внешней сети в runtime:** ни CDN, ни npmjs.org, ни CodeSandbox. Всё, включая `esbuild.wasm`, отдаётся с нашего origin ([ADR-0002](docs/adr/0002-fully-internal-infrastructure.md)).
- **Код студента — только в `<iframe sandbox="allow-scripts">` без `allow-same-origin`.** Общение с parent — только через `postMessage` с проверкой формы ([ADR-0003](docs/adr/0003-sandbox-iframe-without-same-origin.md)).
- **Скоуп стадии зафиксирован в спеке.** Отложенное — в «MVP, часть 2» [roadmap.md](docs/roadmap.md).

## Известные ограничения на текущем этапе

- **Только Chrome.** Timeout (5 с) работает, только пока Sandbox живёт в отдельном процессе от страницы. Chrome так делает по умолчанию, а Safari нет: бесконечный цикл в коде студента вешает вкладку. Playwright-овский `chrome-headless-shell` тоже держит Sandbox в одном процессе со страницей, поэтому тесты запускаются в полном Chromium (`channel: "chromium"` в `packages/codda/vite.config.ts`).
- **Ложный timeout.** Первый Run после Sandbox с бесконечным циклом иногда не стартует и через 5 с кончается ложным timeout, следующие Run работают. В CI тесты идут с повторами. Запись — в «Отложенные проблемы» [журнала прогона](.scratch/mvp-autorun/README.md#отложенные-проблемы).
- Строка runtime-ошибки и проваленного теста в файле студента не показывается: source maps — в «MVP, часть 2».
- Артефакты — development-сборка пакетов (`process.env.NODE_ENV = "development"`): `act` React в production-сборке не работает.
- Sandbox не закрыт от сети: `fetch` из кода студента уходит наружу (с `Origin: null`, ответ отрезает CORS). В e2e такие запросы блокирует сам тест. CSP и отдельный origin для Sandbox входят в security baseline, а он отложен в «MVP, часть 2» до первых внешних пользователей. Подробности — в [тикете 04 PoC](.scratch/golden-path-poc/issues/04-offline-isolation-e2e.md).
- Код студента может прислать поддельный отчёт со своим `runId`. Результат в браузере — подсказка студенту, а не оценка ([ADR-0004](docs/adr/0004-browser-only-grading-first.md)).

## Если что-то не работает

- **`npm test` ругается, что не найден браузер** — выполните `npx playwright install chromium`.
- **Тест с бесконечным циклом висит дольше 20 с, а Vitest не может его прервать** — тесты запущены в `chrome-headless-shell`, где Sandbox делит процесс со страницей. Проверьте `launchOptions.channel` в `packages/codda/vite.config.ts`.
- **Vitest пишет «Vite unexpectedly reloaded a test»** или тест падает на первом прогоне после установки новой зависимости — добавьте её в `optimizeDeps.include` в `packages/codda/vite.config.ts`.
- **Run ничего не показывает** — откройте DevTools: ошибки esbuild-wasm видны в консоли Worker, ошибки кода студента — в консоли iframe.

## Документация

- [CONTEXT.md](CONTEXT.md) — глоссарий: Lesson, Run, Sandbox, Test Report, Dependency Artifact…
- [docs/adr/](docs/adr/) — архитектурные решения
- [packages/codda/README.md](packages/codda/README.md) — для Author: как сделать Course и Lesson
- [docs/roadmap.md](docs/roadmap.md) — дорожная карта, «Определение MVP» и «MVP, часть 2»
- [docs/poc-report.md](docs/poc-report.md) — итоги PoC: ответы на пять вопросов, замеры, риски, решение GO
- [docs/ai-workflow.md](docs/ai-workflow.md) — процесс разработки с AI: скиллы, тикеты, роли человека и агента
- [docs/HOW-TO-PROCEED.md](docs/HOW-TO-PROCEED.md) — порядок шагов: PoC → MVP → пилот
- [.scratch/mvp-autorun/](.scratch/mvp-autorun/README.md) — спеки, тикеты и журнал MVP
- [.scratch/golden-path-poc/](.scratch/golden-path-poc/) — спека и тикеты PoC
