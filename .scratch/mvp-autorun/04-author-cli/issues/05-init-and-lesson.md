# 05: `codda init` и `codda lesson` — новый Course и новый Lesson из шаблонов

**What to build:** Author создаёт новый Course командой `npx codda init [путь]` в пустой папке, без вопросов. Новый Lesson он добавляет командой `npx codda lesson <id> [--module <title>] [--tsx]`. `course.yaml` при этом правится с сохранением комментариев. Свежий Course и свежий Lesson сразу проходят `codda test`. Спека — «Шаблоны», «`codda init`», «`codda lesson`».

**Blocked by:** 03

**Status:** done

- [x] Шаблоны Course и Lesson (`ts`, `tsx`) лежат в пакете `codda` рядом с CLI и копируются с подстановкой `id` и `title`
- [x] `codda init [путь]`: только в пустой папке (разрешена `.git`), иначе ошибка и код `2` без изменений. Папка создаётся, если её нет. `id` = имя папки, не kebab-case — ошибка с подсказкой и код `2`. `title` = `id`
- [x] `init` создаёт `course.yaml` (Module «Основы», Lesson `hello`), `package.json` (`private`, пустые `dependencies`), `.npmrc` (`save-exact=true`), `.gitignore` (`node_modules/`, `.codda/`, `dist/`) и `hello/` из шаблона `.ts`
- [x] `init` добавляет `codda` в `devDependencies`: `file:<относительный путь до пакета>`, если пакет запущен не из `node_modules`, иначе версию `codda`. Затем выполняет `npm install`. Печатает созданные файлы и подсказку: `npm install react react-dom @types/react @types/react-dom` для React и `npx codda test`
- [x] `codda lesson <id>`: создаёт `<id>/lesson.md` (`title: <id>`, подсказка в теле), `main.ts`, `solution.ts`, `lesson.test.ts`. Дописывает `id` в `lessons` последнего Module или Module с точным `title` из `--module`. `course.yaml` правится через `yaml` `parseDocument`, комментарии и порядок ключей сохраняются
- [x] `--tsx`: шаблон компонента (`main.tsx`, `solution.tsx`, `lesson.test.tsx`; `react`, `react-dom/client`, `act`). Если `react` или `react-dom` нет в `dependencies`, выводится ошибка с командой `npm install …` и код `1`
- [x] Ошибки `lesson` (код `1`, ничего не создано и не изменено): папка уже есть, id уже в `course.yaml`, id не kebab-case, неизвестный Module. Вне курса — код `2`
- [x] `codda init --help`, `codda lesson --help` по-русски
- [x] Тесты (CLI процессом): `init` в пустой временной папке, затем `npx codda test` в ней — код `0`, `✓ hello`; `init` в непустой папке и в папке с не-kebab-case именем; `lesson` дописывает в последний Module и в `--module`, комментарий в `course.yaml` до и после правки на месте, затем `codda test` — код `0`; `lesson` на каждую ошибку из списка выше; `--tsx` без React — ошибка
- [x] Шаблон `--tsx` проходит `codda test` в курсе с React: тест добавляет Lesson `--tsx` во временную копию `courses/react-hooks` и проверяет только его (`codda test <папка Lesson>`)
- [x] `npm run typecheck`, `npm test`, `npm run test:e2e` зелёные

## Comments

- **Шаблоны** — `packages/codda/templates/`: `course/` (`course.yaml`, `package.json`, `npmrc`, `gitignore`), `lesson-ts/`, `lesson-tsx/`. Подстановка — `{{id}}` и `{{title}}` во всех файлах (`copyTemplate` в `cli/codda.ts`). `npmrc`/`gitignore` хранятся без точки и при копировании становятся `.npmrc`/`.gitignore`: npm никогда не публикует собственные `.npmrc` и `.gitignore` пакета. `templates/` исключена из скана `boundary.test.ts` (файлы Course, как `fixtures/`: `lesson.test.ts` импортирует `@codda/test`); в `typecheck` и в проекты Vitest шаблоны не попадают.
- **Подсказка в теле `lesson.md`** — цитата Markdown (`> Шаблон урока: замените … Проверить урок — npx codda test <id>`), а не HTML-комментарий: raw HTML в Instructions экранируется и был бы виден текстом.
- **Шаблон `.ts`** — `sum(a, b)`, Starter возвращает `0`, два теста (`sum(2, 3)` и `sum(0, 0)`): Starter проваливает первый. **Шаблон `.tsx`** — мини-Spoiler: кнопка «Show», по клику `<p>Секрет</p>`, два теста на `act` + `createRoot`.
- **`init`**: `id` = `basename` пути; подсказка для не-kebab-case — имя в нижнем регистре с `-` вместо прочих символов (иначе `my-course`). `devDependencies.codda` — `file:<относительный путь от realpath папки курса>`, если в пути пакета нет сегмента `node_modules`, иначе `pkg.version`. `npm install --no-audit --no-fund`; его сбой — вывод npm в stderr и код `2`, созданные файлы остаются (в спеке не задано). Ветка «запущен из `node_modules`» тестом не покрыта — пакет ещё не публикуется.
- **`lesson`**: работает от текущей папки (`findCourse(".")`, из папки Lesson тоже — урок создаётся в корне Course). Порядок проверок: kebab-case → `course.yaml` читается → id уже в `course.yaml` → папка есть → Module → `--tsx` без `react`/`react-dom`. Ошибки — `codda: <сообщение>` в stderr без «справки», код `1`; без id и вне курса — код `2`. Сломанный YAML и Module без `lessons` — тоже код `1` (без тестов, вне критериев). `course.yaml` пишется `doc.toString({ flowCollectionPadding: false })`, чтобы `[sum]` не становился `[ sum ]`.
- **Флаги** `--module` и `--tsx` принадлежат только `lesson` (`COMMAND_OF`); справка — общая, как у остальных команд (`codda init --help` = `codda lesson --help` = `codda --help`).
- **Тест `--tsx` в React Hooks** копирует `courses/react-hooks` во временную папку вместе с `node_modules` (`cpSync` делает относительную ссылку `codda` абсолютной), поэтому шаг npm не нужен; проверяется только `codda test spoiler`.
- **Тесты после кода (честно):** красными увидены `init` в пустой папке, `lesson` в последний Module и `--module` (по шагам), ошибки `lesson` (5 случаев). Написаны после кода и сразу зелёные: ошибки `init` (непустая папка, не kebab-case) — проверки сделаны вместе с happy path; `lesson` вне курса; `--tsx` в копии React Hooks (шаблон сделан до теста); справка `init`/`lesson` и «`--tsx` только у `lesson`» в `cli/codda.test.ts`.

