# 02: Сверка с «Определением MVP», README для Author, документы стадии

**What to build:** Владелец продукта открывает `## Итог` [спеки](../spec.md) и видит таблицу: каждый пункт «Определения MVP» из `docs/roadmap.md` — сделано / частично / нет и доказательство (тест, e2e-сценарий, коммит или ручная проверка с датой). Author открывает README пакета `codda` и по нему делает свой Course и Lesson от `codda init` до CI. Документы стадии (`CLAUDE.md`, `docs/HOW-TO-PROCEED.md`, `docs/roadmap.md`, корневой README) описывают «MVP собран, следующий шаг — пилот». Несделанное не доделывается, а фиксируется (спека, Implementation Decisions).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] В `## Итог` спеки — таблица: строка на каждый пункт «Определения MVP», составные пункты разбиты по свойству; колонки «пункт · статус · доказательство · примечание»; у каждой строки «сделано» есть конкретное доказательство (имя теста или e2e-сценария, хеш коммита или ручная проверка с датой)
- [ ] Ручные пункты (UI на русском, только Chrome, закрытый контур на собранном курсе) проверены на сборке `codda build` React Hooks; как — в `## Comments`
- [ ] Каждый пункт «частично» / «нет» записан строкой в `docs/roadmap.md` («MVP, часть 2» или новый список «До пилота») и упомянут в тикете [03](03-pilot-on-people.md)
- [ ] README пакета `codda` для Author: требования (Node, Chromium через зеркало), `codda init [--ci github|gitlab]`, `codda lesson [--module] [--tsx]`, файлы Lesson и что в них писать (Instructions, Starter `main.*`, Solution, Lesson Tests с импортом `./main`), зависимости в `package.json` Course, `codda dev`, `codda test` (что проверяет, `✓`/`✗`/`⚠`, коды `0`/`1`/`2`), `codda build`, CI; ссылка на React Hooks как образец. Уже написанное `author-cli` дополняется, а не дублируется
- [ ] README проверен прогоном по шагам в пустой временной папке: `codda init` → `codda lesson` → `codda test` (код `0`) → `codda build` (код `0`); расхождения README и поведения исправлены в README, баги CLI — в `## Comments` (не чинятся здесь)
- [ ] Корневой README: что такое `codda`, адрес пилота, разработка инструмента (команды репозитория), ссылка на README для Author; PoC-инструкции (`?lesson=…`, «Run tests», `npm run build:deps`) убраны
- [ ] `CLAUDE.md`, «Текущая стадия»: MVP собран, идёт пилот; ссылки на эту спеку и тикет 03
- [ ] `docs/HOW-TO-PROCEED.md`: Шаг 3 отмечен ✅ со ссылками на спеки фич; новые шаги «Пилот на людях» (тикет 03) и «MVP Report» (`docs/mvp-report.md` после пилота)
- [ ] `docs/roadmap.md`: статус Phase 1–3 и строки MVP по таблице из `## Итог`
- [ ] `npm run typecheck`, `npm test`, `npm run test:e2e` зелёные (документы их не ломают)
