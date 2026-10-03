# 06: CI, хранилище Dependency Artifacts и хостинг пилота

Type: grilling
Status: resolved
Blocked by: 08

## Question

Где в MVP выполняется CI, где лежат Dependency Artifacts и откуда пилотные пользователи открывают сборку?

- Какая CI-система (что есть в компании) и как в ней запускается проверка уроков на каждый PR (4.3).
- Хранилище артефактов по content-hash (5.3): внутри статической сборки (`codda build`) или отдельное. Ответ зависит от того, как артефакты доставляются (тикеты 01 и 08). По ADR-0007 артефакт один на Course и в MVP вшивается в бандл, поэтому CORS на статике не нужен.
- Куда выкладывается статическая сборка для пилота и кто её обновляет. Production-деплой и наблюдаемость не входят в MVP; нужен минимальный способ показать сборку внутренним пользователям.

## Answer

Вопросы и ответы по раундам — в [questions/06-ci-and-pilot-hosting.md](../questions/06-ci-and-pilot-hosting.md). Уточнение «закрытый контур — свойство установки, а не `codda`» записано в [ADR-0002](../../../docs/adr/0002-fully-internal-infrastructure.md).

**CI этого репозитория** — GitHub Actions, один workflow на PR и на push в `main`, без фильтров по путям:

1. `npm ci`, `npm run typecheck`, `npm test`, `npm run test:e2e`.
2. Проверка границы ADR-0006: код инструмента не импортирует `courses/` (способ решает фича `lesson-manifest`).
3. `CI=true node cli/codda.ts test <курс>` и `node cli/codda.ts build <курс>` для каждой папки с `course.yaml` в `courses/`.

Merge в `main` — только через PR при зелёном CI (branch protection). Job'ы проверки идут в контейнере `mcr.microsoft.com/playwright:v<версия>-noble`, версия = `playwright` в зависимостях. Preview-сборок на PR нет.

**Хранилище Dependency Artifacts:** только внутри сборки (`deps/<hash>/` в выходе `codda build`). Кэша CI и отдельного хранилища нет; они — в «MVP, часть 2» вместе с экспериментом 07.

**Пилот:** GitHub Pages, публичный адрес, обновляется автоматически. Отдельная job после зелёных проверок, только на push в `main`, выкладывает тот же `dist/`, что проверили (артефакт CI, без пересборки): `actions/upload-pages-artifact` + `actions/deploy-pages`. Адрес пилота не меняется до конца пилота: прогресс в `localStorage` привязан к origin. Входа нет.

**Требования к сборке и UI** (для фич `lesson-manifest`, навигации и прогресса):

- Все URL относительные (`base: "./"`, `course.json`, `deps/<hash>/…`, `esbuild.wasm`), сборка работает из любого подпути. Адрес Lesson — во фрагменте `#/…`, rewrite-правила хостингу не нужны. `codda test` открывает сборку по подпути.
- `course.json` загружается с `cache: "no-cache"`. Старые `deps/<hash>/` при выкладке не сохраняются; если артефакт пропал, Run показывает «Курс обновился, перезагрузите страницу».
- Ключи `localStorage` содержат `id` Course.
- Хостинг — HTTPS или `localhost` (`crypto.subtle` для `integrity` работает только в secure context), `.wasm` с MIME `application/wasm`.

**Шаблоны CI для репозиториев курсов:** `cli/templates/ci/`, кладутся командой `codda init --ci github|gitlab` (`.github/workflows/codda.yml` или `.gitlab-ci.yml`). Шаги: `codda test` → `codda build` → выкладка отдельной job'ой только на push в `main`. Вызывают `npx codda …`, поэтому в чужих репозиториях заработают после публикации пакета; `codda test` проверяет, что GitLab-шаблон — валидный YAML с ожидаемыми job'ами.

- **GitHub:** контейнер Playwright (внешний образ допустим), выкладка на GitHub Pages.
- **GitLab:** `image: $CODDA_IMAGE` — внутренний образ с Node 24 и Chromium нужной версии Playwright (версию `codda init` вписывает в комментарий). Registry — `.npmrc` курса. Выкладка — `aws s3 sync dist/ s3://$CODDA_S3_BUCKET/ --delete` с `AWS_ENDPOINT_URL` и protected-переменными; `Cache-Control: no-cache` для `index.html` и `course.json`, `immutable` для остального. Образ job'ы выкладки — тоже плейсхолдер.

**Что делает человек:** создаёт репозиторий на GitHub, включает Pages (Source: GitHub Actions) и branch protection на `main` (PR + зелёный CI).
