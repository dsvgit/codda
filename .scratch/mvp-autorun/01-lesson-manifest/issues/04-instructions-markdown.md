# 04: Instructions из Markdown

**What to build:** студент читает Instructions с форматированием: заголовки, списки, код, таблицы, ссылки. `codda build` превращает тело `lesson.md` в HTML пакетом `marked` (CommonMark + GFM) и кладёт его в `course.json`; UI вставляет готовый HTML. Raw HTML в Markdown экранируется и показывается как текст. Внешние ссылки открываются в новой вкладке. Картинка в Instructions — ошибка Course в формате тикета 02. Instructions пяти Lesson React Hooks приведены к Markdown (имена элементов и код — в обратных кавычках).

Подробности — [spec.md](../spec.md), «UI → Instructions». Место рендера — Q2 в [questions/00-grill.md](../questions/00-grill.md).

**Blocked by:** 01b, 02

**Status:** ready-for-agent

- [ ] Новая зависимость — только `marked` (из списка `README.md`), только в Node-части инструмента: в бандл UI она не попадает
- [ ] Тест CLI: заголовок, список, `inline code`, блок кода, таблица GFM, ссылка в `lesson.md` → соответствующие элементы в `instructions` в `course.json`
- [ ] Тест CLI: блочный raw HTML (`<script>…</script>`, `<div>`) и строчный (`<img src=x onerror=…>`) → экранированный текст, ни одного такого тега в `instructions`
- [ ] Тест CLI: ссылка `https://…` получает `target="_blank"` и `rel="noopener"`
- [ ] Тест CLI: `![схема](diagram.png)` → `<lesson>/lesson.md: строка N: картинки в Instructions не поддерживаются`, код `1`; вместе с другими ошибками Course выводятся все
- [ ] Тело `lesson.md`, начинающееся с `# …`, не ошибка
- [ ] e2e: в Lesson `use-state` Instructions показаны с форматированием (есть элемент `code`), без текста frontmatter
- [ ] Instructions пяти Lesson React Hooks переписаны на Markdown, курс собирается без ошибок
- [ ] `npm run typecheck`, `npm test`, `npm run test:e2e` зелёные

## Comments

- **Риск, найден на ревью фазы A.** У токенов `marked` нет номеров строк: строку картинки считать по смещению `raw` токена в теле `lesson.md` плюс высота frontmatter. Флага «raw HTML как текст» в `marked` нет: переопределить renderer для токенов `html` (блочных и строчных) на экранирование; `target`/`rel` у внешних ссылок — тоже через renderer.
