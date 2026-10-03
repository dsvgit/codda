# 08: ADR: сборка и доставка Dependency Artifacts

Type: grilling
Status: resolved
Blocked by: None

## Question

Принять решение по Dependency Artifacts на основе research (тикет «Как собирать и доставлять Dependency Artifacts») и замеров эксперимента (тикет «Эксперимент: транспорт Dependency Artifacts в Sandbox») и записать его ADR.

- Гранулярность: артефакт на набор Course ∪ Lesson (рекомендация) или на пакет.
- Транспорт в Sandbox: вариант 2 (URL + CORS + `integrity`) или 3 (blob через `postMessage`); что делать с R4 до него.
- Формат манифеста: specifier → файл, hash, типовой артефакт рядом с JS.
- `.d.ts`: если у пакета нет своих типов — `codda` подбирает `@types/<name>` той же major сам или требует объявить явно.
- Какие из трёх ступеней проверки «работает в браузере» входят в MVP.

Вопросы и ответы: [questions/08-dependency-artifacts-adr.md](../questions/08-dependency-artifacts-adr.md)

## Answer

Решение — [ADR-0007](../../../docs/adr/0007-dependency-artifact-per-course.md), итог по пунктам — в разделе «Общий итог» файла вопросов.

- Зависимости объявляются только у Course, в стандартных `package.json` (точные версии) и `package-lock.json`. Ведёт их npm. У Lesson своих зависимостей нет (пересмотр тикета 03).
- Один Dependency Artifact на Course: `npm ci` и один `esbuild.build` со `splitting`, только development-сборка. Точки входа выводятся из импортов Lesson.
- CJS → ESM: имена экспортов через `require()` в Node, плюс `export default`.
- `deps/<hash>/`: стандартный `importmap.json` с `integrity`, `types.json`, файлы с content-hash в именах.
- Транспорт в MVP как в PoC: зависимости вшиваются в бандл на каждом Run, R4 принимается. Эксперимент 07 отложен в «MVP, часть 2».
- `@types/*` объявляются явно. Пакет без типов становится `any` с предупреждением.
- «Работает в браузере»: ошибка на Node built-ins, блокировка внешних запросов во всех Chromium-прогонах `codda test`. Ошибки npm показываются как есть.
