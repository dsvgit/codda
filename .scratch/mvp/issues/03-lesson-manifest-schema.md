# 03: Схема Lesson Manifest и файловая структура Course

Type: grilling
Status: resolved
Blocked by: None

## Question

Какие поля, файлы и правила у Course и Lesson в MVP? Направление уже выбрано (раунд 3, T5): `course.yaml` (название, порядок Module/Lesson, зависимости Course) и папка Lesson с `lesson.md` (frontmatter + Instructions на Markdown), `starter.tsx`, `solution.tsx`, `lesson.test.tsx`. В MVP у Lesson один файл Workspace.

Решить:

- Поля frontmatter и `course.yaml`, что обязательно, что по умолчанию.
- Порядок Lesson: явный список в `course.yaml` или по префиксу папки (`01-…`).
- Идентичность Lesson для прогресса и сохранённого Workspace: что будет с сохранённым кодом студента, когда автор поменял Starter.
- Как Lesson добавляет зависимости к зависимостям Course; формат точной версии.
- Валидация: JSON Schema или код. Какие ошибки показывает `codda test`.
- Как перевести 5 Lesson курса React Hooks (`courses/react-hooks/`) на новый формат. Старый формат удаляется.

Обновить `CONTEXT.md` (Lesson Manifest, Course, Module).

## Answer

Вопросы и ответы по раундам — в [lesson-manifest-questions.md](../lesson-manifest-questions.md).

**Файловая структура:**

```
courses/react-hooks/
  course.yaml
  use-state/               # id Lesson = имя папки, kebab-case, без числового префикса
    lesson.md              # frontmatter + Instructions
    main.tsx               # Starter (main.ts или main.tsx); студент видит вкладку «main.tsx»
    solution.tsx           # Solution, расширение как у main; подставляется на место main
    lesson.test.tsx        # Lesson Tests (.ts или .tsx), импортируют "./main"
```

**`course.yaml`:**

```yaml
id: react-hooks            # обязательно, kebab-case; ключ прогресса в браузере
title: React Hooks         # обязательно
dependencies:              # необязательно, по умолчанию {}
  react: 19.3.0
  react-dom: 19.3.0
modules:                   # обязательно, ≥1
  - title: Хуки            # обязательно
    lessons: [use-state, use-effect, use-ref, use-reducer, use-context]  # ≥1
```

**Frontmatter `lesson.md`:** `title` (обязательно), `dependencies` (необязательно). Тело — Instructions. Заголовок UI берёт из `title`.

**Правила:**

- Порядок Lesson — явный список в `course.yaml`. У Module нет папки, он существует только в `course.yaml`. Если Lesson из списка нет на диске, папка Lesson не указана в списке или id повторяется, это ошибка.
- Идентичность: ключ прогресса и Workspace в браузере — `<course id>/<lesson id>`. Перенос Lesson между Module и смена порядка ключ не меняют. Переименование папки — это новый Lesson, прогресс по старому id теряется.
- Если Starter или тесты поменялись, сохранённый Workspace студента и отметка «пройден» остаются. Новый Starter студент получает через Reset.
- Зависимости: map `имя: X.Y.Z`, допускается prerelease, диапазоны — ошибка. Набор Lesson = Course ∪ Lesson. Повтор в Lesson пакета из Course (с любой версией) — ошибка. Subpath-импорты (`react-dom/client`) не объявляются, `codda` выводит их из импортов. `@codda/test` встроен в Runtime. Нужно ли объявлять `@types/*` — решает тикет 08; если нужно, они пишутся в тот же map.
- Instructions: CommonMark + GFM, raw HTML выводится как текст, картинки (`![…](…)`) — ошибка, внешние ссылки разрешены.
- Валидация — Zod-схема в коде, из неё выводятся TS-типы. Кросс-файловые правила живут там же. Неизвестные поля в YAML — ошибка. Лишние файлы в папке Lesson пока не проверяем.
- Ошибки манифеста в `codda test`: собираются все ошибки по всему Course, одна строка на ошибку — `<файл от корня Course>: <путь к полю>: <сообщение>`, по-русски, код выхода ненулевой. Lesson с невалидным манифестом не собирается и не тестируется, остальные проверяются. Общий формат вывода CLI решает тикет 05.

**Миграция React Hooks** (отдельный тикет фичи `lesson-manifest`, руками): `course.yaml` как в примере выше; папки `use-state`, `use-effect`, `use-ref`, `use-reducer`, `use-context`; `title` без префикса «React Hooks N/5:»; в тестах `./App` → `./main`. Удаляются `courses/index.ts`, `courses/react-hooks/*.ts`, параметр `?lesson=` в `src/main.tsx` и PoC-задание `src/lesson.ts`. `courses/courses.test.ts` заменяет проверка «Solution проходит тесты» в `codda test`.
