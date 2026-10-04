# Один Dependency Artifact на Course из его `package.json`; в MVP вшивается в бандл

Уточняет ADR-0005. Зависимости объявляются только на уровне Course, в стандартных `package.json` (`dependencies`, точные версии) и `package-lock.json` в корне Course. Ведёт их npm, а `codda` их только читает. У Lesson своих зависимостей нет: если пакет нужен одному Lesson, он объявляется в Course. CI выполняет `npm ci` и собирает все точки входа **одним** вызовом esbuild (`format: "esm"`, `splitting: true`, `platform: "browser"`, conditions с `development`, `NODE_ENV=development`). Получается один Dependency Artifact на Course с одним экземпляром каждого модуля, без шимов вроде `react-as-esm` из PoC. Отказались от двух вариантов. Артефакт на каждый пакет (модель esm.sh) требует своего переписчика CJS и резолвера графа. Наборы Course ∪ Lesson с собственными lockfile'ами — это своя инфраструктура, которую npm уже даёт бесплатно.

Точки входа не объявляются, а выводятся из импортов Starter, Solution и Lesson Tests всех Lesson. CJS-пакет получает ESM-обёртку: имена экспортов берутся через `require()` в Node, а `export default` равен `module.exports` (R9). В MVP только development-сборка: `act` есть только в ней (R5).

Артефакт лежит в `deps/<hash>/`. Там `importmap.json` строго по спецификации HTML (`imports` и `integrity` sha384 на каждый файл, включая chunk'и), `types.json` для Type Checker и файлы с content-hash в именах. `<hash>` считается от `package-lock.json`, списка точек входа, версии esbuild, конфига сборки (вместе с `mode`) и версии пайплайна `codda`. Совпал hash — пересборки нет.

В MVP транспорт как в PoC: Worker один раз скачивает файлы по `importmap.json`, проверяет `integrity` и на каждом Run вшивает их в бандл вместе с кодом студента. Медленный Run (R4) принимаем сознательно. Эксперимент, который выбирает между import map в `srcdoc` с загрузкой по URL и blob'ами через `postMessage`, отложен в «MVP, часть 2». Формат `importmap.json` выбран так, чтобы оба варианта использовали его без изменений.

## Consequences

- `course.yaml` и frontmatter `lesson.md` больше не содержат `dependencies` (пересмотр тикета 03). В шаблон курса входит `.npmrc` с `save-exact=true`. Диапазон версий в `package.json` — ошибка `codda test`. `devDependencies` `codda` игнорирует.
- `@types/*` автор объявляет явно в `dependencies`. Они попадают только в `types.json`, в JS-сборку их не включаем. Если у пакета нет типов, `codda test` подсказывает, какой `@types` объявить. Пакет без типов вообще даёт предупреждение и в Type Checker становится `declare module` (`any`).
- Студент не может импортировать specifier, которого нет среди точек входа, даже если пакет установлен: compile-error «импорт не предусмотрен заданием».
- Проверка «работает в браузере» в `codda test`: импорт Node built-in — ошибка сборки с именем пакета. Пакет, который падает при `require()` в Node, — ошибка с именем пакета. Все Chromium-прогоны `codda test` блокируют запросы не на наш origin (ADR-0002). Поэтому Lesson Tests в `codda test` выполняются в Chromium. Статический скан на `process`/`Buffer` отложен.
- Ошибки `npm ci` показываются как есть, с префиксом `npm ci:` и одной подсказкой от `codda`.
- Транспорт как в PoC не требует CORS на хостинге и в `codda dev`.
- Ограничение: в одном Course не может быть двух версий одного пакета. Если понадобится, Lesson-уровень добавляется в «MVP, часть 2».
- Адреса в `importmap.json` считаются от корня Course Build (`./deps/<hash>/…`), а не от папки артефакта: в «MVP, часть 2» файл вставляется в `srcdoc` как есть (фича `dependency-artifacts`, Q1).
- «`declare module` (`any`)» для пакета без типов — это заглушка `/node_modules/@types/<имя>/…d.ts` в `types.json`, её кладёт сборщик; Type Checker читает `types.json` как кусок `node_modules` без особых правил (фича `dependency-artifacts`, Q4).
