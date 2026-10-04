# 04: Проверка типов в `codda test`

**What to build:** Author запускает `codda test`, и для каждого Lesson тем же ядром, TS 6 и модулем конфига, что у Type Checker, проверяются типы (договорённость 5 в `autorun.md`, Q9 тикета 05 Плана). Ошибка типов в Solution или Lesson Tests — ошибка Lesson: `✗`, код выхода `1`. Ошибка типов в Starter — предупреждение: `⚠`, код выхода не меняется. Строка ошибки: `<путь от корня Course>:<строка>:<колонка> — <сообщение> (TS<код>)` под строкой Lesson. Lesson Tests видят `@codda/test` через объявление, которое несёт инструмент. Подробности — «Проверка типов в `codda test`» и «Объявление `@codda/test`» в [spec.md](../spec.md).

**Blocked by:** 01; фича `author-cli` (`codda test` полностью, тесты CLI как процесса)

**Status:** ready-for-agent

- [ ] Проверка типов идёт в Node после сборки Dependency Artifact, через то же ядро и модуль конфига, что Type Checker. lib-файлы читаются из пакета `typescript-6`, типы — из `types.json` только что собранного артефакта
- [ ] Solution проверяется под именем Starter (`main.*`) вместе с Lesson Tests и объявлением `@codda/test`. В выводе путь — настоящий файл (`<lesson>/solution.tsx`, `<lesson>/lesson.test.tsx`)
- [ ] Starter проверяется один, как в редакторе студента (Q1 в [questions/00-grill.md](../questions/00-grill.md))
- [ ] Объявление `@codda/test` (`test`, `expect` с `toBe` и `toEqual`, плюс то, что добавит `runtime-hardening`). `npm run typecheck` падает, если Test Harness и объявление расходятся
- [ ] Тест CLI: ошибка типов в Solution → `✗`, строка `<lesson>/solution.tsx:L:C — … (TSxxxx)`, код `1`
- [ ] Тест CLI: ошибка типов в Lesson Tests → `✗`, путь `<lesson>/lesson.test.tsx`, код `1`
- [ ] Тест CLI: ошибка типов только в Starter → `⚠`, строка с путём `<lesson>/main.tsx`, код `0`
- [ ] Тест CLI: ошибки типов и ошибки Run одного Lesson выводятся за один прогон. Run из-за ошибок типов не пропускается. Если Solution не прошёл Lesson Tests, предупреждения типов Starter всё равно выводятся
- [ ] Тест CLI: Lesson с ошибкой манифеста по типам не проверяется
- [ ] Предупреждения типов Starter входят в итог `N из M Lesson прошли, K предупреждений`. Ошибки типов идут в вердикт Lesson из `author-cli`, отдельного формата вывода нет
- [ ] Тест CLI: неиспользуемая переменная в Starter не даёт предупреждения (только ошибки, без `noUnused*`)
- [ ] Тест CLI: `codda test <папка Lesson>` проверяет типы только этого Lesson
- [ ] Тест CLI: пакет без типов (заглушка в `/node_modules/@types/<имя>/` из `types.json`, фича `dependency-artifacts`) даёт `any`, а не ошибку типов
- [ ] Тест CLI: если Dependency Artifact не собрался, проверка типов не запускается и ошибок типов в выводе нет
- [ ] Lesson из `codda init` и `codda lesson` (`.ts` и `--tsx`) проходят `codda test` без `⚠`
- [ ] `codda dev` и `codda build` типы не проверяют. Служебная страница `codda test` Type Checker не запускает
- [ ] CI репозитория: `codda test` по `courses/react-hooks` зелёный с проверкой типов

## Comments
