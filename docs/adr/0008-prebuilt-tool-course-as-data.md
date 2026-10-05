# UI и Runtime собираются заранее, курс приходит в них данными

Уточняет ADR-0006. UI и Runtime `codda` собираются один раз (`vite build` в этом репозитории, позже это содержимое пакета `codda`). Курс в эту сборку не компилируется. `codda build` копирует готовый UI и кладёт рядом данные курса: `course.json` (Course, Lesson, Instructions, Starter, Solution, Lesson Tests) и Dependency Artifact в `deps/<hash>/`. UI загружает `course.json` через `fetch`. `codda dev` раздаёт ту же раскладку локальным сервером, а `codda test` проверяет в Chromium ровно её. Отказались от варианта, где Vite собирает UI вместе с курсом через виртуальный модуль. У него есть HMR, но каждый `codda build` пересобирает весь UI, у пакета `codda` в зависимостях оказывается Vite со всеми плагинами, а граница «инструмент ↔ контент» видна только по соглашению.

## Consequences

- Граница ADR-0006 — это формат `course.json`. Код UI курсы не импортирует, поэтому PoC-импорт `courses/index.ts` в `src/main.tsx` исчезает.
- `codda test` и хостинг получают одну и ту же раскладку файлов, так что «прошло в `codda test`» значит «работает на хостинге».
- В `codda dev` нет HMR: после правки файла курса страница перезагружается целиком.
- В MVP CLI берёт готовый UI из `dist-tool/` этого репозитория. Если его нет или он устарел, CLI собирает его сам.
- Instructions превращаются из Markdown в HTML в `codda build` (`marked`, raw HTML экранируется); `course.json` несёт готовый HTML, `marked` в бандл UI не попадает (фича `lesson-manifest`, Q2).
- Служебная страница прогонов `#/__codda-test` входит в готовый UI; `codda test` управляет ею из Node через Playwright (`warmUp`, `run`). Ссылок на неё в UI нет (фича `author-cli`, Q1).
