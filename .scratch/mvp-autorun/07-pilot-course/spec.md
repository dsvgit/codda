# Spec: pilot-course

**Status:** ready-for-agent — вопросы закрыты в [questions/00-grill.md](questions/00-grill.md), все рекомендации приняты.

Последняя фича MVP (строка 7 «Порядка фич» в [README.md](../README.md)). Вопросы — в [questions/00-grill.md](questions/00-grill.md); спека и тикеты написаны по рекомендациям, пустой ответ их не меняет.

## Problem Statement

К началу этой фичи все остальные фичи MVP (`misc-03-workspaces` … `course-ux`) сделаны по отдельности, каждая со своими тестами. Но никто ещё не проверил целиком то, что получат люди на пилоте: настоящий Course React Hooks, собранный `codda build`, выложенный из CI и пройденный от первого Lesson до последнего. Неизвестно, проходят ли все 5 Lesson строгую проверку `codda test` с типами из `ts-tooling`. Неясно, какие пункты «Определения MVP» из `docs/roadmap.md` реально закрыты и чем это доказано. Документы описывают PoC: README учит открывать `?lesson=…`, в `CLAUDE.md` «текущая стадия» — PoC. Author не по чему сделать свой курс, а человеку не по чему провести пилот.

## Solution

Новый контент не пишем (решение человека, Q2–Q3 в [00-mvp-autorun.md](../questions/00-mvp-autorun.md)): пилотный Course — 5 Lesson React Hooks, их перевод на формат Lesson Manifest сделал `lesson-manifest`. Фича — финальная проверка MVP перед пилотом:

1. **Курс зелёный.** `codda test` (с проверкой типов) и `codda build` по `courses/react-hooks` проходят в CI без ошибок и без предупреждений. Что не проходит, чинится: контент Lesson — правкой файлов Lesson, баг инструмента — в этом же тикете с тестом.
2. **Сквозной e2e «студент проходит курс».** Playwright, без Internet, на той сборке `codda build`, которую CI выкладывает на пилот: студент открывает Course, проходит все 5 Lesson подряд, видит «Пройдено 5 из 5», перезагружает страницу и находит прогресс и Workspace на месте.
3. **Сверка с «Определением MVP».** Каждый пункт из `docs/roadmap.md` — строка таблицы: сделано / не сделано / частично и доказательство (тест или коммит). Таблица — в разделе `## Итог` этой спеки.
4. **Документы по факту.** README для Author: как сделать Course и Lesson через `codda`, от `codda init` до CI. `CLAUDE.md` («Текущая стадия»), `docs/HOW-TO-PROCEED.md` и `docs/roadmap.md` описывают состояние «MVP собран, следующий шаг — пилот».
5. **Тикет на пилот на людях** со статусом `ready-for-human`: что подготовить, сценарий, что собрать в фидбеке. `docs/mvp-report.md` пишется после пилота, не здесь.

## User Stories

1. Как участник пилота, я хочу открыть адрес пилота и сразу попасть в первый Lesson курса React Hooks, чтобы начать без инструкций.
2. Как участник пилота, я хочу пройти все 5 Lesson подряд кнопкой «Следующий урок →», чтобы не искать следующее задание.
3. Как участник пилота, я хочу, чтобы каждый Lesson решался по своим Instructions, а Solution проходил все тесты, чтобы не упереться в сломанное задание.
4. Как участник пилота, я хочу не видеть ошибок типов в Starter до того, как начал писать, чтобы красные подчёркивания не путали меня с первой секунды.
5. Как участник пилота, я хочу, чтобы прогресс «Пройдено N из 5» и мой код сохранились после перезагрузки страницы, чтобы вернуться к курсу позже.
6. Как участник пилота, я хочу, чтобы неверное решение не отмечалось ✓, чтобы прогресс отражал реальные PASS.
7. Как участник пилота, я хочу, чтобы курс работал без обращений к внешним сервисам, чтобы он работал и в закрытом контуре.
8. Как Author, я хочу прочитать в README, как создать Course командой `codda init`, чтобы начать курс без чтения исходников `codda`.
9. Как Author, я хочу прочитать в README, как добавить Lesson командой `codda lesson`, из каких файлов он состоит и что в них писать, чтобы сделать задание по образцу.
10. Как Author, я хочу прочитать в README, что проверяет `codda test` и как читать его вывод (`✓` / `✗` / `⚠`, коды выхода), чтобы чинить Lesson без догадок.
11. Как Author, я хочу прочитать в README, как смотреть курс локально через `codda dev`, чтобы видеть Lesson глазами студента.
12. Как Author, я хочу прочитать в README, как собрать курс `codda build` и подключить CI шаблоном `codda init --ci`, чтобы выкладывать курс автоматически.
13. Как Author, я хочу, чтобы React Hooks был рабочим образцом курса в новом формате, чтобы копировать из него приёмы.
14. Как владелец продукта, я хочу таблицу «пункт Определения MVP → сделано / нет → доказательство», чтобы решить, готов ли MVP к пилоту, не перечитывая все тикеты.
15. Как владелец продукта, я хочу видеть, какие пункты MVP закрыты частично и почему, чтобы решить: доделывать до пилота или отнести в «MVP, часть 2».
16. Как владелец продукта, я хочу тикет на пилот со списком подготовки и вопросами для фидбека, чтобы провести пилот и потом написать `docs/mvp-report.md`.
17. Как владелец продукта, я хочу, чтобы фидбек пилота проверял гипотезы, отложенные «до пилота» (холодный старт R1, строка «Есть ошибки типов: N», плашка «Starter обновлён»), чтобы решить их по данным.
18. Как разработчик `codda`, я хочу, чтобы `CLAUDE.md`, `docs/HOW-TO-PROCEED.md` и `docs/roadmap.md` говорили «MVP собран, идёт пилот», чтобы следующая сессия агента не начинала с PoC.
19. Как разработчик `codda`, я хочу, чтобы сквозной e2e курса шёл в CI на каждый PR, чтобы поломка любого Lesson или инструмента ловилась до выкладки на пилот.

## Implementation Decisions

- **Контент.** Ровно 5 Lesson React Hooks в одном Module. Новые Lesson не пишутся. Правки Lesson допустимы, только если без них курс не проходит `codda test`: формулировки Instructions, Starter без ошибок типов, Lesson Tests под импорт `./main`. Смысл заданий не меняется.
- **Starter без предупреждений.** `codda test` по курсу даёт 0 `✗` и 0 `⚠`: ошибки типов в Starter (`⚠` по тикету 05 Плана решений) для пилота тоже недопустимы. Starter переписывается так, чтобы компилироваться без ошибок типов, оставаясь недоделанным (≥1 FAIL у Lesson Tests).
- **CI.** Шаги `codda test` и `codda build` для каждого Course в `courses/` вводит `author-cli`, проверку типов в `codda test` — `ts-tooling`. Эта фича их не переделывает: она добивается, чтобы на React Hooks они были зелёными, и добавляет сквозной e2e в тот же job `check`.
- **Сквозной e2e** — новый сценарий в существующем наборе Playwright, с фикстурой offline. Идёт по выходу `codda build` для React Hooks, отданному из подпути, как на GitHub Pages (это тот `dist/`, что выкладывается). Если такого Playwright-проекта после `author-cli` нет, тикет добавляет его. Решения Lesson e2e берёт из `course.json` собранного курса, а не из исходников курса. Ввод — через редактор, как у студента. Нажимает «Запустить тесты», ждёт PASS, переходит «Следующий урок →».
- **Инструмент не дописывается под e2e.** Если e2e упирается в баг инструмента, баг чинится в тикете с регрессионным тестом на своём шве. Если для починки нужна новая функция или решение вне ADR — стоп по правилам [README.md](../README.md).
- **Таблица MVP** — раздел `## Итог` этой спеки: строка на каждый пункт «Определения MVP», составные пункты (например, «Run → Test Report; ошибки компиляции, runtime, timeout; console; …») разбиты по строке на свойство. Колонки: пункт · статус (сделано / частично / нет) · доказательство (имя теста или e2e-сценария, коммит, тикет) · примечание. Пункты, проверяемые только руками (UI на русском, «только Chrome»), проверяются вручную на собранном курсе, в доказательстве — «ручная проверка, дата».
- **Не сделанное не доделывается.** Пункт со статусом «нет» или «частично» уходит строкой в `docs/roadmap.md` (в «MVP, часть 2» или в новый список «До пилота», если без него пилот не провести) и в тикет пилота. Решение принимает человек.
- **README для Author** — README пакета `codda` (он поедет с пакетом при публикации, тикет `misc/04`). Корневой README описывает репозиторий: пилот, разработка `codda`, ссылка на README для Author. Всё, что README обещает Author, проверяется прогоном по шагам в пустой временной папке: `codda init` → `codda lesson` → `codda test` зелёный → `codda build`.
- **Документы стадии.** `CLAUDE.md`: «Текущая стадия — MVP собран, пилот на людях», ссылки на спеку этой фичи и тикет пилота. `docs/HOW-TO-PROCEED.md`: Шаг 3 отмечен ✅ со ссылками, строка 7 таблицы — «5 Lesson React Hooks» вместо «5–10»; новые шаги «Пилот» и «MVP Report». `docs/roadmap.md`: статус Phase 1–3 и MVP по факту таблицы.
- **Тикет пилота** создаётся сразу со статусом `ready-for-human`: агент его не исполняет. Фидбек собирается в файл фичи по шаблону из тикета.

## Testing Decisions

- Хороший тест здесь — внешнее поведение на самом высоком шве: CLI как процесс и браузер студента. Внутренности модулей фича не трогает.
- **Шов 1 — CLI как процесс в CI:** `CI=true npx codda test` и `npx codda build` по `courses/react-hooks`, код выхода `0`, в выводе 5 строк `✓` и ни одной `⚠`. Это существующие шаги CI из `author-cli`, новых тестов CLI не пишем.
- **Шов 2 — e2e Playwright по собранному курсу, offline.** Сценарии:
  - студент проходит все 5 Lesson подряд, итог «Пройдено 5 из 5», ни одного запроса за пределы localhost;
  - Starter без правок даёт FAIL, и Lesson не отмечается ✓ (граничный случай: прогресс не засчитывается за FAIL);
  - после перезагрузки страницы прогресс и Workspace на месте, открывается тот же Lesson;
  - у последнего Lesson после PASS нет перехода на несуществующий следующий (граничный случай конца курса).
- Каждый сценарий сначала увиден красным: например, против Starter вместо Solution или с неверным ожидаемым числом Lesson.
- **Prior art:** `e2e/golden-path.e2e.ts` (Run → PASS с вводом решения в редактор), фикстура `e2e/offline.ts` (блокировка внешней сети и проверка запросов), проекты `dev`/`pages` в `playwright.config.ts` (сборка из подпути `/codda/`); шаги `codda test`/`codda build` в CI из `author-cli`; e2e навигации и прогресса из `course-ux`.
- Документы тестами не покрываются; README для Author проверяется прогоном по шагам, результат — в `## Comments` тикета.

## Out of Scope

- Новый контент: Lesson сверх 5 React Hooks, второй Module, второй Course.
- Пилот на людях — делает человек по тикету `ready-for-human`.
- `docs/mvp-report.md` — после пилота.
- Доделка пунктов MVP, найденных несделанными: они фиксируются, решение — за человеком.
- Публикация пакета `codda` (`misc/04`), включение Pages и branch protection (человек).
- Всё из «MVP, часть 2» в `docs/roadmap.md`, включая security baseline и защиту от бесконечных циклов вне Chrome.
- Замеры производительности как в PoC Report: холодный старт R1 принят, поднимается по фидбеку пилота.

## Further Notes

- Фича начинается после всех тикетов фич 0–6 из [README.md](../README.md). До неё React Hooks уже в новом формате, CI уже гоняет `codda test` и `codda build`. Если какая-то из этих фич остановилась, тикет 01 тоже ждёт.
- Адрес пилота не меняется до конца пилота: прогресс в `localStorage` привязан к origin (тикет 06 Плана решений).
- Пилот только в Chrome: без защиты от бесконечных циклов Safari вешает вкладку (`map.md`, Notes).

## Итог

Сверка с «Определением MVP» из [docs/roadmap.md](../../../docs/roadmap.md) на 2026-10-05, ветка `mvp-autorun` (тикет [02](issues/02-mvp-checklist-and-docs.md)). Тесты названы как в коде: `файл` «имя теста». Хеши — коммиты тикетов, список — `git log main..mvp-autorun`. Ручные проверки сделаны на сборке `codda build courses/react-hooks` в Chromium (Playwright 1.63, 1280×800), как — в `## Comments` тикета 02.

**Итог: 20 сделано, 5 частично, 1 нет.** Частично и нет — строками в [docs/roadmap.md](../../../docs/roadmap.md) («До пилота», «MVP, часть 2») и в тикете [03](issues/03-pilot-on-people.md). Решение по ним — за человеком.

| # | Пункт | Статус | Доказательство | Примечание |
|---|---|---|---|---|
| 1 | Небольшой реальный Course: один Module, 5 Lesson React Hooks, React + TypeScript | сделано | `CI=true npx codda test courses/react-hooks` — 5 `✓`, 0 `⚠`, код `0`; шаг CI «codda test and codda build in every Course» (прогон 37250303075); `e2e/pilot.e2e.ts` «the student passes the 5 Lessons in a row…»; d44f589 | Повторено 2026-10-05 в тикете 02 |
| 2 | Внутренний пользователь проходит Course | частично | e2e `pilot.e2e.ts`: 5 Lesson подряд глазами студента, «Пройдено 5 из 5», перезагрузка сохраняет прогресс и Workspace | Люди курс не проходили — пилот, тикет 03 ✋ |
| 3 | Lesson — обычные файлы в Git: Instructions в Markdown, Lesson Manifest, Starter, Lesson Tests, Solution | сделано | `cli/build.test.ts` «`codda build courses/react-hooks` takes the five Lessons from the Course files», группа ошибок схемы («main.*, solution.* and lesson.test.*…», «errors in several files and Lessons, all in one run…»), «headings, lists, inline code…»; bfb8728, efac588, 16cd1fc | |
| 4 | Author проверяет Course одной командой CLI `codda` | сделано | `cli/test-command.test.ts` «every Lesson passes…», «broken Lessons: ✗ with the errors under it…», «type errors in Solution or Lesson Tests are errors (✗), in Starter warnings…»; `cli/init-lesson.test.ts` «init in an empty folder…»; f7af196, 650f1b1, f34a707; ручной прогон README для Author 2026-10-05 | |
| 5 | Инструмент отделён от контента, курс передаётся путём (ADR-0006) | сделано | `cli/boundary.test.ts` «the tool's code has no imports from outside the package» и `rootDir` пакета в `npm run typecheck`; `codda build/test/dev [путь]`; 1657bb0, d96ef07 | Пакет `codda` не опубликован: отдельный репозиторий курса подключает его только `file:`-путём (`misc/04`, нужен со вторым репозиторием курса) |
| 6 | Workspace из одного файла TS/TSX | сделано | `src/runtime/runner.test.ts` «main.ts and lesson.test.ts compile as TS, not TSX…», «main.tsx still compiles JSX»; `e2e/problems.e2e.ts` «from a main.tsx Lesson to a main.ts one and back…»; 50f352d | Multi-file — «MVP, часть 2» |
| 7 | npm-зависимости из `package.json` Course → Dependency Artifact, собранный `codda build` из внутреннего registry (ADR-0007) | частично | `cli/deps.test.ts` «builds deps/<hash>/ with an import map…», «a second build of the same Course takes the artifact from .codda/…»; `runner.test.ts` «React solution passes the Lesson Tests that import it as ./main»; 3c5249e, 139131d, a99217e, c8287d3, 54f25a5 | Внутренний registry не проверен — строка 26 |
| 8 | Run → Test Report | сделано | `runner.test.ts` «correct solution passes every test», «starter fails each test with expected and actual values»; `src/App.test.tsx` «FAIL: ✓/✗ per test…», «PASS: PASS · M / M…»; `e2e/golden-path.e2e.ts`; aacb5fa | |
| 9 | Ошибка компиляции со строкой в Workspace | сделано | `runner.test.ts` «syntax error is reported as a compile error with line and column»; `App.test.tsx` «a compile error in the Workspace is underlined…», «with Cyrillic before the error…»; 7f685c4 | |
| 10 | Runtime-ошибка | сделано | `runner.test.ts` «exception at the top level of the student's module is a runtime error», «an exception in a zero-delay timer fails the test it happened in…» (R8); `App.test.tsx` «an exception outside the tests shows «Ошибка выполнения»…»; f5c627d, 7f685c4 | Строка runtime-ошибки в файле студента — source maps, «MVP, часть 2». `Promise.reject` на верхнем уровне модуля валит первый тест («Отложенные проблемы») |
| 11 | Timeout | сделано | `runner.test.ts` «infinite loop times out after 5 s and the next Run works»; `App.test.tsx` «an infinite loop shows «Тесты не завершились за 5 с»…»; 5d28815 | Только в Chrome (Sandbox в отдельном процессе). Ложный timeout и повторы в CI бьют и по этому свойству — см. строку 14 |
| 12 | Console | сделано | `runner.test.ts` «console lines of the student's code reach onConsole…», «console.log in an infinite loop gives the first 1000 lines…»; `App.test.tsx` ««Console» between «Тесты» and «Решение»…»; c4ba76c | |
| 13 | Отмена Run | сделано | `runner.test.ts` «cancelling during the tests stops the Run before the deadline…», «cancelling during compilation stops the Run…»; `App.test.tsx` «during a Run «■ Отмена» stands in place of «▶ Запустить тесты»…»; 657a07c | |
| 14 | Восстановление после падения | частично | Падение Worker Compiler'а: `runner.test.ts` «esbuild.wasm that fails to load gives internal-error before the deadline; the next Run loads it anew and works», `e2e/compiler-failure.e2e.ts`; 5d28815 | Первый Run после Sandbox с бесконечным циклом иногда кончается ложным timeout («Отложенные проблемы», runtime-hardening/02, помечено «разобрать до пилота первой» — не разобрано). `App.test.tsx` «after a cancelled Run … gives PASS» — `test.skip`; в CI тесты идут с повторами (`retry: 2`, `retries: 2`) |
| 15 | Базовые подсказки TS: diagnostics | сделано | `e2e/type-checker.e2e.ts` «a type error is underlined, its message and code on hover; a fix removes it», «the Solution of React Hooks has no underline…»; `e2e/problems.e2e.ts` ««Проблемы»: the counter and the list match the underlines…»; 37ff279, afa9fb7 | |
| 16 | Базовые подсказки TS: autocomplete для React | сделано | `e2e/autocomplete.e2e.ts` «typing `useSta` lists useState as a function with its signature…», «Ctrl+Space opens the list without typing»; 5e0d516 | Без auto-import и hover — «MVP, часть 2» |
| 17 | Навигация по Lesson | сделано | `e2e/navigation.e2e.ts` «Следующий → , the Solution, PASS, «Следующий урок →»…», «the Course tree: a click on the third Lesson opens it…»; `pilot.e2e.ts`; d4ffeb4, e390b3b | |
| 18 | Reset | сделано | `App.test.tsx` ««↺ Сбросить» brings back the Starter and keeps the Test Report; ${undoModifier}+Z undoes it in one step»; `e2e/workspace.e2e.ts` «after «↺ Сбросить» a reload opens the Starter»; aacb5fa | |
| 19 | Показ Solution | сделано | `App.test.tsx` ««Показать решение» opens the read-only Solution on «Решение», the Workspace stays»; aacb5fa | |
| 20 | Прогресс сохраняется (локально) | сделано | `e2e/progress.e2e.ts` «PASS marks the Lesson: ✓ and «Пройдено 1 из 5»; Reset and a reload keep them…»; `pilot.e2e.ts` «after a reload the same Lesson is open, with the progress and the typed Workspace»; b76deb1 | Только `localStorage`, привязан к origin |
| 21 | Workspace сохраняется (локально) | сделано | `e2e/workspace.e2e.ts` «an edit stays after a reload», «an edit in a Lesson stays after «Следующий →» and «← Предыдущий»»; `App.test.tsx` «localStorage that throws on reading…»; 2a64d09 | |
| 22 | UI на русском | частично | Ручная проверка 2026-10-05: дерево, тулбар, вкладки «Тесты», «Проблемы», «Решение», Test Report, баннеры, сообщения об ошибках — по-русски | По-английски остались: заголовок «Instructions» (`App.tsx`) и текст `expected …, got …` Test Harness (`harness.ts`) — их спеки не задавали. По решению спек английскими остаются `PASS`/`FAIL`, вкладка «Console», сообщения esbuild и TS. Имена тестов React Hooks — контент курса |
| 23 | Пилот — только Chrome | сделано | Все браузерные тесты и e2e — в полном Chromium (`channel: "chromium"`); ручная проверка 2026-10-05 в Chromium; ограничение записано в корневом README и тикете 03 | Проверки шли в Chromium (`channel: "chromium"`), не в Google Chrome. Safari и Firefox не проверялись (по определению); защита от бесконечных циклов вне Chrome — «MVP, часть 2» |
| 24 | Пилот на внутренних пользователях | нет | Тикет [03](issues/03-pilot-on-people.md) `ready-for-human` | Делает человек после merge |
| 25 | Закрытый контур: браузер студента без внешних запросов (ADR-0002) | сделано | Фикстура `e2e/offline.ts` во всех e2e (любой запрос не на localhost — провал); `pilot.e2e.ts`; ручная проверка 2026-10-05: 14 запросов страницы при открытии, Run, вкладках и «Показать решение» — ни одного внешнего; `codda test` блокирует чужие origin'ы (`test-command.test.ts` «from a Lesson folder… a foreign request is its error») | Fire-and-forget `fetch` в конце Run `codda test` не ловит («Отложенные проблемы», author-cli review) |
| 26 | Закрытый контур: сборка курса и CI (внутренний registry, зеркало Chromium, внутренний хостинг) | частично | npm берёт registry из `.npmrc` курса; `PLAYWRIGHT_DOWNLOAD_HOST` — в подсказке `codda test` и README; GitLab-шаблон (`$CODDA_IMAGE`, S3) проверен разбором YAML: `cli/ci-templates.test.ts`; 24236ee | В контуре компании не запускалось: CI пилота — GitHub Actions с публичным npm и образом Playwright, внутреннего registry, зеркала и S3 в окружении нет |

**Вынесено из MVP решениями до прогона** (не строки таблицы): source maps (Q11, Q13), multi-file Workspace, security baseline (обязателен до серверного хранения и внешних пользователей), защита от бесконечных циклов в Safari/Firefox, холодный старт R1 — «MVP, часть 2» в [docs/roadmap.md](../../../docs/roadmap.md).

**Известные флейки на момент сверки** (все — «Отложенные проблемы» [README.md](../README.md)): ложный timeout после бесконечного цикла (строка 14); `npm test` без повторов под нагрузкой падает в 1–5 тестах `App.test.tsx`, `runner.test.ts`, `cli/test-command.test.ts`, `cli/init-lesson.test.ts` (с `CI=true` зелёный); e2e на `fill` иногда задваивают текст в редакторе (`course.e2e.ts`, `navigation.e2e.ts`, в CI — `1 flaky` в прогоне 37250303075). Один тест под `test.skip` — `App.test.tsx` «after a cancelled Run «▶ Запустить тесты» with the solution gives PASS».
