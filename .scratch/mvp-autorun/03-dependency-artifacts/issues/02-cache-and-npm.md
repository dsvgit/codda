# 02: Кэш артефакта по hash, правила npm и проверки `package.json`

**What to build:** Повторный `codda build` без изменений в `package-lock.json` и импортах не запускает ни npm, ни esbuild: артефакт берётся из `.codda/deps/<hash>/`. npm запускается по правилу тикета 05, уточнённому Q12 [раунда 2](../../questions/00-mvp-autorun.md): `npm ci` — только если `node_modules` нет или они расходятся с `package-lock.json`, одинаково в CI и локально. Ошибка `npm ci` показывается выводом npm с префиксом `npm ci:` и одной подсказкой. Диапазон версий, отсутствующий lockfile и Course без импортов пакетов обрабатываются по [спеке](../spec.md).

**Blocked by:** 01

**Status:** done

- [x] Сборка пишет во временную папку в `.codda/deps/` и переименовывает её в `<hash>/` только целиком; при наличии `.codda/deps/<hash>/` npm и esbuild не запускаются
- [x] Одна строка вывода: `Зависимости: deps/<hash> — собраны за N с` или `— из кэша`
- [x] Тест CLI: второй `codda build` той же фикстуры печатает «из кэша» и даёт тот же `<hash>` и побайтно те же файлы в выходе
- [x] Тест CLI: новый импорт пакета в одном Lesson меняет `<hash>` и пересобирает артефакт; правка Lesson без изменения импортов — нет
- [x] Тест CLI: брошенная временная папка от прерванной сборки не считается артефактом, следующий `codda build` собирает заново
- [x] npm не вызывается, если `node_modules/.package-lock.json` совпадает с `package-lock.json` по версиям пакетов; иначе или без `node_modules` — `npm ci` (при промахе кэша). При `CI=true` правило то же — тест
- [x] Успешный npm ничего не печатает
- [x] Тест CLI: `node_modules` нет, `package.json` и `package-lock.json` не согласованы — код `1`, строки вывода npm с префиксом `npm ci: `, затем строка «запустите `npm install` локально и закоммитьте `package-lock.json`»; артефакта нет
- [x] Тест CLI: версии `^19.3.0`, `~1.0.0`, `*`, `latest` в `dependencies` — по ошибке на каждый пакет с его именем, все сразу, код `1`; `1.0.0-beta.1` допустима; диапазон в `devDependencies` не ошибка и пакет из `devDependencies` в артефакт не попадает
- [x] Тест CLI: нет `package-lock.json` (или `package.json`) — ошибка с подсказкой «запустите `npm install`», код `1`
- [x] Тест CLI: Course без импортов пакетов — npm не запускается, папки `deps/` в выходе нет, `"deps": null` в `course.json`; Run такого Course проходит (Runner или e2e)

## Comments

- `npm run typecheck`, `npm test` (120 passed, 1 skipped — прежний skip `runtime-hardening/02`), `npm run test:e2e` (14 passed) зелёные локально; CI `check` подтвердит оркестратор после push.
- Сборщик `packages/codda/cli/dependency-artifact.ts`: порядок — точки входа → (их нет — `{ deps: null }`, без npm и без проверок `package.json`) → проверки `package.json`/`package-lock.json` → hash → `.codda/deps/<hash>/` есть — копия в выход, строка «из кэша» → иначе правило npm, esbuild во временную `.codda/deps/<hash>.tmp-XXXXXX/` (`mkdtemp`), `rename` в `<hash>/`, копия в выход. Ошибка esbuild удаляет временную папку. Результат — `{ deps, log }`; строку `Зависимости: …` печатает `codda build` (dev-сервер её не печатает). Время — `N.N с`.
- Правило npm: `npm ci`, если нет `node_modules/.package-lock.json` или множество «путь@версия» его `packages` (без корня `""`) не равно такому же из `package-lock.json`. От `CI` не зависит. Вывод npm перехватывается: успех молчит, ошибка — stdout+stderr npm построчно с префиксом `npm ci: `, затем подсказка. Проверено, что у `courses/react-hooks` и фикстуры Runner-тестов после настоящего `npm ci` множества совпадают.
- Проверки `package.json` идут только у Course с импортами пакетов: Course без пакетов не обязан иметь `package.json` (user story 17). Точная версия — `X.Y.Z` с необязательными prerelease и build.
- Тест ошибки `npm ci`: несогласованность `package.json`/`package-lock.json` npm 11 проверяет **через registry** (запрашивает packument), а не до него, как предполагает спека. Поэтому тест запускает `codda` с `npm_config_offline=true` (стандартная конфигурация npm): npm падает сразу с `ENOTCACHED`, без сети. Вывод и подсказка — те же, что у настоящей ошибки.
- Вызовы npm в тестах ловит поддельный `npm` первым в `PATH` (shell-скрипт пишет аргументы в лог и печатает «added 2 packages»); `npx` его не использует. Оба теста правила npm идут при `CI` не задан и `CI=true`.
- Course без импортов пакетов: тест CLI (npm не вызывается, `"deps": null`, нет `deps/`, нет строки «Зависимости»); Run такого Course покрыт существующим Runner-тестом «correct solution passes every test» (без `importMap`).
- `.codda/` добавлена в корневой `.gitignore` (курсы и фикстура).
- Тесты после кода (сразу зелёные): «новый импорт меняет hash» и «брошенная временная папка» — правило hash было в 01, кэш сделал их зелёными предыдущим шагом; «ошибка `npm ci`» — обработку ошибки я написал вместе с правилом npm; «диапазон в devDependencies не ошибка» и «Course без импортов» — поведение уже было. Красными видены: кэш и строка вывода, правило npm (вызов при расхождении), диапазоны версий, нет `package.json`/`package-lock.json`.
- На заметку (правило 7): optional-пакеты, которые npm не ставит на этой платформе, есть в `package-lock.json`, но не в `.package-lock.json` — такой Course будет запускать `npm ci` при каждом промахе кэша. Для пилота (React) не важно.
