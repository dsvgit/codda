# 01: Курс React Hooks зелёный в CI и e2e «студент проходит курс»

**What to build:** Пилотный Course React Hooks (5 Lesson, один Module) проходит `codda test` с проверкой типов без `✗` и без `⚠` и собирается `codda build` в job `check`. Новый e2e по той сборке курса, что CI выкладывает на пилот, проходит курс глазами студента offline: все 5 Lesson подряд, итог «Пройдено 5 из 5», прогресс и Workspace переживают перезагрузку. Что мешает, чинится здесь: контент — правкой файлов Lesson без смены смысла заданий, баг инструмента — с регрессионным тестом на его шве. См. [спеку](../spec.md), разделы Implementation Decisions и Testing Decisions.

**Blocked by:** все тикеты фич `misc-03-workspaces`, `lesson-manifest`, `runtime-hardening`, `dependency-artifacts`, `author-cli`, `ts-tooling`, `course-ux` (строки 0–6 «Порядка фич» в [README.md](../../README.md)).

**Status:** ready-for-agent

- [ ] Локально `CI=true npx codda test courses/react-hooks`: код `0`, 5 строк `✓`, ни одной `⚠` (ошибки типов в Starter устранены правкой Starter; Starter по-прежнему даёт ≥1 FAIL)
- [ ] Локально `npx codda build courses/react-hooks`: код `0`
- [ ] Правки Lesson не меняют смысл заданий; каждая правка — строкой в `## Comments` (Lesson, что и почему)
- [ ] Если найден баг инструмента: исправлен, регрессионный тест на его шве увиден красным до исправления; находка — в `## Comments` и в «Журнал допущений» [README.md](../../README.md)
- [ ] e2e-сценарии идут по выходу `codda build` курса React Hooks из подпути (как на GitHub Pages) с фикстурой offline; Playwright-проект для этого добавлен, только если его ещё нет
- [ ] e2e: студент открывает пилот, проходит 5 Lesson подряд (решение из `course.json` сборки вводится в редактор → «Запустить тесты» → PASS → «Следующий урок →»), видит «Пройдено 5 из 5»; запросов за пределы localhost нет
- [ ] e2e, граничный случай: Run на Starter без правок даёт FAIL, Lesson не отмечен ✓, прогресс не растёт
- [ ] e2e, граничный случай: после перезагрузки страницы открыт тот же Lesson, прогресс и введённый Workspace на месте
- [ ] e2e, граничный случай: у последнего Lesson после PASS нет перехода на несуществующий следующий
- [ ] Каждый e2e-сценарий сначала увиден красным (в `## Comments` — как именно)
- [ ] `npm run typecheck`, `npm test`, `npm run test:e2e` зелёные; job `check` в CI зелёная на push в `mvp-autorun`
