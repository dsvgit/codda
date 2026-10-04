# Как двигаться дальше: PoC → MVP

Процесс, роли, скиллы и соглашения — [ai-workflow.md](ai-workflow.md). Здесь — только порядок шагов.

## Часть 1. Golden Path PoC ✅

Сделано 2026-10-03: тикеты 01–05 в [.scratch/golden-path-poc/](../.scratch/golden-path-poc/), решение **GO** — [poc-report.md](poc-report.md). Отклонения от спеки — в разделе «Итог» [спеки](../.scratch/golden-path-poc/spec.md).

## Часть 2. От PoC к MVP (4–6 недель)

### Шаг 0. Хвост PoC ✅

Курс React Hooks в `courses/` сделан вне тикетов. Решено (раунд 3 Плана решений): он переводится на формат Lesson Manifest и становится пилотным Course, старый формат удаляется — в фиче `lesson-manifest`.

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

### Шаг 2. Пройти План решений (несколько сессий) ✅

Сделано 2026-10-04: тикеты 01–09 в [.scratch/mvp/issues/](../.scratch/mvp/issues/) закрыты, «Not yet specified» пуст — итоги в «Decisions so far» [map.md](../.scratch/mvp/map.md).

```
/clear
/wayfinder .scratch/mvp/map.md
```

Одна сессия — один тикет-решение. Повторять, пока «Not yet specified» не опустеет.

### Шаг 3. Карта → фичи → код

Когда путь ясен, MVP режется на фичи по фазам roadmap. Каждая фича — в своей ветке от `main` (её создаёт агент) и проходит цикл из [ai-workflow.md](ai-workflow.md#жизненный-цикл): `/grill-with-docs` → `/to-spec` → `/to-tickets` в одной сессии, затем `/clear` + `/implement` на каждый тикет.

С MVP тесты строже, чем на PoC: ошибки и граничные случаи тестируются в рамках самого тикета (`CLAUDE.md` → «Тесты»).

Рекомендуемый порядок фич (рамки каждой уточняются на её `/grill-with-docs`; отложенное — в «MVP, часть 2» [roadmap.md](roadmap.md)):

| # | Фича (`.scratch/<slug>`) | Блок | Фаза |
|---|---|---|---|
| 0 | `misc-01-ci-bootstrap` — GitHub Actions: typecheck, unit, e2e на PR и push в `main`; обязательная проверка в branch protection ([тикет](../.scratch/misc/issues/01-ci-bootstrap.md)); `misc-02-pages-deploy` — выкладка пилота на GitHub Pages из CI на push в `main`, сборка из подпути `/codda/` ([тикет](../.scratch/misc/issues/02-pages-deploy.md)) | — | 1 |
| 0a | `misc-03-workspaces` — npm workspaces: инструмент в `packages/codda/`, курсы вне workspaces; после `misc/02` (Pages), до `lesson-manifest` ([тикет](../.scratch/misc/issues/03-workspaces.md)) | — | 1 |
| 1 | `lesson-manifest` — `course.yaml` + папки Lesson (тикет 03), Zod-схема, UI читает Course как данные `course.json` (ADR-0008), экран Lesson по прототипу 04, Solution, Reset, проверка границы ADR-0006 в CI; перевод React Hooks, удаление старого формата | C | 1 |
| 2 | `runtime-hardening` — отмена Run, console, source maps, async-ошибки (R8), восстановление после падения | A | 1 |
| 3 | `dependency-artifacts` — Dependency Artifact на Course из `package.json` + `package-lock.json`, `importmap.json` + `types.json` по hash, вшивание в бандл (ADR-0007) | B | 1 |
| 4 | `author-cli` — `codda init/lesson/test/dev/build` (тикет 05, ADR-0008) в `packages/codda/cli/`, курс подключает его через `file:` и вызывает `npx codda` (misc/03), шаги `codda test/build` в CI (выкладка на GitHub Pages уже есть с misc/02, `codda build` заменяет в ней только `npm run build`), шаблоны CI для курсов (тикет 06) | D | 1 |
| 4a | `misc-04-cli-package-publish` — публикация пакета `codda` для `npx codda` в репозиториях курсов; пересматривает ADR-0006, сначала grilling; нужна, когда появится второй репозиторий курса ([тикет](../.scratch/misc/issues/04-cli-package-publish.md)) | D | 1 |
| 5 | `ts-tooling` — Type Checker: diagnostics, autocomplete, `.d.ts` из `types.json` (тикет 09, ADR-0009) | E | 2 |
| 6 | `course-ux` — дерево Course и навигация, локальный прогресс и Workspace в `localStorage` | H | 3 |
| 7 | `pilot-course` — 5–10 реальных Lesson, прогон через CLI, пилот на людях (только Chrome) | — | 3 |

`/improve-codebase-architecture` — раз в неделю-две, пока код не расползся.
