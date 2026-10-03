# План решений: от Golden Path PoC до MVP

Label: wayfinder:map

«План решений» — русское название карты `/wayfinder`. Тикеты лежат в [issues/](issues/). Frontier — открытые (`Status: open`), разблокированные тикеты; берётся первый по номеру.

## Destination

По каждой фиче, вошедшей в MVP (скоуп — в [scope-questions.md](scope-questions.md) с уточнениями из [round-3-questions.md](round-3-questions.md)), не осталось вопроса, на который нужен ответ **до** начала работы над ней. Дальше фичи идут обычным циклом по одной (`/grill-with-docs` → `/to-spec` → `/to-tickets` → `/implement`). Спеки фич в План решений не входят.

## Notes

- Домен: `CONTEXT.md`, ADR в `docs/adr/`, roadmap — `docs/roadmap.md` (скоуп MVP и раздел «MVP, часть 2»).
- Для grilling-тикетов вызывать скиллы `grilling` и `domain-modeling`; research — субагентом через `research` на ветке `research/<name>`; prototype — через `prototype`.
- Ветка Плана решений — `mvp`. Решения по мере закрытия тикетов мержатся в `main`.
- Решения, принятые при составлении Плана (раунды вопросов: [destination-questions.md](destination-questions.md), [scope-questions.md](scope-questions.md), [round-3-questions.md](round-3-questions.md)):
  - В MVP у Lesson **один файл** Workspace; multi-file — во «второй части MVP».
  - Instructions — обычный Markdown, MDX не делаем.
  - Инструмент `codda` отделён от контента, курсы передаются путём, сборка статическая, registry — из `.npmrc` или по умолчанию: [ADR-0006](../../docs/adr/0006-tool-separate-from-content.md).
  - Зависимости задаются на уровне Course, Lesson добавляет свои; версии точные; «произвольный пакет» = любой, прошедший `codda test`.
  - Весь UI на русском, у действий нет подтверждений.
  - Пилотный курс — существующий React Hooks, переведённый на новый формат; старый формат удаляется.
  - Security baseline отложен, но обязателен до серверного хранения (7.4) и до любых внешних пользователей. Пилот проводится только в Chrome: без защиты от бесконечных циклов Safari вешает вкладку. Холодный старт (R1) принимаем; поднять, если всплывёт в пилоте.

## Decisions so far

<!-- одна строка на закрытый тикет: [название](ссылка): суть ответа -->

## Not yet specified

- **TS-подсказки для зависимостей.** Как `.d.ts` из Dependency Artifacts попадают в language service. Станет вопросом после ответов на «Как собирать и доставлять Dependency Artifacts» и «TypeScript language service в Web Worker».
- **Test Harness: асинхронные ошибки, отмена Run и source maps в Sandbox (3.3–3.7).** Пока похоже на работу внутри фичи `runtime-hardening`, но решение о доставке артефактов (вшивать или грузить отдельно) может поменять то, как ошибки сопоставляются со строками студента.
- **`codda dev`.** Как локальный просмотр подхватывает изменения в папке курса. Прояснится после «Команд CLI `codda`».

## Out of scope

- Всё с отметкой «после» в [scope-questions.md](scope-questions.md) — раздел «MVP, часть 2» в `docs/roadmap.md`: multi-file Workspace, прогрев Worker, защита от бесконечных циклов, preview, CSS из пакетов, hover и форматирование, сервер и вход, подсказки, security baseline.
- MDX: не делаем.
- Production-ready v1 и Phase 4 из roadmap.
