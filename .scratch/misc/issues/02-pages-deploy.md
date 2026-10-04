# 02: Выкладка пилота на GitHub Pages из CI

**What to build:** Выкладка на GitHub Pages из [решения тикета 06 Плана решений](../../mvp/issues/06-ci-and-pilot-hosting.md), раньше фичи `author-cli`, в которую она входила по [HOW-TO-PROCEED](../../../docs/HOW-TO-PROCEED.md), строка 4. Сейчас выкладываем текущую сборку инструмента (`npm run build` → `dist/`, Lesson открывается по `?lesson=<id>`). В `author-cli` `npm run build` заменят на `codda build`, а job выкладки останется прежней.

В `.github/workflows/ci.yml` появляется job `deploy`. Она запускается только на push в `main` и только после зелёной `check`. Выкладывает `dist/`, который собрала и проверила `check`, без пересборки: `check` вызывает `actions/upload-pages-artifact`, `deploy` — `actions/deploy-pages`, с `permissions: pages: write, id-token: write`, окружением `github-pages` и `concurrency`, чтобы две выкладки не шли одновременно. Адрес пилота — `https://dsvgit.github.io/codda/`, то есть сборка отдаётся из подпути `/codda/`.

Зачем сейчас: `CLAUDE.md` и `docs/ai-workflow.md` уже пишут «каждый push в `main` выкладывается на пилот», а выкладки нет. Пилот по Golden Path хочется показывать людям до `author-cli`. Так тикет расширяет скоуп осознанно.

Находка при оформлении (2026-10-04): сборка сейчас работает только из корня origin. `base` в `vite.config.ts` не задан, а в `src/runtime/compiler.worker.ts` адрес `deps/` строится от origin (`new URL(\`${import.meta.env.BASE_URL}deps/\`, self.location.origin)`). На `/codda/` Run получит 404 на `deps/manifest.json`. Требование из тикета 06: все URL относительные (`base: "./"`), сборка работает из любого подпути.

**Blocked by:** None (can start immediately). Pages уже включены: Source — GitHub Actions (`build_type: workflow`, проверено через `gh api repos/dsvgit/codda/pages` 2026-10-04).

**Status:** ready-for-human

- [x] Сборка работает из любого подпути: `base: "./"`, `deps/`, `esbuild.wasm` и чанк воркера грузятся относительно страницы, а не от корня origin
- [x] e2e-тест открывает собранный `dist/` из подпути (например, `/codda/`) и проходит Golden Path: Lesson → Run tests → PASS. Тест входит в `npm run test:e2e` и идёт в `check`, так что выкладывается проверенная сборка
- [x] Проверено, что Golden Path в dev-сервере (`npm run dev`, существующие e2e) не сломался
- [x] `ci.yml`: `check` собирает `dist/` и загружает его как Pages-артефакт; job `deploy` (`needs: check`, `if` — push в `main`) выкладывает его; на `pull_request` выкладки нет
- [x] Документы: строка 4 в `docs/HOW-TO-PROCEED.md` (выкладка уже есть, `author-cli` меняет только команду сборки), строка 0 — ссылка на этот тикет; комментарий в шапке `ci.yml`
- [ ] Шаг для человека (`ready-for-human`): после merge открыть `https://dsvgit.github.io/codda/?lesson=<id>` в Chrome, нажать Run tests, увидеть PASS. Ссылка на run выкладки — в `## Comments`

## Comments

- **2026-10-04, агент.** Сделано:
  - `base: "./"` в `vite.config.ts`.
  - Адрес `deps/` теперь вычисляет страница: `compiler.ts` берёт `BASE_URL` и разрешает его от `document.baseURI`, а Worker получает готовый адрес в каждом сообщении compile.
  - Почему не в Worker: в сборке `BASE_URL` равен `"./"`. От origin он давал `/deps/`, от скрипта Worker — `/codda/assets/deps/`, и оба адреса неверны. Где отдаётся страница, знает только она сама.
  - Чанк Worker и `esbuild.wasm` Vite и так грузит относительно `import.meta.url`.
- **e2e.** В `playwright.config.ts` теперь два проекта:
  - `dev` — dev-сервер, как раньше.
  - `pages` — `vite preview --base /codda/` над `dist/`.
  - Все e2e идут в обоих проектах и открывают страницу через `page.goto("./")`.
  - `npm run test:e2e` теперь начинается с `npm run build`, поэтому `check` выкладывает ровно ту сборку, которую проверила.
  - Red: до фикса пять тестов `pages` падали, страница с `/codda/` не грузилась. После фикса все 10/10 зелёные, ~27 с локально.
  - В логе запросов `pages` worker, `esbuild.wasm` и `deps/*` идут из `/codda/`.
- **Вне «What to build»:**
  - e2e «student opens a course Lesson by its id»: прогон Lesson курса по `?lesson=<id>` — тот же адрес, что в шаге для человека.
  - Ссылка на пилот и описание проектов e2e в `README.md`.
- **Версии действий.** `actions/upload-pages-artifact@v5` и `actions/deploy-pages@v5` — последние релизы на 2026-10-04. Загрузка идёт на шаге внутри контейнерной `check` (`--user 1001`). Подтвердит её только первый push в `main`.
- **Не протестировано (на отдельный проход):**
  - Поведение при 404 на `deps/` из подпути. Обработка ошибки загрузки та же, что до тикета; её тестирование оставлено фиче `runtime-hardening`.
  - Открытие по `/codda/index.html` и по `/codda` без слэша: Pages редиректит.
  - Правила ветки в окружении `github-pages`: должны разрешать `main`, по умолчанию так и есть.
- **2026-10-04, агент.** Первый push в `main` после merge [упал](https://github.com/dsvgit/codda/actions/runs/37192951799) на e2e `[dev] student code's fetch to the Internet does not get through`: тест 30 с ждал `requestfailed`.
  - Причина — гонка, которая была в тесте и раньше. Runner удаляет Sandbox iframe сразу после отчёта. Если это происходит раньше, чем Playwright доставит abort, событие `requestfailed` не приходит.
  - `base: "./"` сместил тайминг dev-сервера. Локально тест стал падать примерно в 1 случае из 4, без `base` — 0 из 20.
  - Исправлено в ветке `fix-fetch-e2e-flake`: тест ждёт сам запрос (`waitForRequest`), а блокировку обеспечивает фикстура `offline.ts`. После правки 50/50 прогонов зелёные.
