# 03: Понятные ошибки сборки: пакет не объявлен, Node built-in, падение `require()`

**What to build:** Ошибки, из-за которых артефакт нельзя собрать, называют Lesson, файл и пакет, а не показывают стек esbuild или Node. Импорт пакета, которого нет в `dependencies`; пакет, импортирующий встроенный модуль Node; CJS-пакет, падающий при `require()` в Node. Тексты — в [спеке](../spec.md).

**Blocked by:** 01

**Status:** done

- [x] Тест CLI: Lesson импортирует пакет, которого нет в `dependencies` (в т. ч. `node:fs` и subpath необъявленного пакета) — ошибка с id Lesson, файлом, specifier'ом и текстом «пакет не объявлен в dependencies package.json Course», код `1`
- [x] Тест CLI: два таких импорта в разных Lesson — обе ошибки сразу
- [x] Тест CLI: пакет (в т. ч. транзитивная зависимость), который импортирует `fs` или `node:path`, — ошибка «пакет `<имя>` импортирует встроенный модуль Node `<модуль>` и не работает в браузере», имя — пакета, где импорт, а не точки входа; работает и для scoped-пакета
- [x] Тест CLI: CJS-пакет, бросающий исключение при `require()` (например, обращается к `window`), — ошибка «пакет `<имя>` падает при загрузке в Node (`require`): `<сообщение>`…», код `1`
- [x] Тест CLI: subpath, которого нет в `exports` пакета, — ошибка esbuild с файлом Lesson и specifier'ом, код `1`
- [x] Ни при одной из этих ошибок папка артефакта в `.codda/deps/` не появляется

## Comments

- `npm run typecheck`, `npm test` (125 passed, 1 skipped — прежний skip `runtime-hardening/02`), `npm run test:e2e` (14 passed) зелёные локально; CI `check` подтвердит оркестратор после push.
- Все тесты — `packages/codda/cli/deps.test.ts`, CLI как процесс на фикстуре с готовыми `node_modules` (npm не вызывается). Хелпер `addPackages` дописывает пакет в `dependencies`, `package-lock.json` и `node_modules/.package-lock.json`; `expectNoArtifact` проверяет, что нет ни `deps/` в выходе, ни папки в `.codda/deps/`.
- Пакет не объявлен: сканер точек входа теперь помнит, какие файлы (`<lesson>/<файл>`) импортируют каждый specifier. Проверка идёт вместе с проверкой диапазонов версий (после проверки наличия `package.json`/`package-lock.json`), до hash, npm и esbuild — поэтому артефакта нет. Строка: `greet/main.ts: импорт "left-pad": пакет не объявлен в dependencies package.json Course`, по строке на файл, отсортированы. `node:fs` и `fs` в Lesson — тоже «не объявлен» (имя пакета `node:fs`). Номера строки нет: сканер его не видит, критерием не требуется.
- Node built-in: ошибка esbuild `Could not resolve "<x>"`, где `<x>` — `isBuiltin` Node, а файл ошибки лежит в `node_modules`, переводится в текст спеки; имя пакета — последний `node_modules/<имя>` (или `@scope/имя`) в пути файла, поэтому называется транзитивная зависимость, а не точка входа. Пакеты с `"browser": { "fs": false }` не задеты: перевод — после разрешения esbuild, а не вместо него.
- Падение `require()`: обработчик `onLoad` обёртки ловит исключение и возвращает ошибку **без `location`** — иначе esbuild берёт место из стека и печатает путь внутри `esbuild/lib/main.js`.
- Subpath вне `exports`: ошибка `build.resolve` точки входа печатается на каждом файле Lesson, который её импортирует: `count/solution.ts: импорт "esm-pkg/extra": Could not resolve "esm-pkg/extra"`. Примечание esbuild «is not exported by package» `build.resolve` из плагина не даёт (только совет «mark as external»), поэтому заметки не печатаются; критерий — «ошибка esbuild с файлом Lesson и specifier'ом» — выполнен, мой первый вариант теста был строже и ослаблен до него.
- Тесты после кода: «два импорта в разных Lesson» — поведение уже дал код первого теста, тест сразу зелёный. Остальные (не объявлен, Node built-in, `require`, subpath) видены красными.
