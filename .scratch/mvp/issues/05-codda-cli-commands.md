# 05: Команды CLI `codda`

Type: grilling
Status: open
Blocked by: 03, 08

## Question

Какие команды, аргументы и вывод у CLI `codda` в MVP? CLI запускается в любой папке курса (ADR-0006). Кандидаты из раунда 2: `codda init`, `codda test`, `codda lesson` (скелет Lesson), `codda ci`, `codda deps`, а также `codda dev <путь>` и `codda build <путь>`.

Решить:

- Окончательный список команд и что каждая проверяет или создаёт. `codda test`: собираются ли starter и solution, проходит ли solution тесты, падает ли на них starter, валиден ли manifest, собираются ли зависимости.
- Чем `codda ci` отличается от `codda test` (и нужен ли он).
- Где выполняются Lesson Tests при `codda test`: в headless-браузере (Playwright) с тем же Runtime или иначе.
- Формат вывода и коды выхода для CI.
- Как CLI ставится и запускается в MVP (из этого репозитория: `npx codda`, `npm run codda`?).
