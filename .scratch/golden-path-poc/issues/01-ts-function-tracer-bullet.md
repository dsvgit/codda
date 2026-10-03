# 01: Tracer bullet — TS-функция от редактора до Test Report

**What to build:** Step 0 из спеки. Страница с Instructions, CodeMirror со Starter `export function add(a: number, b: number) { return a - b; }` и кнопкой **Run tests**. Run отправляет `source` + захардкоженные Lesson Tests в Web Worker, esbuild-wasm компилирует их в один бандл, бандл исполняется в свежем Sandbox (`sandbox="allow-scripts"`, без `allow-same-origin`), минимальный Test Harness выполняет тесты и присылает Test Report через `postMessage`, UI показывает каждый тест и «N / M passed». Исправил `-` на `+` → Run → 2/2 passed.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Проект Vite + React + TS запускается одной командой (`npm run dev`)
- [ ] `esbuild.wasm` отдаётся локально (`wasmURL` указывает на наш origin), никаких CDN
- [ ] Модуль Runner с интерфейсом `run({ source, tests }) → Promise<TestReport>` (форма TestReport — из спеки)
- [ ] Sandbox пересоздаётся на каждый Run; parent проверяет `event.source`, `type` и `runId`
- [ ] Test Harness: `test`, `expect().toBe/toEqual`, async-тесты; провал теста не останавливает остальные
- [ ] UI: список тестов ✓/✗ с текстом ошибки и итог «N / M passed»
- [ ] Браузерный тест на шве Runner: правильное решение → все pass; неправильное → fail с expected/actual
