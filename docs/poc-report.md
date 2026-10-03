# PoC Report: Golden Path

**Дата:** 2026-10-03 · **Спека:** [.scratch/golden-path-poc/spec.md](../.scratch/golden-path-poc/spec.md) · **Тикеты:** [01–05](../.scratch/golden-path-poc/issues/)

**Решение: GO.** На все пять вопросов спеки ответ «да». Стек CodeMirror 6 + esbuild-wasm в Worker + sandboxed iframe + свой Test Harness проходит Golden Path без Internet. Архитектуру до MVP не пересматриваем. Найденные риски не блокируют MVP, но три из них (R1–R3) надо решить до первых внешних пользователей (см. «Что обязательно решить в MVP»).

## Пять вопросов

| # | Вопрос | Ответ | Доказательство |
|---|---|---|---|
| 1 | Можно ли надёжно компилировать TS/TSX в браузере? | **Да** (транспиляция, без проверки типов) | `src/runtime/runner.test.ts`: «correct solution passes every test» (TS), «React Counter solution passes every lesson test» (TSX, automatic JSX), «syntax error is reported as a compile error with line and column» |
| 2 | Можно ли исполнять React-приложение в изолированном iframe? | **Да** | «React Counter solution passes every lesson test»: `react-dom/client` рендерит в DOM Sandbox, клики через `act`. Изоляция: `e2e/sandbox-isolation.e2e.ts` — «student code cannot read the app's document, cookies or storage» (все три чтения дают `SecurityError`) |
| 3 | Можно ли запускать автоматические тесты и получать структурированный Test Report? | **Да** | `runner.test.ts`: «starter fails each test with expected and actual values», «harness awaits async tests, compares deeply and keeps going after a failure», «exception at the top level … is a runtime error», «infinite loop times out after 5 s and the next Run works», «compilation that outlives the deadline times out …». UI: `src/App.test.tsx` |
| 4 | Можно ли подключить npm-зависимость как внутренний Dependency Artifact? | **Да**, вручную | `scripts/build-deps.mjs` → `public/deps/*@19.3.0.js` + `manifest.json`. `import { useState } from "react"` резолвится в артефакт: «React Counter solution passes every lesson test» и e2e Golden Path |
| 5 | Работает ли всё без внешних сервисов и без Internet? | **Да** | `e2e/golden-path.e2e.ts` в фикстуре `e2e/offline.ts`: любой запрос не на localhost обрывается и валит тест. Страница делает 30 запросов, все на localhost, внешних 0. Замеры production-сборки ниже — тоже 0 внешних запросов |

Оговорки к ответам:

- **К 1.** esbuild только удаляет типы. `const n: number = "a"` компилируется и исполняется. Ошибки типов студент увидит только после TypeScript language service (roadmap, блок E). «Надёжно» здесь значит: 12 / 12 тестов Runner и UI, e2e 20 / 20 при `--repeat-each 5`. Но только с `workers: 2`: при 6 параллельных браузерах часть холодных Run уходит в timeout (R1).
- **К 2.** Изоляция от parent доказана. Изоляции от сети нет: см. риск R2.
- **К 4.** Это один пакет и ручной скрипт. CJS → ESM сделан явным списком именованных экспортов, взятым из `require()` в node. Произвольные npm-пакеты так не масштабируются, это работа CI-пайплайна (ADR-0005, блок B).
- **К 5.** Offline доказан блокировкой в Playwright, а не выключенной сетью. Прогон с выключенным Wi-Fi — часть демо.

## Замеры

Машина: локальный Mac (darwin), Chromium из Playwright 1.63, headless. Время Run измерено внутри страницы: от `click` до разблокировки кнопки, то есть включая рендер Test Report. Lesson «React: Counter».

**Время Run**

| | production (`vite preview`) | dev (`vite`) |
|---|---|---|
| cold Run: Worker + загрузка и init `esbuild.wasm` + загрузка артефактов + Run | 1.07–1.15 с | 1.09–1.13 с |
| warm Run | 0.43–0.53 с | 0.45–0.56 с |
| warm Run, TS-задание `add` (тикеты 01 и 03, dev) | — | 0.10–0.15 с |

Разбивка warm Run (тикет 03): компиляция ≈ 0.33–0.36 с, исполнение бандла в Sandbox ≈ 0.13 с.

**esbuild-wasm в изоляции** (3 прогона, localhost, без кэша): загрузка 93–102 мс, `WebAssembly.compile` 27–38 мс, `esbuild.initialize` 24–74 мс. Итого ≈ 0.15–0.2 с. Холодный старт на localhost стоит не столько esbuild, сколько первая компиляция с 1.1 МБ `react-dom`.

**Холодный Run в сети с ограниченной полосой** (CDP-эмуляция, production; время снаружи страницы, с накладными Playwright ≈ 0.3 с):

| Сеть | Загрузка страницы | cold Run | Результат |
|---|---|---|---|
| localhost | 0.12–0.15 с | ≈ 1.5 с | `0 / 3 passed` |
| 100 Мбит/с, 20 мс | 0.16 с | 2.4 с | `0 / 3 passed` |
| 20 Мбит/с, 40 мс | 0.26 с | > 5 с | **«Timed out … Look for an infinite loop»** |

**Размеры** (production-сборка, `npm run build`)

| Файл | Размер | gzip |
|---|---|---|
| `esbuild.wasm` | 13.98 МБ | 3.73 МБ |
| `index-*.js` (приложение: React, CodeMirror, Runner) | 725 КБ | 234 КБ |
| `compiler.worker-*.js` | 74 КБ | 21 КБ |
| `deps/react@19.3.0.js` | 53 КБ | |
| `deps/react-jsx-runtime@19.3.0.js` | 16 КБ | |
| `deps/react-dom-client@19.3.0.js` (development-сборка) | 1.13 МБ | 195 КБ |
| бандл одного Run (Counter) | 1.25 МБ | |

`vite preview` отдаёт `esbuild.wasm` **без сжатия** (`content-encoding` нет), а артефакты — с gzip.

## Риски и неожиданности

### Что обязательно решить в MVP

- **R1. Холодный Run не укладывается в 5 с на медленной сети и выдаёт неверный диагноз.** Deadline Run включает загрузку 14 МБ `esbuild.wasm` и init. На 20 Мбит/с первый Run студента заканчивается сообщением «Look for an infinite loop», хотя бесконечного цикла нет. То же под нагрузкой: при 6 параллельных браузерах в e2e (тикет 04), поэтому `workers: 2`. Решение: не включать загрузку и init Compiler'а в deadline Run, прогревать Worker при открытии страницы, отдавать `.wasm` сжатым (brotli/gzip, ≈ 3.7 МБ) с долгим кэшем по hash. Блок A.
- **R2. Sandbox не закрыт от сети.** `fetch` из `sandbox="allow-scripts"` уходит наружу с `Origin: null`. Ответ отрезает CORS, но `mode: "no-cors"` проходит: утечка через URL и тело запроса возможна (тикет 04). В e2e такие запросы блокирует сам тест. Решение: CSP `connect-src 'none'` для Sandbox и/или отдельный origin. Блок F, но до первых внешних пользователей, а не в финальном hardening.
- **R3. Timeout зависит от процессной модели браузера.** Работает, только когда Sandbox в отдельном процессе: так делают полный Chrome и Chromium. В `chrome-headless-shell` и, по устройству, в Safari `while(true){}` замораживает страницу вместе с таймером (тикет 02). Полный Chrome изоляцию тоже не гарантирует: при нехватке памяти и на Android он может держать фреймы в одном процессе. Тесты поэтому идут на `channel: "chromium"`. Решение: loop-guard при компиляции, timeout в parent как страховка. Блок A, «Timeout вне Chrome», с ADR.

### Учесть при планировании

- **R4. Warm Run растёт с каждой зависимостью.** React-задание в 3–4 раза медленнее TS-задания: esbuild-wasm на каждом Run заново парсит 1.1 МБ `react-dom`, а Sandbox заново его исполняет. 0.5 с укладывается в цель «1–2 с», но 3–4 пакета её съедят. Варианты: грузить артефакты в Sandbox отдельно (import map / inline-модули) и компилировать только код студента и тесты; кэш в esbuild `context`. Решать вместе с блоком B.
- **R5. `act` требует development-сборку React.** В production-сборке React 19 `act` не работает, поэтому артефакт `react-dom` — development-сборка на 1.13 МБ. Размер production-сборки в PoC не замеряли. Риск спеки «`act` вне jsdom» снят: в настоящем DOM Sandbox с `IS_REACT_ACT_ENVIRONMENT = true` тесты проходят. Act-предупреждения в консоли iframe не проверялись. Пайплайну артефактов нужны две сборки, или development для Run.
- **R6. Нет проверки типов** (см. оговорку к вопросу 1). Студент может получить PASS на коде с ошибками типов. Блок E.
- **R7. Test Report можно подделать.** Код студента знает `__coddaRunId` и может прислать «3 / 3 passed» правильной формы. По ADR-0004 это допустимо: Run — обратная связь, не оценка. Засчитывать прохождение по нему нельзя.
- **R8. Асинхронная ошибка во время тестов превращает весь Run в `runtime-error`**, и результаты тестов теряются. Незахваченный reject вообще не виден (тикет 02). Блок A.
- **R9. Dependency Artifact — ручная работа.** Только именованные экспорты: `import React from "react"` даёт compile-error. Целостность по hash не проверяется. Несуществующий пакет или 404 артефакта дают compile-error, тестами это не покрыто (тикет 03). Блок B.
- **R10. Размер приложения.** Основной бандл 725 КБ (234 КБ gzip): React и CodeMirror. Для PoC это неважно. На MVP — code-splitting вместе с TS language service.

### Неожиданности

- `chrome-headless-shell`, дефолт Playwright для headless, держит opaque-origin iframe в процессе страницы. Флаг `IsolateSandboxedIframes` не помогает. На эту находку ушла бо́льшая часть отладки в тикете 02.
- Worker сам скачивает артефакты со своего origin, а не получает их от приложения, как написано в спеке. Ограничения ADR-0002/0003 те же, зато 1.2 МБ не гоняются через `postMessage` на каждый Run.
- «Ошибка импорта» оказалась compile-error, а не runtime-error: при бандлинге все импорты статические.

### Не проверено в PoC

- Браузеры, кроме Chromium (Firefox, Safari): R3 там ожидаемо проявится.
- e2e на production-сборке: e2e идут на dev-сервере. Замеры выше сняты и на production, Golden Path там проходит.
- Физически выключенная сеть: будет в демо.
- Перекрывающиеся Run: timeout одного Run убивает общий Worker, и компиляция другого Run тоже получит `timeout`. В UI не воспроизводится: кнопка на время Run заблокирована (тикет 02).
- Исключение в обработчике клика внутри `act`: fail теста или `runtime-error`, неизвестно (тикет 03).
- `top.location`, окна и `alert` из Sandbox: sandbox-атрибуты их запрещают, но тестами это не закреплено. Проверка `event.source` против сообщений от других окон тоже не покрыта: все поддельные сообщения в e2e шлёт сам Sandbox (тикет 04).

## Что меняется

- **ADR:** новых нет. В [ADR-0003](adr/0003-sandbox-iframe-without-same-origin.md) добавлено следствие: opaque origin не закрывает Sandbox от сети (R2).
- **[docs/roadmap.md](roadmap.md):** Phase 0 закрыта с решением GO. Находки разнесены по блокам со ссылками на этот отчёт: A — R1, R3, R8; B — R4, R5, R9; F — R2.

## Демо

Сценарий для коллеги:

1. `npm run build && npm run preview`, открыть страницу, **выключить Wi-Fi**.
2. Run tests → `0 / 3 passed`, у каждого теста expected/actual.
3. Сломать синтаксис → «Compile error» со строкой и колонкой. Добавить `while(true){}` → через 5 с «Timed out», страница живая. Следующий Run работает.
4. Дописать `Counter` (`useState`, `onClick`) → Run → `3 / 3 passed`.
5. DevTools → Network: все запросы на localhost.
6. `npm run test:e2e` — то же самое одной командой, с блокировкой внешней сети.
