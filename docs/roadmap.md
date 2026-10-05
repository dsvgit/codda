# Roadmap

Оценки — для одного опытного разработчика, который принимает архитектурные решения и ревьюит код, с Claude Code. AI сокращает boilerplate и локальную отладку, но **не** сокращает пропорционально security, browser compatibility и инфраструктуру.

| Стадия | Срок | Результат |
|---|---|---|
| **Phase 0 — Golden Path PoC** ✅ | 2–3 дня | Один файл, один Lesson, Run → PASS/FAIL без Internet. **GO** (2026-10-03), см. [poc-report.md](poc-report.md). |
| **Phase 1 — Фундамент** ✅ | 1–2 нед. | Надёжный Runtime, Lesson Manifest, прототип зависимостей, Author CLI. Multi-file — в «MVP, часть 2» |
| **Phase 2 — Инструменты** ✅ | 1–2 нед. | TypeScript tooling (diagnostics, autocomplete), dependency pipeline в CI, редактор. Hover и auto-import — в «MVP, часть 2» |
| **Phase 3 — Готовность к людям** — частично | 1–2 нед. | Persistence и Course UX ✅. Браузеры — только Chrome. Security и производительность (R1) — в «MVP, часть 2» |
| **= MVP** — собран, пилот после merge | **4–6 нед. после PoC** | См. «Определение MVP». Собран 2026-10-05 (ветка `mvp-autorun`), сверка — `## Итог` в `.scratch/mvp-autorun/07-pilot-course/spec.md`: 20 пунктов сделано, 5 частично, 1 нет (пилот на людях) |
| **Production-ready v1** | 6–8 нед. | + production hardening, деплой, наблюдаемость |
| **Phase 4 — Дальше** | — | Server Grader, Hidden Tests, analytics, authoring UI, другие framework'и |

## Определение MVP

Внутренний пользователь проходит **небольшой реальный Course** (один Module; пилотный Course — 5 Lesson React Hooks, решение `.scratch/mvp-autorun/questions/00-mvp-autorun.md`, Q3) по React + TypeScript:

- Lesson — обычные файлы в Git (Instructions в Markdown, Lesson Manifest, Starter, Lesson Tests, Solution); Author проверяет их одной командой CLI `codda`. Инструмент отделён от контента: курс передаётся путём ([ADR-0006](adr/0006-tool-separate-from-content.md)).
- Workspace из одного файла TS/TSX (несколько файлов — в «MVP, часть 2»).
- npm-зависимости, объявленные в `package.json` Course, приходят как Dependency Artifact Course, собранный `codda build` из внутреннего registry (ADR-0007).
- Run → Test Report; ошибки компиляции (со строкой в Workspace), runtime, timeout; console; отмена Run; восстановление после падения. Source maps — в «MVP, часть 2».
- Базовые подсказки TypeScript (diagnostics, autocomplete для React).
- Навигация по Lesson, Reset, показ Solution, прогресс и Workspace сохраняются (минимум — локально).
- UI на русском.
- Пилот — внутренние пользователи, только Chrome. Security baseline перенесён в «MVP, часть 2», но обязателен до серверного хранения и до любых внешних пользователей.
- Всё работает в полностью закрытом контуре (ADR-0002).

Статус каждого пункта, доказательства (тест, коммит, ручная проверка) и примечания — `## Итог` в `.scratch/mvp-autorun/07-pilot-course/spec.md` (2026-10-05). Не сделанное полностью — в списке «До пилота» и в «MVP, часть 2» ниже.

**Не входит в MVP:** Vim, несколько framework'ов, `npm install` студентом, Node в браузере, Linux sandbox, Server Grader / Hidden Tests (ADR-0004), сложная авторизация, интеграция с LMS, authoring UI.

## До пилота

Кандидаты, без которых пилот может не получиться; доделать или идти с ними — решает человек (тикет `.scratch/mvp-autorun/07-pilot-course/issues/03-pilot-on-people.md`):

- Ложный timeout: первый Run после Sandbox с бесконечным циклом иногда не стартует и через 5 с кончается «Тесты не завершились за 5 с» («Отложенные проблемы» `.scratch/mvp-autorun/README.md`, runtime-hardening/02; пункт «восстановление после падения» — частично). В CI тесты идут с повторами, один тест `App.test.tsx` — `test.skip`. Возможный обход — пересоздать iframe, если нет `codda:port` за ~1 с.

## MVP, часть 2

Отложено при составлении Плана решений MVP (`.scratch/mvp/questions/00-map-round-2-scope.md`, отметки «после»):

- Multi-file Workspace: virtual FS, импорты между файлами, табы, дерево, создание/удаление файлов студентом (блок A).
- Прогрев Worker, холодный старт вне deadline Run (R1); защита от бесконечных циклов в Safari/Firefox (R3); preview/HMR (блок A).
- Source maps: строка runtime-ошибки и проваленного теста в файле Workspace вместо stack бандла (снято из MVP, `.scratch/mvp-autorun/questions/00-mvp-autorun.md`, Q11 и Q13). Риски, найденные при спеке: формат кадров `about:srcdoc`, смещение бандла в `srcdoc`, ленивый разбор mappings React; декодер — `@jridgewell/trace-mapping` (блок A).
- Timeout отдельного теста (зависший промис съедает весь Run); обнаружение падения процесса Sandbox (OOM) иначе, чем timeout; переход к строке по клику на `Строка N:M`; инспектор объектов и `console.table/group` в Console (блок A, фича `runtime-hardening`).
- Подсветка кода в блоках Instructions (блок C).
- Выкладка нескольких курсов на один сайт пилота; сейчас на Pages идёт один пилотный курс (фича `author-cli`, Q3).
- CSS из npm-пакетов (блок B).
- Быстрый Run с зависимостями (R4): эксперимент `.scratch/mvp/issues/07-artifact-transport-experiment.md`, затем import map в Sandbox вместо вшивания в бандл; статический лексер для CJS-экспортов; зависимости на уровне Lesson, если понадобятся (блок B, ADR-0007).
- Hover, go to definition, форматирование (блок E); auto-import и signature help в autocomplete, JSDoc в подсказках; строка «Есть ошибки типов: N» в Test Report и баннере PASS, если в пилоте студенты игнорируют подчёркивания (тикет 09, ADR-0009).
- Прогресс и Workspace на сервере, вход пользователя; подсказки и счётчик попыток (блок H).
- Security baseline целиком (блок F) — обязателен до серверного хранения и до внешних пользователей.
- Закрытый контур для сборки курса: прогнать `codda init --ci gitlab` в контуре компании — внутренний образ `$CODDA_IMAGE`, внутренний npm registry из `.npmrc`, Chromium из зеркала (`PLAYWRIGHT_DOWNLOAD_HOST`), выкладка в S3. В MVP проверены только браузер студента offline и разбор YAML шаблона (сверка MVP, пункты 7 и 26 — частично).
- Остатки английского в UI: заголовок «Instructions» и текст `expected …, got …` Test Harness (сверка MVP, пункт 22 — частично); `PASS`/`FAIL`, «Console» и сообщения esbuild/TS английские по решению спек — пересмотреть по фидбеку пилота.

## Эволюция после PoC (версии)

- **v0.1** — 1 файл, 1 Lesson, захардкоженные тесты и зависимости (= PoC)
- **v0.2** — несколько Lesson, Lesson Manifest, Solution, Reset
- **v0.3** — multi-file Workspace (virtual FS)
- **v0.4** — dependency pipeline: внутренний registry → CI → артефакты
- **v0.5** — TypeScript language service
- **v1** — Course, авторинг, прогресс, security hardening (→ MVP)

## Блоки работ

Каждый блок — кандидат в отдельную фичу `.scratch/<feature>/` со своей спекой и тикетами.

### A. Надёжный Runtime — Phase 1
Жизненный цикл Worker, отмена Run, timeout, лимиты памяти где возможно, source maps, console, preview/HMR, восстановление после падения, несколько entry points, virtual FS для multi-file.

**Timeout вне Chrome.** В PoC timeout живёт в parent и срабатывает, только если Sandbox исполняется в отдельном процессе. Chrome 153+ выносит sandboxed iframe в свой процесс по умолчанию. Playwright-овский `chrome-headless-shell` этого не делает (найдено в тикете 02 PoC). Safari/WebKit без Site Isolation держит все фреймы страницы в одном процессе: `while(true){}` в коде студента замораживает страницу вместе с таймером, и отдельный origin для Sandbox (блок F) здесь не помогает. Нужна защита, не зависящая от процессной модели браузера:
- **Защита циклов при компиляции (основной вариант):** в каждый `while`/`for`/`do` вставляется проверка «прошло больше N мс → throw», как в CodePen/JSBin. Даёт понятную ошибку со строкой. Не ловит долгие синхронные вызовы встроенных функций. Timeout в parent остаётся страховкой.
- **Тесты в Web Worker + DOM-эмуляция (happy-dom/linkedom):** `terminate()` срабатывает гарантированно, но это меняет архитектуру из ADR-0003 и ставит под вопрос DOM-тесты React.

Сначала проверить, как ведут себя Playwright WebKit и настоящий Safari, а также Firefox (Fission). Решение оформить ADR.

Из [PoC Report](poc-report.md): R3 — этот пункт; полный Chrome изоляцию тоже не гарантирует (память, Android). R1 — холодный старт вынести из deadline Run, прогревать Worker, отдавать `.wasm` сжатым и с кэшем по hash: сейчас на медленной сети первый Run кончается ложным «Timed out». R8 — асинхронные ошибки во время тестов.

### B. Dependency pipeline — Phase 1 (эксперимент) → Phase 2
`internal npm registry → CI install → browser compatibility check → ESM artifacts → immutable storage (по hash)`. Решить: CommonJS, ESM, package `exports`, subpath imports, CSS, JSON, `.d.ts`, peer/shared deps, конфликты версий, кэширование, import maps vs вшивание в бандл. **Начать с research и эксперимента.**

Из [PoC Report](poc-report.md): R4 — вшивание артефактов в бандл против загрузки в Sandbox отдельно. R5 — `act` требует development-сборку React. R9 — default-импорт CJS-пакетов и проверка целостности по hash.

Решение для MVP — ADR-0007: один Dependency Artifact на Course из `package.json` + `package-lock.json`, вшивается в бандл как в PoC (R4 принят). Import map в Sandbox, эксперимент 07 и CSS из пакетов — «MVP, часть 2».

### C. Модель Lesson — Phase 1
```
Course (course.yaml: id, title, modules → lessons; package.json + package-lock.json: dependencies)
 └ Lesson <id>/
    ├ lesson.md        frontmatter (title) + Instructions
    ├ main.tsx         Starter
    ├ solution.tsx
    └ lesson.test.tsx
```
Lesson Manifest — контракт между авторингом, CI, Runtime и (будущим) Server Grader. Схема и правила — `## Answer` тикета `.scratch/mvp/issues/03-lesson-manifest-schema.md`. Пять Lesson React Hooks из `courses/react-hooks/` переводятся на этот формат, старый формат удаляется.

Кандидат, если всплывёт в пилоте: плашка «Starter обновлён — Reset, чтобы взять новый» на сохранённом Workspace, если Author поменял Starter. Для неё рядом с Workspace нужно хранить hash Starter. Нетронутый Workspace (равный Starter) не хранится, поэтому новый Starter такие студенты получают без плашки; плашка нужна только для изменённого Workspace (фича `course-ux`).

### D. Авторский workflow — Phase 1
`course create react/use-state` → скелет Lesson. `course test react/use-state` → ✓ starter собирается, ✓ solution собирается, ✓ solution проходит все тесты, ✓ starter их не проходит, ✓ manifest валиден, ✓ зависимости доступны. Тот же чек — в CI на каждый PR.

### E. TypeScript IDE — Phase 2
Diagnostics, autocomplete, hover, go to definition, `.d.ts` зависимостей, форматирование. Только после стабилизации execution pipeline.

### F. Security — Phase 3
Sandbox на отдельном origin, sandbox-атрибуты, CSP (`connect-src 'none'` для Sandbox), валидация postMessage, доступ к parent/cookies/storage, бесконечные циклы (отдельный origin их не решает в Safari — см. «Timeout вне Chrome» в блоке A), исчерпание памяти/Worker, iframe escape, prototype pollution, supply chain зависимостей. **Security review до того, как пускать произвольные задания.**

Из [PoC Report](poc-report.md): R2 — Sandbox ходит в сеть, CSP `connect-src 'none'` нужен до первых внешних пользователей, а не в финальном hardening.

### G. Server Grader — Phase 4, только по необходимости
Run (браузер, обратная связь) vs Submit (сервер, изолированная VM, Hidden Tests). Триггеры: защита от списывания, Node/FS/DB/сеть, серверные фреймворки.

### H. Продуктовые фичи — Phase 3+
Прогресс, save/restore, Reset, показ Solution, подсказки, попытки, навигация, аутентификация, аналитика, дашборд автора, права.

## Целевая архитектура

```
                    INTERNAL INFRASTRUCTURE — NO INTERNET
 Internal Git ──┐                    ┌── Internal npm registry
                └──────► Course CI ◄─┘
                     ┌───────┴────────┐
          Dependency Artifacts     Lesson artifacts
                     └───────┬────────┘
                          Web App
                 CodeMirror 6 · Virtual FS
                             │
                Web Worker (esbuild-wasm) = Compiler
                             │
                 Sandbox iframe + Test Harness
                             │
                       Test Report (PASS/FAIL)
```

Абстракция для будущих framework'ов: `Lesson → Runtime → Framework adapter`.
