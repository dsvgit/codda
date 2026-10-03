# Roadmap

Оценки — для одного опытного разработчика, который принимает архитектурные решения и ревьюит код, с Claude Code. AI сокращает boilerplate и локальную отладку, но **не** сокращает пропорционально security, browser compatibility и инфраструктуру.

| Стадия | Срок | Результат |
|---|---|---|
| **Phase 0 — Golden Path PoC** | 2–3 дня | Один файл, один Lesson, Run → PASS/FAIL без Internet. Решение go/no-go. |
| **Phase 1 — Фундамент** | 1–2 нед. | Надёжный Runtime, Lesson Manifest, multi-file, прототип зависимостей, Author CLI |
| **Phase 2 — Инструменты** | 1–2 нед. | TypeScript tooling, настоящий dependency pipeline в CI, редактор |
| **Phase 3 — Готовность к людям** | 1–2 нед. | Security, браузеры, производительность, persistence, Course UX |
| **= MVP** | **4–6 нед. после PoC** | См. «Определение MVP» |
| **Production-ready v1** | 6–8 нед. | + production hardening, деплой, наблюдаемость |
| **Phase 4 — Дальше** | — | Server Grader, Hidden Tests, analytics, authoring UI, другие framework'и |

## Определение MVP

Внутренний пользователь проходит **небольшой реальный Course** (один Module, 5–10 Lesson) по React + TypeScript:

- Lesson — обычные файлы в Git (Instructions в MDX, Lesson Manifest, Starter, Lesson Tests, Solution); Author проверяет их одной командой CLI.
- Workspace из нескольких файлов, табы/дерево, TS/TSX.
- npm-зависимости, объявленные в Lesson Manifest, приходят как Dependency Artifacts из CI и внутреннего registry.
- Run → Test Report; ошибки компиляции, runtime, timeout; console.
- Базовые подсказки TypeScript (diagnostics, autocomplete для React).
- Навигация по Lesson, Reset, показ Solution, прогресс и Workspace сохраняются (минимум — локально).
- Security baseline пройден: Sandbox на отдельном origin, CSP, лимиты, review.
- Всё работает в полностью закрытом контуре (ADR-0002).

**Не входит в MVP:** Vim, несколько framework'ов, `npm install` студентом, Node в браузере, Linux sandbox, Server Grader / Hidden Tests (ADR-0004), сложная авторизация, интеграция с LMS, authoring UI.

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

### B. Dependency pipeline — Phase 1 (spike) → Phase 2
`internal npm registry → CI install → browser compatibility check → ESM artifacts → immutable storage (по hash)`. Решить: CommonJS, ESM, package `exports`, subpath imports, CSS, JSON, `.d.ts`, peer/shared deps, конфликты версий, кэширование, import maps vs вшивание в бандл. **Начать с research-спайка.**

### C. Модель Lesson — Phase 1
```
Course └ Module └ Lesson
                   ├ instructions.mdx
                   ├ manifest.yaml
                   ├ starter/  tests/  solution/
```
Lesson Manifest — контракт между авторингом, CI, Runtime и (будущим) Server Grader.

### D. Авторский workflow — Phase 1
`course create react/use-state` → скелет Lesson. `course test react/use-state` → ✓ starter собирается, ✓ solution собирается, ✓ solution проходит все тесты, ✓ starter их не проходит, ✓ manifest валиден, ✓ зависимости доступны. Тот же чек — в CI на каждый PR.

### E. TypeScript IDE — Phase 2
Diagnostics, autocomplete, hover, go to definition, `.d.ts` зависимостей, форматирование. Только после стабилизации execution pipeline.

### F. Security — Phase 3
Sandbox на отдельном origin, sandbox-атрибуты, CSP (`connect-src 'none'` для Sandbox), валидация postMessage, доступ к parent/cookies/storage, бесконечные циклы, исчерпание памяти/Worker, iframe escape, prototype pollution, supply chain зависимостей. **Security review до того, как пускать произвольные задания.**

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
