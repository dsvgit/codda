# 01: CI bootstrap — проверки инструмента на PR и push в `main`

**What to build:** Первый шаг CI из решения [тикета 06 Плана решений](../../mvp/issues/06-ci-and-pilot-hosting.md). Workflow GitHub Actions `.github/workflows/ci.yml` на `pull_request` и `push` в `main`, без фильтров по путям: `npm ci` → `npm run typecheck` → `npm test` → `npm run test:e2e`. Job идёт в контейнере `mcr.microsoft.com/playwright:v<версия>-noble`, версия = `playwright` из `package.json`; e2e — полный Chromium, как в `playwright.config.ts`. Шаги `codda test` / `codda build` для курсов, проверка границы ADR-0006 и выкладка на GitHub Pages сюда **не входят** — их добавляют фичи `lesson-manifest` и `author-cli`, когда появится CLI.

Зачем отдельно и первым: `CLAUDE.md` и `docs/ai-workflow.md` опираются на «branch protection требует зелёный CI», а на 2026-10-04 workflow нет и обязательных проверок в защите `main` тоже нет — PR фич MVP мержатся без автоматической проверки.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `.github/workflows/ci.yml`: триггеры `pull_request` и `push` в `main`, один job `check` с четырьмя шагами выше
- [ ] Версия образа Playwright совпадает с `playwright` в `package.json`; рядом комментарий, что их нужно обновлять вместе
- [ ] Workflow зелёный на PR этого тикета (ссылка на run — в `## Comments`)
- [ ] Красный прогон проверен: временно сломанный тест в PR даёт красный `check` (после проверки откатить)
- [ ] Шаг для человека (`ready-for-human`): в branch protection `main` сделать `check` обязательной проверкой; после этого убрать оговорку «до тикета misc/01 CI нет» из `CLAUDE.md` и `docs/ai-workflow.md`

## Comments
