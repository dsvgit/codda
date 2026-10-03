# 03: React Counter на Dependency Artifact

**What to build:** Steps 1–2 из спеки. Lesson меняется на «React: Counter»: Starter — заготовка `Counter` в TSX, Lesson Tests рендерят компонент в DOM Sandbox через `react-dom/client`, кликают `+`/`−` (через `act`) и проверяют текст. `import { useState } from "react"` резолвится в локально собранный Dependency Artifact, а не в npm/CDN. Неверный Starter → 3 FAIL, правильный Solution → 3/3 passed.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Node-скрипт (esbuild native) собирает `react` и `react-dom/client` в ESM-артефакты в `public/deps/` с версией в имени; артефакты закоммичены
- [ ] Compiler резолвит `react`, `react/jsx-runtime`, `react-dom/client` в эти артефакты (вшивает их в бандл — обход CORS для opaque origin, ADR-0003)
- [ ] JSX/TSX компилируется (automatic runtime)
- [ ] Три теста: renders initial value, increments, decrements
- [ ] Solution хранится рядом со Starter как константа и проходит 3/3 в браузерном тесте Runner
- [ ] Замерено и записано в Comments: время cold Run и warm Run, размер артефактов
