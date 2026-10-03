# 01: CI bootstrap — проверки инструмента на PR и push в `main`

**What to build:** Первый шаг CI из решения [тикета 06 Плана решений](../../mvp/issues/06-ci-and-pilot-hosting.md). Workflow GitHub Actions `.github/workflows/ci.yml` на `pull_request` и `push` в `main`, без фильтров по путям: `npm ci` → `npm run typecheck` → `npm test` → `npm run test:e2e`. Job идёт в контейнере `mcr.microsoft.com/playwright:v<версия>-noble`, версия = `playwright` из `package.json`; e2e — полный Chromium, как в `playwright.config.ts`. Шаги `codda test` / `codda build` для курсов, проверка границы ADR-0006 и выкладка на GitHub Pages сюда **не входят** — их добавляют фичи `lesson-manifest` и `author-cli`, когда появится CLI.

Зачем отдельно и первым: `CLAUDE.md` и `docs/ai-workflow.md` опираются на «branch protection требует зелёный CI», а на 2026-10-04 workflow нет и обязательных проверок в защите `main` тоже нет — PR фич MVP мержатся без автоматической проверки.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `.github/workflows/ci.yml`: триггеры `pull_request` и `push` в `main`, один job `check` с четырьмя шагами выше
- [x] Версия образа Playwright совпадает с `playwright` в `package.json`; рядом комментарий, что их нужно обновлять вместе
- [x] Workflow зелёный на PR этого тикета (ссылка на run — в `## Comments`)
- [x] Красный прогон проверен: временно сломанный тест в PR даёт красный `check` (после проверки откатить)
- [x] Шаг для человека (`ready-for-human`): в branch protection `main` сделать `check` обязательной проверкой; после этого убрать оговорку «до тикета misc/01 CI нет» из `CLAUDE.md` и `docs/ai-workflow.md`

## Comments

- **2026-10-04, агент.** Workflow в PR [#2](https://github.com/dsvgit/codda/pull/2). Прогоны: [зелёный](https://github.com/dsvgit/codda/actions/runs/37155429184); [красный](https://github.com/dsvgit/codda/actions/runs/37155529521) на временно сломанном тесте (коммит `DO NOT MERGE` и его revert, при squash-merge в `main` не попадают); [зелёный](https://github.com/dsvgit/codda/actions/runs/37155599769) после отката.
- **Вне «What to build»: `fileParallelism: false` в `vite.config.ts`.** Первый [прогон](https://github.com/dsvgit/codda/actions/runs/37155292858) упал: три файла vitest шли в параллельных браузерах, и холодный React-Run в двух из них занял ~5.6 с, больше дедлайна Run в 5 с. С файлами по очереди холодный Run в CI занимает ~1 с. Цена — `npm test` локально +2 с (13 → 15.7 с). Это тот же приём, что `workers: 2` в `playwright.config.ts`. Отдельный вопрос на будущее: холодный первый Run на слабой машине студента тоже может не уложиться в 5 с.
- **`playwright` и `@playwright/test` в `package.json` закреплены точно (`1.63.0`, без `^`).** Иначе обновление lockfile сдвинуло бы Playwright мимо тега образа. Обновлять три места вместе: два пакета и образ в `ci.yml`.
- **2026-10-04, агент по просьбе человека.** `check` сделана обязательной проверкой в branch protection `main` через `gh api` (`app_id` 15368 — GitHub Actions, `strict: false`; прочие настройки защиты сохранены). Оговорка «до тикета misc/01 CI нет» убрана из `CLAUDE.md` и `docs/ai-workflow.md`.
