# 05: `codda init` и `codda lesson` — новый Course и новый Lesson из шаблонов

**What to build:** Author создаёт новый Course командой `npx codda init [путь]` в пустой папке, без вопросов. Новый Lesson он добавляет командой `npx codda lesson <id> [--module <title>] [--tsx]`. `course.yaml` при этом правится с сохранением комментариев. Свежий Course и свежий Lesson сразу проходят `codda test`. Спека — «Шаблоны», «`codda init`», «`codda lesson`».

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Шаблоны Course и Lesson (`ts`, `tsx`) лежат в пакете `codda` рядом с CLI и копируются с подстановкой `id` и `title`
- [ ] `codda init [путь]`: только в пустой папке (разрешена `.git`), иначе ошибка и код `2` без изменений. Папка создаётся, если её нет. `id` = имя папки, не kebab-case — ошибка с подсказкой и код `2`. `title` = `id`
- [ ] `init` создаёт `course.yaml` (Module «Основы», Lesson `hello`), `package.json` (`private`, пустые `dependencies`), `.npmrc` (`save-exact=true`), `.gitignore` (`node_modules/`, `.codda/`, `dist/`) и `hello/` из шаблона `.ts`
- [ ] `init` добавляет `codda` в `devDependencies`: `file:<относительный путь до пакета>`, если пакет запущен не из `node_modules`, иначе версию `codda`. Затем выполняет `npm install`. Печатает созданные файлы и подсказку: `npm install react react-dom @types/react @types/react-dom` для React и `npx codda test`
- [ ] `codda lesson <id>`: создаёт `<id>/lesson.md` (`title: <id>`, подсказка в теле), `main.ts`, `solution.ts`, `lesson.test.ts`. Дописывает `id` в `lessons` последнего Module или Module с точным `title` из `--module`. `course.yaml` правится через `yaml` `parseDocument`, комментарии и порядок ключей сохраняются
- [ ] `--tsx`: шаблон компонента (`main.tsx`, `solution.tsx`, `lesson.test.tsx`; `react`, `react-dom/client`, `act`). Если `react` или `react-dom` нет в `dependencies`, выводится ошибка с командой `npm install …` и код `1`
- [ ] Ошибки `lesson` (код `1`, ничего не создано и не изменено): папка уже есть, id уже в `course.yaml`, id не kebab-case, неизвестный Module. Вне курса — код `2`
- [ ] `codda init --help`, `codda lesson --help` по-русски
- [ ] Тесты (CLI процессом): `init` в пустой временной папке, затем `npx codda test` в ней — код `0`, `✓ hello`; `init` в непустой папке и в папке с не-kebab-case именем; `lesson` дописывает в последний Module и в `--module`, комментарий в `course.yaml` до и после правки на месте, затем `codda test` — код `0`; `lesson` на каждую ошибку из списка выше; `--tsx` без React — ошибка
- [ ] Шаблон `--tsx` проходит `codda test` в курсе с React: тест добавляет Lesson `--tsx` во временную копию `courses/react-hooks` и проверяет только его (`codda test <папка Lesson>`)
- [ ] `npm run typecheck`, `npm test`, `npm run test:e2e` зелёные
