# Как двигаться дальше: PoC → MVP

Процесс, роли, скиллы и соглашения — [ai-workflow.md](ai-workflow.md). Здесь — только порядок шагов.

## Часть 1. Golden Path PoC ✅

Сделано 2026-10-03: тикеты 01–05 в [.scratch/golden-path-poc/](../.scratch/golden-path-poc/), решение **GO** — [poc-report.md](poc-report.md). Отклонения от спеки — в разделе «Итог» [спеки](../.scratch/golden-path-poc/spec.md).

## Часть 2. От PoC к MVP (4–6 недель)

### Шаг 0. Хвост PoC

Курс React Hooks в `courses/` сделан вне тикетов. Решить при grilling блока C: стать ли ему первым настоящим Course на Lesson Manifest или удалиться.

### Шаг 1. План решений MVP (1 сессия) ✅

Сделано 2026-10-03: [.scratch/mvp/map.md](../.scratch/mvp/map.md), ветка `mvp`. Скоуп MVP уточнён — см. «MVP, часть 2» в [roadmap.md](roadmap.md).

MVP — многосессионная работа с неизвестными, поэтому сначала карта решений, потом спеки.

```
/wayfinder Довести codda от Golden Path PoC до MVP из docs/roadmap.md
```

Wayfinder создаст `.scratch/mvp/map.md` и тикеты-решения (`research` / `prototype` / `grilling` / `task`). Ожидаемые первые решения:

- **research:** CJS → ESM для произвольных npm-пакетов, import maps vs бандлинг, кэширование артефактов (блок B; риски R4, R5, R9) — фоновыми агентами через `/research`.
- **research:** loop-guard против timeout в parent; поведение Safari, WebKit, Firefox (блок A, риск R3) → ADR.
- **research:** TypeScript language service в Worker для CodeMirror (блок E).
- **grilling:** схема Lesson Manifest (блок C) и команды Author CLI (блок D).
- **prototype:** раскладка UI с несколькими файлами и навигацией по Lesson (`/prototype`).
- **grilling:** где хостится Sandbox origin и какие CSP (блок F; риск R2 — до первых внешних пользователей).

### Шаг 2. Пройти План решений (несколько сессий)

```
/clear
/wayfinder .scratch/mvp/map.md
```

Одна сессия — один тикет-решение. Повторять, пока «Not yet specified» не опустеет.

### Шаг 3. Карта → фичи → код

Когда путь ясен, MVP режется на фичи по фазам roadmap. Каждая фича — в своей ветке от `main` (её создаёт агент) и проходит цикл из [ai-workflow.md](ai-workflow.md#жизненный-цикл): `/grill-with-docs` → `/to-spec` → `/to-tickets` в одной сессии, затем `/clear` + `/implement` на каждый тикет.

С MVP тесты строже, чем на PoC: ошибки и граничные случаи тестируются в рамках самого тикета (`CLAUDE.md` → «Тесты»).

Рекомендуемый порядок фич:

| # | Фича (`.scratch/<slug>`) | Блок | Фаза |
|---|---|---|---|
| 1 | `lesson-manifest` — несколько Lesson из файлов, Solution, Reset | C | 1 |
| 2 | `multi-file-workspace` — virtual FS, табы → **MVP, часть 2** | A | 1 |
| 3 | `runtime-hardening` — прогрев и холодный старт вне deadline (R1), loop-guard (R3), отмена, console, source maps, async-ошибки (R8) | A | 1 |
| 4 | `author-cli` — `course create` / `course test` + CI-проверка уроков | D | 1 |
| 5 | `dependency-pipeline` — registry → CI → артефакты по hash | B | 2 |
| 6 | `ts-tooling` — diagnostics, autocomplete, `.d.ts` | E | 2 |
| 7 | `course-ux` — навигация, прогресс, save/restore | H | 3 |
| 8 | `security-baseline` — отдельный origin, CSP, лимиты + `/security-review` → **MVP, часть 2** (до серверного хранения и внешних пользователей) | F | 3 |
| 9 | `pilot-course` — 5–10 реальных Lesson, прогон через CLI, пилот на людях | — | 3 |

`/improve-codebase-architecture` — раз в неделю-две, пока код не расползся.
