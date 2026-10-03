# План решений: от Golden Path PoC до MVP

Label: wayfinder:map

«План решений» — русское название карты `/wayfinder`. Тикеты лежат в [issues/](issues/). **Фронт работ** (frontier) — открытые (`Status: open`), разблокированные и никем не взятые тикеты; берётся первый по номеру.

## Destination

По каждой фиче, вошедшей в MVP (скоуп — в [questions/00-map-round-2-scope.md](questions/00-map-round-2-scope.md) с уточнениями из [questions/00-map-round-3.md](questions/00-map-round-3.md)), не осталось вопроса, на который нужен ответ **до** начала работы над ней. Дальше фичи идут обычным циклом по одной (`/grill-with-docs` → `/to-spec` → `/to-tickets` → `/implement`). Спеки фич в План решений не входят.

## Notes

- Домен: `CONTEXT.md`, ADR в `docs/adr/`, roadmap — `docs/roadmap.md` (скоуп MVP и раздел «MVP, часть 2»).
- Для grilling-тикетов вызывать скиллы `grilling` и `domain-modeling`; research — субагентом через `research` на ветке `research/<name>`; prototype — через `prototype`.
- Ветка Плана решений — `mvp`. Решения по мере закрытия тикетов мержатся в `main`.
- Решения, принятые при составлении Плана (раунды вопросов: [questions/00-map-round-1-destination.md](questions/00-map-round-1-destination.md), [questions/00-map-round-2-scope.md](questions/00-map-round-2-scope.md), [questions/00-map-round-3.md](questions/00-map-round-3.md)):
  - В MVP у Lesson **один файл** Workspace; multi-file — во «второй части MVP».
  - Instructions — обычный Markdown, MDX не делаем.
  - Инструмент `codda` отделён от контента, курсы передаются путём, сборка статическая, registry — из `.npmrc` или по умолчанию: [ADR-0006](../../docs/adr/0006-tool-separate-from-content.md).
  - Зависимости задаются только на уровне Course, в `package.json` (пересмотрено тикетом 08, ADR-0007); версии точные; «произвольный пакет» = любой, прошедший `codda test`.
  - Весь UI на русском, у действий нет подтверждений.
  - Пилотный курс — существующий React Hooks, переведённый на новый формат; старый формат удаляется.
  - Security baseline отложен, но обязателен до серверного хранения (7.4) и до любых внешних пользователей. Пилот проводится только в Chrome: без защиты от бесконечных циклов Safari вешает вкладку. Холодный старт (R1) принимаем; поднять, если всплывёт в пилоте.

## Decisions so far

<!-- одна строка на закрытый тикет: [название](ссылка): суть ответа -->

- [Как собирать и доставлять Dependency Artifacts](issues/01-dependency-artifacts.md): research рекомендует артефакт на набор Course ∪ Lesson, CJS-обёртки с default-экспортом, доставку import map'ом отдельно от кода студента, только dev-сборку, типы отдельным JSON-артефактом; транспорт — после замера, решение — ADR.
- [TypeScript language service в Web Worker для CodeMirror 6 без сети](issues/02-ts-language-service.md): TS 7 в браузере не работает — отдельный Worker «Type Checker» на TS 6 + `@typescript/vfs`, lib и `.d.ts` с нашего origin, своя обвязка CM6; продуктовые вопросы — отдельным тикетом.
- [Схема Lesson Manifest и файловая структура Course](issues/03-lesson-manifest-schema.md): `course.yaml` (`id`, `title`, `modules` с явным порядком Lesson); Lesson — папка-id с `lesson.md` (frontmatter `title`), `main.ts(x)`, `solution.*`, `lesson.test.*`; зависимости — в `package.json` Course (пересмотрено тикетом 08); Zod, strict; ошибки `codda test` — все сразу, по строке; Instructions без raw HTML и картинок.
- [Раскладка экрана Lesson и тулбар](issues/04-lesson-screen-prototype.md): по прототипу (ветка `prototype/lesson-screen`) — вариант «IDE»: дерево Course с ✓ и «Пройдено N из M» · Instructions · редактор; тулбар над редактором (Запустить тесты ⇄ Отмена, Сбросить, Показать решение, Пред./След.); нижняя панель с вкладками Тесты / Console / Проблемы / Решение (решение только для чтения, Workspace не трогает); баннер PASS с «Следующий урок →»; Reset откатывается через Ctrl/Cmd+Z.
- [Эксперимент: транспорт Dependency Artifacts в Sandbox](issues/07-artifact-transport-experiment.md): отложен в «MVP, часть 2» решением тикета 08.
- [ADR: сборка и доставка Dependency Artifacts](issues/08-dependency-artifacts-adr.md): ADR-0007 — один Dependency Artifact на Course из `package.json` + `package-lock.json` (npm ведёт lock, у Lesson своих зависимостей нет); `importmap.json` + `types.json` по hash; CJS через `require` + `export default`; только dev-сборка; в MVP вшивается в бандл как в PoC, эксперимент 07 отложен в «MVP, часть 2».
- [Команды CLI `codda`](issues/05-codda-cli-commands.md): `init`, `lesson`, `test`, `dev`, `build` (без `ci` и `deps`, CI = `CI=true`); путь необязателен, ищется `course.yaml` вверх; UI собран заранее, курс — данные `course.json` + `deps/` (ADR-0008); `codda test` — манифест → npm → артефакт → сборка → полный Chromium через Playwright (зеркало), Solution всё PASS, Starter ≥1 FAIL, типы Solution/тестов строго; коды выхода 0/1/2; `node cli/codda.ts`.
- [CI, хранилище Dependency Artifacts и хостинг пилота](issues/06-ci-and-pilot-hosting.md): GitHub Actions на PR и push в `main` (тесты инструмента, граница ADR-0006, `codda test` + `codda build` для каждого курса), merge только через PR; артефакт только внутри сборки; пилот — публичные GitHub Pages, выкладка проверенного `dist/` на push в `main`; URL относительные, Lesson во фрагменте `#/…`, `course.json` с `no-cache`; шаблоны CI для курсов — `codda init --ci github|gitlab` (GitLab: свой образ, выкладка в S3); ADR-0002 уточнён: закрытый контур — свойство установки.
- [Type Checker: поведение в редакторе](issues/09-type-checker-behaviour.md): ADR-0009 — отдельный Worker на TS 6 (алиас `typescript-6`) + `@typescript/vfs`; ошибки типов Run не блокируют и на оценку не влияют; один конфиг `ESNext` для Compiler, Type Checker и `codda test`; один воркер на сессию со статусом в «Проблемах»; только ошибки, английские, debounce ~300 мс; autocomplete только от TS, auto-import и signature help — в «MVP, часть 2».

## Not yet specified

Пусто — Destination достигнут 2026-10-04. План решений закрыт, дальше — фичи по таблице Шага 3 в [docs/HOW-TO-PROCEED.md](../../docs/HOW-TO-PROCEED.md).

- Test Harness: асинхронные ошибки, отмена Run и source maps в Sandbox (3.3–3.7) — не вопрос до старта, а работа внутри фичи `runtime-hardening`; решается на её `/grill-with-docs`. Доставка решена (ADR-0007): в MVP артефакты вшиваются в бандл, сопоставление ошибок со строками студента — как в PoC.

## Out of scope

- Всё с отметкой «после» в [questions/00-map-round-2-scope.md](questions/00-map-round-2-scope.md) — раздел «MVP, часть 2» в `docs/roadmap.md`: multi-file Workspace, прогрев Worker, защита от бесконечных циклов, preview, CSS из пакетов, hover и форматирование, сервер и вход, подсказки, security baseline.
- MDX: не делаем.
- Production-ready v1 и Phase 4 из roadmap.
