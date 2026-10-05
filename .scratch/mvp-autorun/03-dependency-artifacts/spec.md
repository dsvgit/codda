# Spec: dependency-artifacts

**Status:** ready-for-agent — вопросы закрыты в [questions/00-grill.md](questions/00-grill.md), все рекомендации приняты; правило npm уточнено Q12 [раунда 2](../questions/00-mvp-autorun.md).

Решения: [ADR-0007](../../../docs/adr/0007-dependency-artifact-per-course.md) (уточняет [ADR-0005](../../../docs/adr/0005-prebuilt-dependency-artifacts.md)), [ADR-0008](../../../docs/adr/0008-prebuilt-tool-course-as-data.md), тикеты Плана решений [01](../../mvp/issues/01-dependency-artifacts.md), [08](../../mvp/issues/08-dependency-artifacts-adr.md), [05](../../mvp/issues/05-codda-cli-commands.md) (npm и `.codda/`), [06](../../mvp/issues/06-ci-and-pilot-hosting.md) (пропавший артефакт). Открытые вопросы — [questions/00-grill.md](questions/00-grill.md). Спека написана по рекомендациям из него.

## Problem Statement

Зависимости Lesson сейчас — PoC-артефакт: локальный скрипт один раз собрал `react`, `react/jsx-runtime` и `react-dom/client` в три файла и закоммитил их в репозиторий инструмента. Набор пакетов захардкожен в скрипте, единственный экземпляр React держится на самописном шиме, целостность файлов не проверяется. Минимальный `codda build` из фичи `lesson-manifest` просто копирует эти файлы в сборку.

Для Author это значит, что Course не может объявить ни одного своего пакета: `package.json` Course ни на что не влияет. Для инструмента это значит, что граница ADR-0006 нарушена: содержимое артефакта определяет инструмент, а не курс. Пилотный Course по React Hooks работает только потому, что ему случайно хватает трёх захардкоженных specifier'ов.

## Solution

`codda build` сам собирает Dependency Artifact Course по ADR-0007. Author объявляет пакеты в `package.json` Course (точные версии) и ведёт `package-lock.json` обычным `npm install`. Больше ничего делать не нужно.

1. **Точки входа.** `codda` находит все импорты пакетов в Starter, Solution и Lesson Tests всех Lesson Course. Это и есть набор specifier'ов, которые доступны студенту.
2. **Hash.** По `package-lock.json`, списку точек входа, версии esbuild, конфигу сборки и версии пайплайна `codda` считается hash. Если артефакт с этим hash уже лежит в `.codda/` Course, сборки нет.
3. **Сборка.** Иначе `npm ci` и **один** вызов esbuild на все точки входа (`esm`, `splitting`, `browser`, development). CJS-пакет получает ESM-обёртку: имена экспортов берутся через `require()` в Node, `export default` равен `module.exports`.
4. **Раскладка.** В выходе `codda build` лежит `deps/<hash>/`: файлы с content-hash в именах, `importmap.json` (стандартный import map: `imports` и `integrity` sha384 на каждый файл, включая chunk'и) и `types.json` (`.d.ts` для Type Checker; его потребитель — фича `ts-tooling`). `course.json` ссылается на эту папку.
5. **Run.** Compiler один раз скачивает файлы по `importmap.json`, браузер проверяет `integrity`, и на каждом Run Compiler вшивает их в бандл вместе с кодом студента, как в PoC. Импорт specifier'а вне точек входа — compile-error «импорт не предусмотрен заданием». Если артефакт пропал с хостинга (новая выкладка), Run говорит «Курс обновился, перезагрузите страницу».

Ошибки сборки артефакта понятны Author без чтения кода `codda`: диапазон версий, пакет не объявлен, импорт Node built-in, пакет падает при `require()`, ошибка `npm ci` (вывод npm как есть, с префиксом `npm ci:` и одной подсказкой).

PoC-скрипт сборки зависимостей и `public/deps/` удаляются.

## User Stories

1. As an Author, I want to declare a package in `package.json` of my Course with `npm install <pkg>`, so that Lesson can import it without changes to `codda`.
2. As an Author, I want `codda build` to build the Dependency Artifact itself, so that I don't run separate scripts or commit generated files.
3. As an Author, I want the entry points to be derived from imports in Starter, Solution and Lesson Tests, so that I don't maintain a second list of what students may import.
4. As an Author, I want a subpath like `react-dom/client` to become available just by importing it in a Lesson, so that subpaths need no declaration.
5. As an Author, I want a version range (`^19.3.0`) in `dependencies` to be an error naming the package, so that the Course stays reproducible.
6. As an Author, I want an import of a package missing from `dependencies` to be an error naming the Lesson, the file and the package, so that I see the mistake before students do.
7. As an Author, I want an `npm ci` failure to show npm's own output with the `npm ci:` prefix and one hint from `codda`, so that I recognise a familiar npm error and know what to do.
8. As an Author, I want a package that imports a Node built-in to fail the build with the package's name, so that I learn it doesn't work in the browser before a student does.
9. As an Author, I want a package that throws on `require()` in Node to fail the build with the package's name and the error, so that I know why `codda` can't wrap it.
10. As an Author, I want a CommonJS package to support both `import x from "pkg"` and `import { name } from "pkg"`, so that Lesson code reads like ordinary npm code (R9).
11. As an Author, I want React and React DOM to share one React instance in the artifact without shims, so that hooks and `act` work.
12. As an Author, I want the artifact to be a development build, so that `act` works in Lesson Tests (R5).
13. As an Author, I want a repeated `codda build` with unchanged lockfile and imports to skip `npm ci` and esbuild, so that the build is fast.
14. As an Author, I want `codda build` to print one line saying whether the artifact was built or taken from cache, so that I understand what happened.
15. As an Author, I want a local `codda build` not to reinstall `node_modules` when they already match `package-lock.json`, so that my editor setup isn't torn down on every build.
16. As an Author, I want `codda` to follow the same npm rule in CI and locally (run `npm ci` only when `node_modules` is missing or differs from `package-lock.json`), so that the CI workflow's own `npm ci` is not repeated under the running `codda` (Q12 раунда 2).
17. As an Author, I want a Course without any package imports to build without npm and without an artifact, so that a plain TypeScript Course has no extra steps.
18. As an Author, I want `@types/*` from `dependencies` to go only into `types.json`, so that they don't bloat the JS artifact.
19. As an Author, I want a warning naming the `@types` package to declare when a package ships no types, so that the Type Checker gets proper types.
20. As an Author, I want a package without any types to still build with a warning, so that an untyped but working package can be used (it becomes `any`).
21. As an Author, I want `devDependencies` of my Course to be ignored, so that my own tools (prettier etc.) don't land in the artifact.
22. As a student, I want Run to work with the Course's packages exactly as on the Author's machine, so that PASS means the same everywhere.
23. As a student, I want an import of a package the Lesson doesn't provide to give a compile error on that line saying the import isn't part of the task, so that I don't hunt for a non-existent install button.
24. As a student, I want Run after a redeploy of the Course to tell me «Курс обновился, перезагрузите страницу», so that I don't see a cryptic network error.
25. As a student, I want the artifact to be downloaded once per session, not on every Run, so that repeated Runs don't hit the network.
26. As a student, I want a corrupted or tampered dependency file to be rejected instead of executed, so that only the artifact built by CI runs in my Sandbox.
27. As a student, I want a transient load failure of dependencies to be retried on the next Run, so that one bad request doesn't break the session.
28. As the developer of `codda`, I want the Dependency Artifact format to be a standard HTML import map, so that the import-map transport of «MVP, часть 2» can use it unchanged.
29. As the developer of `codda`, I want the Type Checker (feature `ts-tooling`) to get all dependency types from one `types.json`, so that it needs no npm resolution in the browser.
30. As the developer of `codda`, I want the PoC dependency script and `public/deps/` removed, so that the tool contains no course-specific dependencies (ADR-0006).
31. As an operator, I want everything the browser loads for dependencies to come from our origin under a hash path, so that the closed contour holds (ADR-0002) and files can be cached forever.

## Implementation Decisions

**Модули**

- **Сборщик Dependency Artifact** (Node, часть CLI `codda`) — новый глубокий модуль. Вход: папка Course и исходники Starter, Solution и Lesson Tests всех Lesson (их уже читает загрузчик Course из `lesson-manifest`), папка кэша (`.codda/` Course), признак CI. Выход: либо `{ hash, папка с артефактом, предупреждения }`, либо «артефакта нет» (Course без импортов пакетов), либо список ошибок. Всё остальное — npm, esbuild, обёртки, hash, `types.json` — спрятано внутри.
- **`codda build`** (из `lesson-manifest`) вместо копирования PoC-артефакта вызывает сборщик, копирует `deps/<hash>/` в выход и пишет ссылку в `course.json`. Ошибки сборщика печатаются и дают код выхода `1`, как ошибки манифеста. Предупреждения печатаются, код не меняют.
- **Compiler (Worker)**: источник зависимостей — `importmap.json` артефакта вместо PoC-манифеста.
- **Страница** берёт ссылку на артефакт из `course.json`, разрешает её от адреса страницы (как сейчас адрес `deps/`, см. `misc/02`) и передаёт Compiler'у вместе с исходниками Run.

**Точки входа**

- Импорты собираются esbuild'ом (тот же разбор, что у Compiler, с `jsx: "automatic"`), а не регулярным выражением. Поэтому неявный `react/jsx-runtime` из TSX попадает в точки входа сам. `import type` не попадает.
- Точка входа — bare specifier. Не считаются: относительные импорты (`./main`), `@codda/test`.
- Имя пакета specifier'а (`react-dom/client` → `react-dom`, `@scope/pkg/sub` → `@scope/pkg`) должно быть в `dependencies` `package.json` Course. Иначе ошибка: Lesson, файл, specifier, «пакет не объявлен в dependencies package.json Course».
- Список точек входа отсортирован и без повторов: от него зависит hash.

**Проверки до сборки**

- Нет `package.json` или `package-lock.json` в корне Course — ошибка с подсказкой «запустите `npm install`».
- Версия в `dependencies` — не точная semver `X.Y.Z` (допускается prerelease) — ошибка с именем пакета, по одной на пакет, все сразу. `devDependencies` не читаются.

**Hash и кэш**

- `<hash>` — sha256 (первые 16 hex-символов) от: содержимого `package-lock.json`, списка точек входа, версии esbuild, конфига сборки (все опции esbuild, включая `mode`) и константы «версия пайплайна» в сборщике. Константа повышается вручную при любом изменении формата вывода.
- Кэш — `.codda/deps/<hash>/` в корне Course. Если папка есть, ни npm, ни esbuild не запускаются. Сборка идёт во временную папку рядом и переименовывается в `<hash>/` только целиком, поэтому прерванная сборка не оставляет «готового» артефакта. Старые папки не удаляются (это «MVP, часть 2», `.codda/` в `.gitignore`).
- Одна строка вывода: `Зависимости: deps/<hash> — собраны за N с` или `— из кэша`.

**npm** (правило тикета 05)

- npm запускается только при промахе кэша, и тогда — `npm ci`, только если нет `node_modules` или `node_modules/.package-lock.json` расходится с `package-lock.json` по версиям пакетов; иначе npm не запускается. Правило одно для CI и локально (Q12 раунда 2): в CI `node_modules` уже ставит шаг `npm ci` workflow, а устаревший `package-lock.json` ловит он же.
- Registry — из стандартной конфигурации npm (`.npmrc`), `codda` его не задаёт (ADR-0006).
- Успешный npm молчит. Ошибка: каждая строка вывода npm с префиксом `npm ci: `, затем одна строка `codda`: «запустите `npm install` локально и закоммитьте `package-lock.json`».

**Сборка JS**

- Один вызов esbuild на все точки входа: `format: "esm"`, `splitting: true`, `bundle: true`, `platform: "browser"`, `conditions: ["development"]`, `define` `process.env.NODE_ENV = "development"`, имена файлов `[name]-[hash]`, chunk'и `chunk-[hash]`. `@types/*` в JS-сборку не входят.
- ESM-модуль точки входа собирается как есть. CJS-модуль получает обёртку-точку входа: именованные экспорты — ключи `require(specifier)` в Node (из папки Course), кроме `default`; `export default` — `module.exports` (R9, ADR-0007). Шимов вида `react-as-esm` нет: один экземпляр каждого модуля даёт `splitting`.
- Импорт Node built-in внутри пакета (esbuild не может разрешить `fs`, `node:path` и т. п. для `platform: "browser"`) — ошибка: «пакет `<имя>` импортирует встроенный модуль Node `<модуль>` и не работает в браузере». Имя пакета берётся из пути импортирующего файла в `node_modules`.
- `require()` пакета падает в Node — ошибка: «пакет `<имя>` падает при загрузке в Node (`require`): `<сообщение>`; `codda` берёт из него имена экспортов».
- Прочие ошибки esbuild выводятся как есть, с файлом и specifier'ом.

**Формат `deps/<hash>/`**

- Файлы JS с content-hash в именах.
- `importmap.json` строго по спецификации HTML: `{ "imports": { specifier: адрес }, "integrity": { адрес: "sha384-…" } }`. Адреса — `./deps/<hash>/<файл>`, относительно корня сборки (страницы), поэтому в «MVP, часть 2» файл вставляется в `srcdoc` как есть (Q1). `integrity` есть у каждого JS-файла папки, включая chunk'и.
- `types.json` — плоский объект «виртуальный путь → содержимое», пути вида `/node_modules/<пакет>/…`, чтобы `moduleResolution: "bundler"` в Type Checker находил их без `paths` ([research](../../../docs/research/ts-language-service.md), §5). Внутри: `package.json` и все `.d.ts`/`.d.mts`/`.d.cts` каждого пакета из `dependencies` (и `@types/*`) и их транзитивных `dependencies`/`peerDependencies`, у которых есть типы. JS-файлов нет.
- У пакета нет своих типов, а `@types/<имя>` не объявлен — предупреждение: «у пакета `<имя>` нет типов: объявите `@types/<имя>` в dependencies, если он есть, иначе в редакторе он будет `any`». В `types.json` для каждой его точки входа кладётся заглушка `/node_modules/@types/<имя>/<subpath>.d.ts`, которая делает модуль `any`. TS находит её обычным поиском `@types`, `ts-tooling` ничего особого не делает (Q4).

**`course.json`**

- Новое поле `deps`: путь к папке артефакта относительно корня сборки (`"deps/<hash>/"`) или `null`, если артефакта нет. Остальной формат `course.json` — из `lesson-manifest`. `ts-tooling` берёт `types.json` из той же папки.

**Compiler**

- Получает адрес `importmap.json` (или «артефакта нет») с каждым compile. Скачивает `importmap.json`, затем все файлы из его `integrity` через `fetch(адрес, { integrity })`: проверку делает браузер. Держит файлы в памяти Worker'а, пока он жив, и при следующих Run их не скачивает. Скачивание — при первом Run, который импортирует пакет (как в PoC, R1 принят).
- Bare specifier из `imports` разрешается в файл артефакта; относительный импорт внутри файла артефакта (chunk'и) — в файл той же папки. Specifier, которого нет в `imports` (или артефакта нет вовсе), — compile-error на строке импорта: «Импорт "`<specifier>`" не предусмотрен заданием».
- HTTP 404 на `importmap.json` или любой файл — compile-error без строки: «Курс обновился, перезагрузите страницу» (тикет 06: старые `deps/<hash>/` при выкладке не хранятся). Любая другая ошибка загрузки (сеть, `integrity`) — compile-error «Не удалось загрузить зависимости курса: `<причина>`». В обоих случаях код студента не исполняется, а следующий Run загружает заново (Q2).

**Удаляется**: PoC-скрипт сборки зависимостей, npm-скрипт `build:deps`, `public/deps/`, копирование PoC-артефакта в `codda build`, PoC-манифест «specifier → файл».

**Пилотный Course** React Hooks получает `package.json` (`react`, `react-dom`, `@types/react`, `@types/react-dom` с точными версиями 19.3.x, как сейчас в PoC) и `package-lock.json`, если `lesson-manifest` их ещё не добавила.

## Testing Decisions

Хороший тест проверяет внешнее поведение на самом высоком шве: что `codda build` положил на диск и вывел, что Run вернул в Test Report. Внутренние функции сборщика (разбор импортов, обёртка, hash) отдельно не тестируются. Ошибки и граничные случаи тестируются в своём тикете (правило MVP).

Швы:

1. **CLI как процесс: `codda build <курс-фикстура>`** — основной шов сборщика. Проверяем код выхода, вывод (ошибки, предупреждения, строку «собраны / из кэша»), содержимое `deps/<hash>/` и поле `deps` в `course.json`. Prior art — тест каркаса CLI из `misc/03` (`npx codda --version` / `--bogus` как процесс) и тесты `codda build` из `lesson-manifest`.
   - **Фикстуры без сети.** Тест пишет во временную папку Course (`course.yaml`, Lesson), `package.json`, `package-lock.json` и готовые `node_modules` с поддельными пакетами (CJS, ESM, импорт `fs`, падающий `require`, без типов), включая `node_modules/.package-lock.json`. `node_modules` совпадают с `package-lock.json`, поэтому npm не вызывается, в том числе при `CI=true` в GitHub Actions (Q12 раунда 2). Так проверяются все ветки сборки быстро и без registry.
   - **Ветки npm.** Ошибка `npm ci` воспроизводится без сети: `node_modules` нет, `package.json` и `package-lock.json` не согласованы — npm падает до обращения к registry.
2. **Runner (Vitest browser mode)** — шов Compiler и загрузки артефакта. Prior art — `runner.test.ts` (React Counter, Runner-тесты на `add`). Global setup тестов собирает артефакт курса-фикстуры с настоящими `react`/`react-dom` тем же сборщиком (кэш по hash в `.codda/` фикстуры, повторный прогон — без npm), dev-сервер тестов раздаёт его. Негативные случаи (404, подменённый файл, specifier вне точек входа) — копией артефакта во временной папке, которую раздаёт тот же сервер.
3. **e2e (Playwright)** — Golden Path и офлайн-проверка на выходе `codda build`, как их оставит `lesson-manifest`. Prior art — `golden-path.e2e.ts`, `offline.ts` (все запросы на наш origin; список запросов теперь включает `importmap.json` и файлы `deps/<hash>/`).

Сеть: global setup Runner-тестов и `codda build` пилотного Course в CI выполняют `npm ci` из registry по умолчанию (Q3). Браузер в сеть не ходит, ADR-0002 это не нарушает: в сеть ходит сборка.

## Out of Scope

- Проверки `codda test` (Chromium, блокировка чужих origin, Solution PASS / Starter FAIL) — фича `author-cli`. Проверка типов по `types.json` в `codda test` и чтение `types.json` в браузере — `ts-tooling`.
- `codda build` целиком (маркер `.codda-build`, «при ошибке ничего не пишет», устаревший `dist-tool/`) и пересборка артефакта в `codda dev` — `author-cli`.
- Import map в Sandbox, эксперимент 07, быстрый Run (R4), статический лексер CJS-экспортов, CSS из пакетов, зависимости на уровне Lesson — «MVP, часть 2».
- Кэш CI и отдельное хранилище артефактов (тикет 06), очистка старых папок в `.codda/deps/`.
- Статический скан на `process`/`Buffer`, production-сборка.
- Прогрев загрузки артефакта до первого Run.

## Further Notes

- Транспорт как в PoC не требует CORS ни на хостинге, ни в `codda dev` (ADR-0007).
- Одна версия каждого пакета на Course — ограничение ADR-0007.
- Версия esbuild в hash — native `esbuild` CLI. Compiler в браузере — `esbuild-wasm` той же версии (сейчас 0.28.2 у обоих); расхождение версий в `package.json` инструмента стоит держать нулевым, но проверка этого — не в этой фиче.
- Где лежит вывод `codda build` для `npm run dev` и e2e, решает `lesson-manifest`; эта фича меняет только то, что попадает в `deps/`.
