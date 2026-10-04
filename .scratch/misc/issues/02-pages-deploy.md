# 02: Выкладка пилота на GitHub Pages из CI

**What to build:** Выкладка на GitHub Pages из [решения тикета 06 Плана решений](../../mvp/issues/06-ci-and-pilot-hosting.md), раньше фичи `author-cli`, в которую она входила по [HOW-TO-PROCEED](../../../docs/HOW-TO-PROCEED.md), строка 4. Сейчас выкладываем текущую сборку инструмента (`npm run build` → `dist/`, Lesson открывается по `?lesson=<id>`). В `author-cli` `npm run build` заменят на `codda build`, а job выкладки останется прежней.

В `.github/workflows/ci.yml` появляется job `deploy`. Она запускается только на push в `main` и только после зелёной `check`. Выкладывает `dist/`, который собрала и проверила `check`, без пересборки: `check` вызывает `actions/upload-pages-artifact`, `deploy` — `actions/deploy-pages`, с `permissions: pages: write, id-token: write`, окружением `github-pages` и `concurrency`, чтобы две выкладки не шли одновременно. Адрес пилота — `https://dsvgit.github.io/codda/`, то есть сборка отдаётся из подпути `/codda/`.

Зачем сейчас: `CLAUDE.md` и `docs/ai-workflow.md` уже пишут «каждый push в `main` выкладывается на пилот», а выкладки нет. Пилот по Golden Path хочется показывать людям до `author-cli`. Так тикет расширяет скоуп осознанно.

Находка при оформлении (2026-10-04): сборка сейчас работает только из корня origin. `base` в `vite.config.ts` не задан, а в `src/runtime/compiler.worker.ts` адрес `deps/` строится от origin (`new URL(\`${import.meta.env.BASE_URL}deps/\`, self.location.origin)`). На `/codda/` Run получит 404 на `deps/manifest.json`. Требование из тикета 06: все URL относительные (`base: "./"`), сборка работает из любого подпути.

**Blocked by:** None (can start immediately). Pages уже включены: Source — GitHub Actions (`build_type: workflow`, проверено через `gh api repos/dsvgit/codda/pages` 2026-10-04).

**Status:** ready-for-agent

- [ ] Сборка работает из любого подпути: `base: "./"`, `deps/`, `esbuild.wasm` и чанк воркера грузятся относительно страницы, а не от корня origin
- [ ] e2e-тест открывает собранный `dist/` из подпути (например, `/codda/`) и проходит Golden Path: Lesson → Run tests → PASS. Тест входит в `npm run test:e2e` и идёт в `check`, так что выкладывается проверенная сборка
- [ ] Проверено, что Golden Path в dev-сервере (`npm run dev`, существующие e2e) не сломался
- [ ] `ci.yml`: `check` собирает `dist/` и загружает его как Pages-артефакт; job `deploy` (`needs: check`, `if` — push в `main`) выкладывает его; на `pull_request` выкладки нет
- [ ] Документы: строка 4 в `docs/HOW-TO-PROCEED.md` (выкладка уже есть, `author-cli` меняет только команду сборки), строка 0 — ссылка на этот тикет; комментарий в шапке `ci.yml`
- [ ] Шаг для человека (`ready-for-human`): после merge открыть `https://dsvgit.github.io/codda/?lesson=<id>` в Chrome, нажать Run tests, увидеть PASS. Ссылка на run выкладки — в `## Comments`

## Comments
