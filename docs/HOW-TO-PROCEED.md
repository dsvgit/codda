# Как двигаться дальше: PoC → MVP

Процесс построен на скиллах Matt Pocock (`mattpocock-skills`). Основной поток:

```
/grill-with-docs → /to-spec → /to-tickets → /implement (по тикету, /clear между тикетами) → /code-review
```

Для большого «туманного» объёма (MVP) перед ним — `/wayfinder`. Справка по выбору скилла — `/ask-matt`.

> Команды в Claude Code могут называться с префиксом плагина: `/mattpocock-skills:implement` и т.д.

## Что уже лежит в репозитории

| Файл | Зачем |
|---|---|
| `CLAUDE.md` | Контекст проекта и жёсткие ограничения — агент читает в каждой сессии |
| `CONTEXT.md` | Глоссарий: Lesson, Workspace, Run, Sandbox, Test Report, Dependency Artifact… |
| `docs/adr/0001–0005` | Ключевые решения: свой Runtime, без внешней сети, sandbox без same-origin, сначала только браузерная проверка, зависимости как артефакты |
| `docs/agents/*` | Конфигурация скиллов (эквивалент `/setup-matt-pocock-skills`: локальный трекер в `.scratch/`, single-context) |
| `.scratch/golden-path-poc/spec.md` | Спека PoC (формат `/to-spec`) |
| `.scratch/golden-path-poc/issues/01–05` | Тикеты PoC с блокирующими связями (формат `/to-tickets`) |
| `docs/roadmap.md` | Фазы, определение MVP, блоки работ A–H |

---

## Часть 1. Golden Path PoC (2–3 дня)

### Шаг 0. Подготовка (15 мин)

```bash
cd ~/projects/codda
git init && git add -A && git commit -m "docs: SDD for Golden Path PoC"
```

Убедитесь, что Playwright сможет поставить Chromium (один раз нужен доступ к сети или внутреннему зеркалу — это dev-окружение, не runtime).

### Шаг 1. Проверить спеку (30–60 мин, по желанию, но рекомендую)

```
/grill-with-docs .scratch/golden-path-poc/spec.md
```

Агент «прожарит» спеку и обновит `CONTEXT.md`/ADR. Решения, которые стоит подтвердить именно вам:

- **Шов тестирования** — `Runner.run({ source, tests }) → TestReport` + один e2e на Playwright. Согласны, что это главный шов?
- **Свой мини Test Harness** вместо Vitest/Testing Library в Sandbox — ок для PoC?
- **Вшивать React в бандл** (а не import map) — ок для PoC?
- **Timeout 5 с.**

Если что-то поменялось — поправьте спеку и тикеты до начала реализации.

### Шаг 2. Реализация по тикетам

Порядок (frontier): `01` → (`02` ∥ `03`) → `04` → `05`.

Для каждого тикета — **новая сессия**:

```
/clear
/implement .scratch/golden-path-poc/issues/01-ts-function-tracer-bullet.md
```

`/implement` идёт через `/tdd` (red → green на шве Runner), гоняет typecheck и тесты, в конце — `/code-review`, затем коммит. После тикета:

1. Сами запустите `npm run dev` и пройдите сценарий руками.
2. Отметьте чекбоксы и поставьте `Status: done` в файле тикета.
3. Замеры/сюрпризы — в раздел `## Comments` тикета.

`02` и `03` независимы — можно параллельно в двух сессиях (лучше в отдельных git worktree).

**Если застряли** (esbuild-wasm не инициализируется, iframe молчит, React падает на `act`):

```
/diagnosing-bugs
```

**Контрольные точки по дням:**

| День | Готово, если… |
|---|---|
| 1 | Тикет 01: правка `-` → `+` превращает 0/2 в 2/2 |
| 2 | Тикеты 02 + 03: Counter 0/3 → 3/3; синтаксическая ошибка, throw и `while(true)` дают понятный Test Report |
| 3 | Тикет 04: `npm run test:e2e` зелёный при заблокированной сети. Тикет 05: отчёт и демо |

**Правило стоп-крана:** если к концу дня 2 хотя бы один из пяти вопросов спеки выглядит как «нет/очень сложно» — не продолжайте полировку, переходите сразу к отчёту (тикет 05) и пересмотру архитектуры.

### Шаг 3. Go / no-go (тикет 05)

Заполните `docs/poc-report.md`. Если go — переходим к Части 2. Если что-то в архитектуре поменялось — новый ADR (`/domain-modeling` поможет его оформить) и правка `docs/roadmap.md`.

---

## Часть 2. От PoC к MVP (4–6 недель)

MVP — это многосессионная работа с неизвестными, поэтому сначала карта решений, потом спеки.

### Шаг 4. Карта MVP (1 сессия)

```
/wayfinder Довести codda от Golden Path PoC до MVP из docs/roadmap.md
```

Wayfinder создаст `.scratch/mvp/map.md` и тикеты-решения (`research` / `prototype` / `grilling` / `task`). Ожидаемые первые решения:

- **research:** CJS → ESM для произвольных npm-пакетов, import maps vs бандлинг, кэширование артефактов (блок B) — уйдёт в фоновые агенты через `/research`.
- **research:** TypeScript language service в Worker для CodeMirror (блок E).
- **grilling:** схема Lesson Manifest (блок C) и команды Author CLI (блок D).
- **prototype:** раскладка UI с несколькими файлами и навигацией по Lesson (`/prototype`).
- **grilling:** где будет хоститься Sandbox origin и какие CSP (блок F).

### Шаг 5. Пройти карту (несколько сессий)

```
/clear
/wayfinder .scratch/mvp/map.md
```

Одна сессия — один тикет-решение. Повторяйте, пока «Not yet specified» не опустеет.

### Шаг 6. Карта → фичи → код

Когда путь ясен, режем MVP на фичи по фазам roadmap. Для каждой фичи — **в одной непрерывной сессии**:

```
/grill-with-docs <фича>          # уточнить
/to-spec                          # → .scratch/<feature>/spec.md
/to-tickets                       # → .scratch/<feature>/issues/NN-*.md
```

Затем для каждого тикета — свежая сессия `/clear` + `/implement <путь к тикету>`.

Рекомендуемый порядок фич:

| # | Фича (`.scratch/<slug>`) | Блок | Фаза |
|---|---|---|---|
| 1 | `lesson-manifest` — несколько Lesson из файлов, Solution, Reset | C | 1 |
| 2 | `multi-file-workspace` — virtual FS, табы | A | 1 |
| 3 | `runtime-hardening` — отмена, console, source maps, recovery | A | 1 |
| 4 | `author-cli` — `course create` / `course test` + CI-проверка уроков | D | 1 |
| 5 | `dependency-pipeline` — registry → CI → артефакты по hash | B | 2 |
| 6 | `ts-tooling` — diagnostics, autocomplete, `.d.ts` | E | 2 |
| 7 | `course-ux` — навигация, прогресс, save/restore | H | 3 |
| 8 | `security-baseline` — отдельный origin, CSP, лимиты + `/security-review` | F | 3 |
| 9 | `pilot-course` — 5–10 реальных Lesson, прогон через CLI, пилот на людях | — | 3 |

### Гигиена контекста

- Grilling → spec → tickets — в **одной** сессии (не `/compact` между ними).
- Каждый `/implement` — с чистого листа (`/clear`): тикет самодостаточен.
- Новый термин или решение всплыло в процессе — сразу в `CONTEXT.md` / новый ADR, а не в голове.
- `/improve-codebase-architecture` — раз в неделю-две, пока код не расползся.

## Шпаргалка

| Ситуация | Команда |
|---|---|
| Не знаю, какой скилл нужен | `/ask-matt` |
| Уточнить идею/фичу | `/grill-with-docs` |
| Неясно, как должно выглядеть/вести себя | `/prototype` |
| Нужны факты из документации | `/research` |
| Разговор → спека | `/to-spec` |
| Спека → тикеты | `/to-tickets` |
| Сделать тикет | `/implement <путь>` |
| Сложный баг | `/diagnosing-bugs` |
| Ревью ветки | `/code-review` |
| Большой туманный объём | `/wayfinder` |
