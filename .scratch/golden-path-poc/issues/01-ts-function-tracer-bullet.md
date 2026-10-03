# 01: Tracer bullet — TS-функция от редактора до Test Report

**What to build:** Step 0 из спеки. Страница с Instructions, CodeMirror со Starter `export function add(a: number, b: number) { return a - b; }` и кнопкой **Run tests**. Run отправляет `source` + захардкоженные Lesson Tests в Web Worker, esbuild-wasm компилирует их в один бандл, бандл исполняется в свежем Sandbox (`sandbox="allow-scripts"`, без `allow-same-origin`), минимальный Test Harness выполняет тесты и присылает Test Report через `postMessage`, UI показывает каждый тест и «N / M passed». Исправил `-` на `+` → Run → 2/2 passed.

**Blocked by:** None (can start immediately)

**Status:** in-progress

- [ ] Проект Vite + React + TS запускается одной командой (`npm run dev`)
- [ ] `esbuild.wasm` отдаётся локально (`wasmURL` указывает на наш origin), никаких CDN
- [ ] Модуль Runner с интерфейсом `run({ source, tests }) → Promise<TestReport>` (форма TestReport — из спеки)
- [ ] Sandbox пересоздаётся на каждый Run; parent проверяет `event.source`, `type` и `runId`
- [ ] Test Harness: `test`, `expect().toBe/toEqual`, async-тесты; провал теста не останавливает остальные
- [ ] UI: список тестов ✓/✗ с текстом ошибки и итог «N / M passed»
- [ ] Браузерный тест на шве Runner: правильное решение → все pass; неправильное → fail с expected/actual

## Comments

**2026-10-03 — реализация (агент).** Ручной прогон `npm run dev` в Chromium: Run → 0 / 2 (`expected 5, got -1`), правка `-` → `+` → 2 / 2 passed; внешних запросов — 0, iframe после Run не остаётся.

- Замеры (dev, M-серия Mac): cold Run ≈ 1.0 с (включая init esbuild-wasm), warm Run ≈ 120–130 мс. `esbuild.wasm` ≈ 14 МБ (3.8 МБ gzip), отдаётся с нашего origin через `esbuild-wasm/esbuild.wasm?url`.
- Тесты: Vitest browser mode (Playwright/Chromium), `npm test`, шов `run({ source, tests })`.
- Lesson Tests импортируют `test`/`expect` из виртуального модуля `@codda/test` (Test Harness, `src/runtime/harness.ts`, вшивается в бандл как `?raw`).
- Для 02: Run пока может висеть вечно — throw на верхнем уровне в Sandbox, `error` у Worker (не загрузился wasm), Sandbox, который не прислал отчёт. Маппинг ошибок esbuild → `compile-error` уже есть, но без UI и тестов; не-`tests` отчёты UI пока показывает сырым JSON. Parent сейчас принимает от Sandbox только отчёты `kind: "tests"` — `runtime-error` из Sandbox потребует расширить `isTestsReport` в `runner.ts`.
