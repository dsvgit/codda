# 03: npm workspaces и публикация пакета `codda`

**What to build:** Разделить репозиторий на npm workspaces и опубликовать инструмент как пакет `codda`, чтобы курс из чужого репозитория ставил его через `npm install -D codda` и вызывал `npx codda test` / `npx codda build`. На этот вызов уже рассчитаны шаблоны CI из [тикета 06 Плана решений](../../mvp/issues/06-ci-and-pilot-hosting.md): `codda init --ci` кладёт `npx codda …`, и такой шаблон «заработает после публикации пакета».

Зачем отдельно: [ADR-0006](../../../docs/adr/0006-tool-separate-from-content.md) откладывает публикацию на после MVP («для одного пилотного курса … публикация пакета `codda` — лишняя работа»). Тикет пересматривает это решение и расширяет скоуп осознанно. В ADR-0006 появится уточнение или новый ADR, который его заменит.

Раскладка (предложение, уточнить на grilling):

- корневой `package.json` — только корень workspaces (`private: true`), у него остаются общие скрипты и `devDependencies` для тестов;
- `packages/codda/` — публикуемый пакет: `cli/` из фичи `author-cli`, UI и Runtime (`src/`), сборка UI (`dist-tool/`, ADR-0008), `bin: { "codda": … }`;
- `courses/*` **не** входят в `workspaces`. По ADR-0007 у Course свои `package.json` и `package-lock.json` в корне, а workspaces сводят зависимости в один lockfile корня. Course ставит `codda` как обычную зависимость, то есть так же, как это сделает внешний репозиторий.

Находки при оформлении (2026-10-04):

- Node 24 не убирает типы из `.ts` внутри `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`, проверено на v24.20.0). Поэтому `node cli/codda.ts` из тикета 05 работает в этом репозитории, но не из установленного пакета. В пакет CLI идёт собранным в JS.
- В опубликованном пакете готовый UI должен лежать внутри (`files` включает `dist-tool/`). Запасной путь ADR-0008 «CLI собирает UI сам, если его нет» требует Vite и всех плагинов в `dependencies` пакета, а ADR-0008 как раз этого избегает. Для установленного пакета этот путь нужно убрать.
- Имена `codda` и `@codda/cli` на npmjs.org свободны (`npm view`, 2026-10-04).

**Blocked by:** фича `author-cli` (строка 4 в [HOW-TO-PROCEED](../../../docs/HOW-TO-PROCEED.md)): пока нет `cli/codda.ts`, публиковать нечего. Раскладку workspaces можно сделать и раньше, но тогда `lesson-manifest` и `author-cli` будут писаться уже в новой раскладке. Это тоже вопрос на grilling.

**Status:** needs-info

Открытые вопросы (решить через `/grill-with-docs` в `.scratch/misc/questions/03-workspaces-cli-publish.md`, затем перевести тикет в `ready-for-agent`):

1. **Куда публиковать.** Варианты: публичный npmjs.org, GitHub Packages (нужен токен даже на чтение), внутренний registry компании. По ADR-0002 закрытый контур — свойство установки: курс в контуре берёт registry из своего `.npmrc` (ADR-0006), значит пакет должен оказаться во внутреннем registry (опубликован туда или проксирован с npmjs).
2. **Имя пакета:** `codda` или scope (`@codda/cli`, `@<org>/codda`).
3. **Один пакет или несколько** (`codda` = CLI + UI + Runtime, или отдельно `@codda/runtime`, `@codda/ui`). Предложение — один: потребитель у пакета один, это CLI.
4. **Когда раскладывать на workspaces:** до `lesson-manifest` или вместе с публикацией после `author-cli`.
5. **Как выпускается версия:** CI-job на тег `v*` (`npm publish --provenance`, `NPM_TOKEN` в secrets) или вручную. Как связаны версия пакета и «версия пайплайна `codda`» в hash Dependency Artifact (ADR-0007).
6. **Playwright у потребителя:** `dependencies` или `peerDependencies`, и как закрепить версию Chromium под образ CI из шаблона (тикет 06).

Критерии приёмки (черновик, уточняется вместе с вопросами):

- [ ] Корень репозитория — npm workspaces, `packages/codda/` — пакет инструмента, `courses/*` в workspaces не входят; `npm ci`, `typecheck`, `test`, `test:e2e` и job `check` в CI зелёные
- [ ] `npm pack` в `packages/codda/` даёт архив, в котором есть собранный CLI на JS, `dist-tool/` и `bin`, и нет исходников тестов и `courses/`
- [ ] e2e-тест: архив из `npm pack` ставится во временную папку курса вне репозитория, `npx codda test` и `npx codda build` проходят на пилотном Course. Тест идёт в `check`
- [ ] Пилотный Course в `courses/` подключает `codda` как зависимость (через `file:`/workspace-ссылку или архив), CI вызывает его как `npx codda`, а не `node cli/codda.ts`
- [ ] Публикация по выбранному в вопросе 5 способу; первая версия опубликована, ссылка на неё — в `## Comments`
- [ ] Документы: уточнение ADR-0006 (или новый ADR), ADR-0008 (готовый UI внутри пакета, без самосборки у установленного пакета), README (установка `codda` в репозиторий курса), строка в `docs/HOW-TO-PROCEED.md`
- [ ] Шаг для человека (`ready-for-human`): токен публикации в secrets репозитория и, если выбран внутренний registry, доступ к нему из CI

## Comments
