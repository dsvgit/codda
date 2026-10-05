# 04: Instructions из Markdown

**What to build:** студент читает Instructions с форматированием: заголовки, списки, код, таблицы, ссылки. `codda build` превращает тело `lesson.md` в HTML пакетом `marked` (CommonMark + GFM) и кладёт его в `course.json`; UI вставляет готовый HTML. Raw HTML в Markdown экранируется и показывается как текст. Внешние ссылки открываются в новой вкладке. Картинка в Instructions — ошибка Course в формате тикета 02. Instructions пяти Lesson React Hooks приведены к Markdown (имена элементов и код — в обратных кавычках).

Подробности — [spec.md](../spec.md), «UI → Instructions». Место рендера — Q2 в [questions/00-grill.md](../questions/00-grill.md).

**Blocked by:** 01b, 02

**Status:** done

- [x] Новая зависимость — только `marked` (из списка `README.md`), только в Node-части инструмента: в бандл UI она не попадает
- [x] Тест CLI: заголовок, список, `inline code`, блок кода, таблица GFM, ссылка в `lesson.md` → соответствующие элементы в `instructions` в `course.json`
- [x] Тест CLI: блочный raw HTML (`<script>…</script>`, `<div>`) и строчный (`<img src=x onerror=…>`) → экранированный текст, ни одного такого тега в `instructions`
- [x] Тест CLI: ссылка `https://…` получает `target="_blank"` и `rel="noopener"`
- [x] Тест CLI: `![схема](diagram.png)` → `<lesson>/lesson.md: строка N: картинки в Instructions не поддерживаются`, код `1`; вместе с другими ошибками Course выводятся все
- [x] Тело `lesson.md`, начинающееся с `# …`, не ошибка
- [x] e2e: в Lesson `use-state` Instructions показаны с форматированием (есть элемент `code`), без текста frontmatter
- [x] Instructions пяти Lesson React Hooks переписаны на Markdown, курс собирается без ошибок
- [x] `npm run typecheck`, `npm test`, `npm run test:e2e` зелёные локально

## Comments

- **Риск, найден на ревью фазы A.** У токенов `marked` нет номеров строк: строку картинки считать по смещению `raw` токена в теле `lesson.md` плюс высота frontmatter. Флага «raw HTML как текст» в `marked` нет: переопределить renderer для токенов `html` (блочных и строчных) на экранирование; `target`/`rel` у внешних ссылок — тоже через renderer.

- **2026-10-04 — реализация (агент).**
  - **Рендер** — в модуле чтения Course `packages/codda/cli/read-course.ts`: свой экземпляр `new Marked({ gfm: true })` (`marked` 18, dependency пакета `codda`). Тело `lesson.md` идёт в `course.json` готовым HTML; прежнее «срезать первую пустую строку» больше не нужно. `marked` импортирует только `cli/` (и dev-сервер через `vite.config.ts`), в `dist-tool/` после `npm run build` строки `marked` нет — проверено `grep`, отдельного теста нет.
  - **Raw HTML:** renderer `html` экранирует `& < > " '`; блочный raw HTML оборачивается в `<p>`, строчный экранируется на месте. **Ссылки:** renderer `link` вызывает стандартный `Renderer.prototype.link` и для `http(s)://` добавляет `target="_blank" rel="noopener"`; `#/…` и относительные ссылки — обычные `<a>`. GFM-автоссылки идут тем же путём.
  - **Картинки:** `lexer` → `walkTokens`, на каждый токен `image` — ошибка `<id>/lesson.md: строка N: картинки в Instructions не поддерживаются`. Номер строки — по смещению `raw` в теле (поиск от конца предыдущей найденной картинки, так одинаковые картинки получают свои строки) плюс номер строки, с которой тело начинается в файле. Находятся и картинки в ячейках таблиц. Ошибки картинок идут в общий список вместе с остальными ошибками Course; `<img>` как raw HTML — не ошибка, а экранированный текст.
  - **UI:** `App.tsx` вставляет HTML через `dangerouslySetInnerHTML` в `<div class="markdown">`; секция Instructions стала регионом (`aria-labelledby` на заголовок) — на нём держатся тесты. CSS для `code`, `pre`, таблиц; `white-space: pre-wrap` из 01b снят: переносы теперь задаёт Markdown (мягкий перенос строки = пробел по CommonMark), тест «Instructions keep their line breaks» заменён тестом на HTML.
  - **Курс:** Instructions пяти Lesson были Markdown уже с 01a (код и элементы в обратных кавычках); `use-state` разбит на нумерованный список шагов, `use-reducer` — на маркированный список действий. Курс собирается, все Solution проходят (e2e).
  - **Тесты:** `cli/build.test.ts`, блок «Instructions» (элементы Markdown, raw HTML, внешние ссылки, `# …`, картинки вместе с другой ошибкой); ожидание первого теста build (`instructions`) переведено на HTML. `App.test.tsx` — HTML показан с форматированием. e2e `course.e2e.ts` — `use-state` с элементом `code` и без frontmatter; проверка текста `use-effect` больше не ищет обратные кавычки.
  - **TDD-оговорка:** red → green для элементов Markdown, raw HTML, внешних ссылок, картинок, UI и e2e (e2e красным подтверждён на прежнем `App.tsx`). Тест «тело начинается с `# …`» зелёный сразу — это поведение `marked`, кода под него нет.
  - **Вне критериев:** у токенов с CRLF-переводами строк внутри одной картинки (многострочный `alt`) смещение может не найтись — для пилота не важно. Заголовок «Instructions» над заданием остался английским (так в спеке). Подсветки кода нет (по спеке).
- **2026-10-04 — правки по review фичи (оркестратор).** Review нашёл XSS: `marked` не фильтрует схемы, `[x](javascript:…)` давал `<a href="javascript:…">` на странице нашего origin, вне Sandbox (ADR-0003). Теперь ссылка со схемой, кроме `http(s)`/`mailto`, выводится только текстом (табуляции и пробелы в URL отбрасываются до проверки); тест `a link with a script scheme becomes plain text` увиден красным. Проверка экранирования на уровне страницы (e2e с raw HTML) не добавлена: экранирует `codda build`, UI вставляет HTML как есть, а в пилотном курсе raw HTML нет — принято, покрыто тестом CLI.
