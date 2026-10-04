# 03: npm workspaces — инструмент в `packages/codda/`, курсы вне workspaces

**What to build:** Разделить репозиторий на npm workspaces, пока кода мало. Корневой `package.json` становится корнем workspaces (`private: true`, общие скрипты, `devDependencies` для тестов). Код инструмента переезжает в `packages/codda/`: `src/` (UI и Runtime), `public/deps/`, `scripts/`, `index.html`, `vite.config.ts`, свой `tsconfig.json`. Позже туда же лягут `cli/` из фичи `author-cli` и `dist-tool/` (ADR-0008). `courses/*` в `workspaces` **не** входят: по ADR-0007 у Course свои `package.json` и `package-lock.json`, а workspaces сводят зависимости в один lockfile корня. Где лежат `e2e/` и `playwright.config.ts` (в корне или в пакете), решается на grilling.

Зачем сейчас: так решено при разделении тикета о workspaces и публикации (2026-10-04, разговор с человеком). После `lesson-manifest` и `author-cli` переносить пришлось бы ещё `cli/`, `dist-tool/`, шаблоны, CI и тесты. С новой раскладкой `author-cli` сразу делает курс потребителем инструмента, как у внешнего репозитория: `"codda": "file:../../packages/codda"` в `devDependencies` Course (не в `dependencies`: из них ADR-0007 собирает Dependency Artifact) и вызов `npx codda test`, как в шаблонах CI из [тикета 06](../../mvp/issues/06-ci-and-pilot-hosting.md). Публикация пакета — отдельно, в [тикете 04](04-cli-package-publish.md).

Порядок: после `misc/02` (Pages), до `lesson-manifest`. `misc/02` меняет `vite.config.ts` и пути сборки, их удобнее переносить уже готовыми.

Внутри репозитория CLI вызывается так же, как в репозитории курса: `npx codda …`. Через `npx codda` идут команды, которые работают с курсом. Скрипты разработки самого инструмента (`typecheck`, unit, e2e, `vite build` UI) остаются npm-скриптами корня: это работа над `codda`, а не его использование.

Что остаётся как есть: PoC-импорт `courses/` из `src/main.tsx` и `src/App.tsx` (станет `../../../courses`). Его убирает `lesson-manifest` (ADR-0008). Поэтому `rootDir`, который делает импорт из `courses/` ошибкой `tsc`, включается не здесь, а в `lesson-manifest`, вместе с проверкой границы ADR-0006. Vite такой импорт не ловит, так что проверка в CI всё равно нужна.

**Blocked by:** misc/02

**Status:** needs-info

Открытые вопросы (короткий `/grill-with-docs` в `.scratch/misc/questions/03-workspaces.md`, затем `ready-for-agent`):

1. **Один пакет или несколько:** `codda` = CLI + UI + Runtime или отдельно `@codda/runtime`, `@codda/ui`. Рекомендация — один: потребитель у него один, это CLI.
2. **Где живут e2e и Playwright:** в корне (они проверяют сборку инструмента и курсы, как CI) или в `packages/codda/`.
3. **Имя пакета в `package.json`:** `codda` сейчас, чтобы `npx codda` и `file:`-ссылка не менялись после публикации. Окончательное имя для registry выбирает тикет 04.

Критерии приёмки:

- [ ] Корень — npm workspaces с одним членом `packages/codda/`; один `package-lock.json` в корне; `courses/` в `workspaces` нет
- [ ] `npm ci`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build` из корня работают; `npm run dev` поднимает Golden Path; job `check` в CI зелёная, выкладка из `misc/02` выкладывает тот же `dist/` (путь в `ci.yml` обновлён)
- [ ] `packages/codda/package.json`: `"bin": { "codda": "./cli/codda.ts" }`, CLI запускается без сборки. Пока это только каркас из тикета 05: `parseArgs`, `--help` на русском, `--version`, неизвестная команда или флаг → код выхода `2`. Команды `init/lesson/test/dev/build` добавляет `author-cli`: им нужен `course.yaml`, а его вводит `lesson-manifest`
- [ ] Тест: `npx codda --version` из корня и из `courses/` печатает версию, `npx codda --bogus` даёт код `2`. Тест идёт в `check`
- [ ] Документы: пути в `CLAUDE.md`, `docs/ai-workflow.md`, README; тикет 05 Плана решений не переписывается, а в `docs/HOW-TO-PROCEED.md` в строке `author-cli` указано: CLI в `packages/codda/cli/`, курс подключает его через `file:` и вызывает `npx codda`

## Comments

- **2026-10-04 — опыт при оформлении (агент).** Во временной папке: корень с `"workspaces": ["packages/*"]`, пакет `codda` с `"bin": { "codda": "./cli/codda.ts" }` (shebang `#!/usr/bin/env node`, в файле аннотации типов), Node v24.20.0. `npx codda` работает (а) из корня; (б) из `courses/c` без своего `package.json` — npm находит корень выше; (в) из `courses/c` со своим `package.json` и `"codda": "file:../../packages/codda"` в `devDependencies`. В случае (в) у курса свой `package-lock.json`, корневой не меняется. Типы Node убирает во всех трёх случаях: bin — симлинк, Node идёт по нему к настоящему пути `packages/codda/cli/codda.ts`, а он вне `node_modules`. Сборка CLI в JS внутри репозитория не нужна; она нужна только для опубликованного пакета (тикет 04).
