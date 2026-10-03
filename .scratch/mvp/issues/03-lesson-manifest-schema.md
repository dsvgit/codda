# 03: Схема Lesson Manifest и файловая структура Course

Type: grilling
Status: open
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
