# 02: Все ошибки Course сразу, одной строкой на ошибку

**What to build:** Author запускает `codda build` на Course с ошибками и за один запуск видит **все** ошибки по всем файлам, по одной строке: `<файл от корня Course>: <путь к полю>: <сообщение>`, по-русски. Код выхода `1`, сборка не создаётся. Правила — все из `## Answer` тикета 03 Плана решений, кроме картинок в Instructions (тикет 04) и зависимостей (`dependency-artifacts`). Те же строки показывает ответ 500 dev-сервера инструмента.

Подробности — [spec.md](../spec.md), «Формат Course на диске» и «Модуль чтения Course».

**Blocked by:** 01a

**Status:** ready-for-agent

Все проверки — тестами CLI как процесса на временных Course, которые пишет сам тест. Каждый тест сверяет точную строку ошибки и код `1`.

- [ ] `course.yaml`: нет `id`, `title`, `modules`; пустой `modules`; Module без `title` или с пустым `lessons`; путь поля как `modules[0].lessons[2]`
- [ ] `id` Course и id Lesson в `lessons` не kebab-case (`React-Hooks`, `use_state`, `01-`) → ошибка
- [ ] Неизвестное поле в `course.yaml` и во frontmatter (например, `dependencies`) → ошибка с именем поля
- [ ] Синтаксическая ошибка YAML в `course.yaml` и во frontmatter → `<файл>: строка N: <сообщение>`
- [ ] Lesson из `course.yaml` нет на диске; папка с `lesson.md` в корне Course не указана в `course.yaml`; id повторяется внутри Module и между Module
- [ ] Нет `lesson.md`; нет frontmatter; нет `title` или он пустой
- [ ] Нет `main.ts`/`main.tsx` или есть оба; нет `solution.*` с расширением `main`, в том числе `solution.ts` при `main.tsx`; нет `lesson.test.ts`/`.tsx` или есть оба
- [ ] Папка вроде `node_modules/` или `dist/` без `lesson.md` ошибкой не считается
- [ ] Несколько ошибок в разных файлах и разных Lesson выводятся все за один запуск, в стабильном порядке (`course.yaml`, затем Lesson в порядке `course.yaml`)
- [ ] Все сообщения на русском, включая сообщения Zod
- [ ] При ошибках папка `--out` не создаётся, а существующая не меняется
- [ ] Курс React Hooks проходит без ошибок
- [ ] `npm run typecheck`, `npm test`, `npm run test:e2e` зелёные
