# 08: ADR: сборка и доставка Dependency Artifacts

Type: grilling
Status: open
Blocked by: 07

## Question

Принять решение по Dependency Artifacts на основе research (тикет «Как собирать и доставлять Dependency Artifacts») и замеров спайка (тикет «Спайк: транспорт Dependency Artifacts в Sandbox») и записать его ADR.

- Гранулярность: артефакт на набор Course ∪ Lesson (рекомендация) или на пакет.
- Транспорт в Sandbox: вариант 2 (URL + CORS + `integrity`) или 3 (blob через `postMessage`); что делать с R4 до него.
- Формат манифеста: specifier → файл, hash, типовой артефакт рядом с JS.
- `.d.ts`: если у пакета нет своих типов — `codda` подбирает `@types/<name>` той же major сам или требует объявить явно.
- Какие из трёх ступеней проверки «работает в браузере» входят в MVP.
