# 03: React Counter на Dependency Artifact

**What to build:** Steps 1–2 из спеки. Lesson меняется на «React: Counter»: Starter — заготовка `Counter` в TSX, Lesson Tests рендерят компонент в DOM Sandbox через `react-dom/client`, кликают `+`/`−` (через `act`) и проверяют текст. `import { useState } from "react"` резолвится в локально собранный Dependency Artifact, а не в npm/CDN. Неверный Starter → 3 FAIL, правильный Solution → 3/3 passed.

**Blocked by:** 01

**Status:** done

- [x] Node-скрипт (esbuild native) собирает `react` и `react-dom/client` в ESM-артефакты в `public/deps/` с версией в имени; артефакты закоммичены
- [x] Compiler резолвит `react`, `react/jsx-runtime`, `react-dom/client` в эти артефакты (вшивает их в бандл — обход CORS для opaque origin, ADR-0003)
- [x] JSX/TSX компилируется (automatic runtime)
- [x] Три теста: renders initial value, increments, decrements
- [x] Solution хранится рядом со Starter как константа и проходит 3/3 в браузерном тесте Runner
- [x] Замерено и записано в Comments: время cold Run и warm Run, размер артефактов

## Comments

**2026-10-03 — реализация (агент).** `npm run build:deps` (`scripts/build-deps.mjs`, native esbuild 0.28.2 = версия esbuild-wasm) собирает React 19.3.0 в `public/deps/{react,react-jsx-runtime,react-dom-client}@19.3.0.js` + `manifest.json` «specifier → файл». Compiler (Worker) при первом импорте зависимости скачивает manifest и артефакты со своего origin, держит их в памяти Worker'а и вшивает в IIFE-бандл; JSX — `jsx: "automatic"`. Неверный Starter → 0 / 3, Solution → 3 / 3 (шов Runner + UI-тест).

- **Как сделан CJS → ESM.** React публикуется в CommonJS. Для каждого артефакта генерируется ESM-entry с явным `export { useState, act, … } from "react"` (имена берутся из `require()` в node). Внутри `react-dom` и `jsx-runtime` вызов `require("react")` перенаправлен на шим `export * from "react"` с external `react` — в бандле Run он резолвится в тот же артефакт `react`, поэтому экземпляр React один. Это ручная версия того, что должен делать CI-пайплайн ADR-0005.
- **Отличие от спеки:** спека говорит «приложение загружает артефакт и отдаёт Compiler'у»; здесь Worker сам делает `fetch` со своего (того же) origin. Ограничения ADR-0002/0003 те же, но parent не гоняет 1.2 МБ через `postMessage` на каждый Run, а артефакты живут в тёплом Worker'е.
- **Development-сборка React:** `act` в production-сборке React 19 не поддерживается. `act` из `react` вне jsdom (в настоящем DOM Sandbox) с `IS_REACT_ACT_ENVIRONMENT = true` работает: тесты проходят. Риск из спеки снят частично — консоль iframe на act-предупреждения не проверялась.

**Замеры** (headless Chromium через Vitest browser mode, dev-сервер Vite, локальная машина (darwin); по 3 прогона):

| | Время |
|---|---|
| cold Run (Worker + init `esbuild.wasm` + загрузка артефактов + Run) | ≈ 1.1 с |
| warm Run | ≈ 0.45–0.51 с (TS-задание из 01 — 0.10–0.15 с) |
| — из них компиляция (warm) | ≈ 0.33–0.36 с |
| — из них Sandbox: разбор и исполнение бандла | ≈ 0.13 с |

| Артефакт | Размер | gzip |
|---|---|---|
| `react@19.3.0.js` | 53 КБ | |
| `react-jsx-runtime@19.3.0.js` | 16 КБ | |
| `react-dom-client@19.3.0.js` | 1.13 МБ | 195 КБ |
| всего | 1.20 МБ | 208 КБ |
| бандл одного Run | 1.25 МБ | |

- **Риск для отчёта (05):** warm Run в 3–4 раза медленнее TS-задания, потому что esbuild-wasm заново парсит 1.1 МБ `react-dom` на каждый Run, а Sandbox заново исполняет его. Укладывается в цель «1–2 с», но растёт с каждой зависимостью. Варианты на MVP: не бандлить артефакты, а грузить их в Sandbox отдельными `<script>` (import map + `blob:`/inline) и компилировать только код студента и тесты; минифицированный/production-артефакт для не-тестовых Run; кэш разобранного артефакта в esbuild (`context`).

Не протестировано (на отдельный проход):
- Недоступный артефакт (404 / сеть) → сейчас `compile-error` с текстом ошибки fetch; неудачная загрузка не кэшируется и повторяется на следующем Run. Тестом не покрыто.
- `import React from "react"` (default-импорт) не поддерживается — в ESM-entry только именованные экспорты; будет `compile-error` «No matching export».
- Импорт неизвестного пакета (`lodash`) → `compile-error` «Cannot resolve». Тестом не покрыто.
- Исключение внутри обработчика клика при `act` — попадёт как fail теста или как runtime-error, поведение не проверялось.
- Артефакты не проверяются на целостность (hash) и не версионируются по content-hash, только по версии в имени — это работа CI-пайплайна ADR-0005.
