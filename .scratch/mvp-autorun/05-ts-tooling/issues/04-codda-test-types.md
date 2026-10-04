# 04: Проверка типов в `codda test`

**What to build:** Author запускает `codda test`, и для каждого Lesson тем же ядром, TS 6 и модулем конфига, что у Type Checker, проверяются типы (договорённость 5 в `README.md`, Q9 тикета 05 Плана). Ошибка типов в Solution или Lesson Tests — ошибка Lesson: `✗`, код выхода `1`. Ошибка типов в Starter — предупреждение: `⚠`, код выхода не меняется. Строка ошибки: `<путь от корня Course>:<строка>:<колонка> — <сообщение> (TS<код>)` под строкой Lesson. Lesson Tests видят `@codda/test` через объявление, которое несёт инструмент. Подробности — «Проверка типов в `codda test`» и «Объявление `@codda/test`» в [spec.md](../spec.md).

**Blocked by:** 01; фича `author-cli` (`codda test` полностью, тесты CLI как процесса)

**Status:** done

- [x] Проверка типов идёт в Node после сборки Dependency Artifact, через то же ядро и модуль конфига, что Type Checker. lib-файлы читаются из пакета `typescript-6`, типы — из `types.json` только что собранного артефакта
- [x] Solution проверяется под именем Starter (`main.*`) вместе с Lesson Tests и объявлением `@codda/test`. В выводе путь — настоящий файл (`<lesson>/solution.tsx`, `<lesson>/lesson.test.tsx`)
- [x] Starter проверяется один, как в редакторе студента (Q1 в [questions/00-grill.md](../questions/00-grill.md))
- [x] Объявление `@codda/test` (`test`, `expect` с `toBe` и `toEqual` — публичный API Test Harness). `npm run typecheck` падает, если Test Harness и объявление расходятся
- [x] Тест CLI: ошибка типов в Solution → `✗`, строка `<lesson>/solution.tsx:L:C — … (TSxxxx)`, код `1`
- [x] Тест CLI: ошибка типов в Lesson Tests → `✗`, путь `<lesson>/lesson.test.tsx`, код `1`
- [x] Тест CLI: ошибка типов только в Starter → `⚠`, строка с путём `<lesson>/main.tsx`, код `0`
- [x] Тест CLI: ошибки типов и ошибки Run одного Lesson выводятся за один прогон. Run из-за ошибок типов не пропускается. Если Solution не прошёл Lesson Tests, предупреждения типов Starter всё равно выводятся
- [x] Тест CLI: Lesson с ошибкой манифеста по типам не проверяется
- [x] Предупреждения типов Starter входят в итог `N из M Lesson прошли, K предупреждений`. Ошибки типов идут в вердикт Lesson из `author-cli`, отдельного формата вывода нет
- [x] Тест CLI: неиспользуемая переменная в Starter не даёт предупреждения (только ошибки, без `noUnused*`)
- [x] Тест CLI: `codda test <папка Lesson>` проверяет типы только этого Lesson
- [x] Тест CLI: пакет без типов (заглушка в `/node_modules/@types/<имя>/` из `types.json`, фича `dependency-artifacts`) даёт `any`, а не ошибку типов
- [x] Тест CLI: если Dependency Artifact не собрался, проверка типов не запускается и ошибок типов в выводе нет
- [x] Lesson из `codda init` и `codda lesson` (`.ts` и `--tsx`) проходят `codda test` без `⚠`
- [x] `codda dev` и `codda build` типы не проверяют. Служебная страница `codda test` Type Checker не запускает
- [x] CI репозитория: `codda test` по `courses/react-hooks` зелёный с проверкой типов

## Comments

- Проверка — `packages/codda/cli/type-check.ts` (`lessonTypeChecker(types)` → функция Lesson → `{ errors, warnings }`): ядро `src/type-checker/core.ts` с `ts` из `typescript-6`, lib-файлы — `tsLibFiles()` (`cli/ts-lib.ts`, тот же список, что у UI), типы — `types.json` из `.codda/test/deps/<hash>/` после сборки артефакта (`{}` при `deps: null`). Отдельный модуль, а не код в `codda.ts` (558 строк, пять команд) — чтобы не раздувать его дальше.
- Два окружения на весь прогон, а не по паре на Lesson: lib разбираются один раз. В окружении Solution — Solution под именем Starter, Lesson Tests и `/node_modules/@codda/test/index.d.ts`; в окружении Starter — только Starter, `@codda/test` он не видит. Для набора файлов в ядро добавлен `setFiles(files)` (файлы прежнего набора удаляются), `setFile` стал его частным случаем; unit-тест ядра — смена набора `main.ts`+`lesson.test.ts` → `main.tsx`+`lesson.test.tsx`.
- Типы проверяются в цикле Lesson после Run, при любом исходе Run; Lesson с ошибкой манифеста не проверяется. Ошибки типов идут после ошибок Run, предупреждения Starter — в `warnings` `LessonResult` (`report.ts` уже печатал их и считал в итоге). Если артефакт не собрался, `codda test` выходит раньше — проверки нет.
- Многострочная цепочка сообщения TS в выводе склеивается в одну строку через пробел (части без отступа) — формат строки `путь:строка:колонка — сообщение (TSxxxx)` не ломается.
- Объявление `@codda/test` — `src/runtime/codda-test.d.ts` (`test`, `expect` с `toBe`/`toEqual`), CLI читает его как текст. Сверку с Test Harness делает `src/runtime/codda-test.check.ts`: присваивание в обе стороны между объявлением и `Pick<typeof harness, "test" | "expect">`. Проверено руками: лишний `toContain` в объявлении и пропавший `toEqual` — оба дают TS2322 в `npm run typecheck`.
- `codda dev`/`codda build` проверку не вызывают (она только в `test()`); служебная страница `#/__codda-test` не рендерит `App`, а Type Checker стартует только из linter'а редактора Workspace — отдельного теста на это нет.
- Существующие тесты `codda test`: у `broken` (синтаксическая ошибка в Starter) появилось предупреждение `TS1109` под ошибкой компиляции; в фикстуры «Dependency Artifact не собрался» и «один Lesson» добавлены ошибки типов, которых не должно быть в выводе. Тест «пакет без типов» до реализации был зелёным (проверки ещё не было); проверено, что без `types.json` он падает с TS2307.
- Lesson из `codda init` и `codda lesson` (`.ts` и `--tsx`) — существующие тесты `init-lesson.test.ts` ждут ровно `✓` без `⚠`, зелёные. `npx codda test` по `courses/react-hooks` — 5 из 5 ✓, код 0.
- Проверки: `npm run typecheck` зелёный; `npm test` — 224 passed, 1 skipped (локально без повторов падал известный флейк «чужой запрос не пойман», с `CI=true` зелёный); `npm run test:e2e` — 43 passed.
