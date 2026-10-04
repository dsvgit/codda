# codda

Платформа интерактивных курсов: студент решает задания по программированию прямо в браузере, а платформа проверяет решение автоматическими тестами.

## Language

### Учебный контент

**Course**:
Упорядоченный набор Module по одной теме. Это папка с `course.yaml` (`id`, название, Module и порядок Lesson в них) и `package.json` + `package-lock.json` с зависимостями, общими для всех Lesson.
_Avoid_: программа, трек

**Module**:
Группа Lesson внутри Course. Существует только как запись в `course.yaml`, своей папки у Module нет.
_Avoid_: раздел, глава

**Lesson**:
Одно задание: Instructions + Starter + Lesson Tests + Solution. Своих зависимостей у Lesson нет, он пользуется зависимостями Course. Папка внутри Course. Имя папки — id Lesson, по нему хранятся прогресс и Workspace.
_Avoid_: exercise, задача, challenge, урок-страница

**Instructions**:
Текст задания, который студент читает перед решением.
_Avoid_: описание, README

**Starter**:
Исходные файлы Lesson, с которых студент начинает работу. В MVP это один файл `main.ts` или `main.tsx`; Lesson Tests импортируют его как `./main`.
_Avoid_: шаблон, boilerplate, заготовка

**Solution**:
Эталонное решение Lesson, которое гарантированно проходит все Lesson Tests.
_Avoid_: ответ, reference

**Lesson Tests**:
Автоматические проверки, по которым решение студента получает PASS или FAIL.
_Avoid_: checks, assertions, грейдер-тесты

**Hidden Tests**:
Lesson Tests, которые не отдаются в браузер и выполняются только Server Grader.
_Avoid_: секретные тесты

**Lesson Manifest**:
Машиночитаемое описание Lesson — контракт между авторингом, CI и Runtime. Это не отдельный файл. Lesson Manifest складывается из frontmatter `lesson.md` (`title`), записи Lesson в `course.yaml` и файлов Lesson, найденных по соглашению об именах (`main.*`, `solution.*`, `lesson.test.*`).
_Avoid_: config, lesson.json (как название понятия)

### Работа студента

**Workspace**:
Текущие файлы студента для конкретного Lesson (изначально — копия Starter). Сохраняется в браузере при каждой правке; Workspace, совпадающий со Starter, не хранится.
_Avoid_: проект, sandbox

**Run**:
Одно нажатие «▶ Запустить тесты»: компиляция Workspace + Lesson Tests и их выполнение. Run можно отменить кнопкой «■ Отмена».
_Avoid_: запуск, execution, submit

**Submit**:
Отправка решения на Server Grader для окончательной проверки (в т.ч. Hidden Tests).
_Avoid_: Run (это разные вещи)

**Test Report**:
Результат Run: список тестов со статусами и ошибками, либо ошибка компиляции, runtime-ошибка, timeout, отмена Run или внутренняя ошибка Runtime. Строку указывает только ошибка компиляции в файле Workspace.
_Avoid_: results, output

**Console**:
Вывод `console.*` из Sandbox за один Run: код студента, Lesson Tests и зависимости. Показывается во вкладке «Console», не больше 1000 строк за Run.
_Avoid_: лог, output, stdout

**Progress**:
Множество пройденных Lesson Course у одного студента. Lesson пройден, когда хотя бы один Run дал PASS по всем Lesson Tests; Reset и последующий FAIL отметку не снимают. В MVP хранится в браузере (`localStorage`) по ключу `<course id>/<lesson id>`.
_Avoid_: score, оценка, completion

### Исполнение

**Runtime**:
Наша браузерная среда исполнения: Compiler + Sandbox + Test Harness.
_Avoid_: sandbox (как синоним целого), engine

**Compiler**:
Часть Runtime, превращающая TS/TSX Workspace и Lesson Tests в исполняемый JS.
_Avoid_: bundler, transpiler, build

**Sandbox**:
Изолированный iframe, в котором исполняется скомпилированный код студента.
_Avoid_: preview, frame, песочница

**Test Harness**:
Код внутри Sandbox, который выполняет Lesson Tests и формирует Test Report.
_Avoid_: test runner, jest

**Type Checker**:
Web Worker с TypeScript language service: diagnostics и autocomplete в редакторе. В браузере видит только файл Workspace, без Lesson Tests. Тот же код проверки типов работает в `codda test` (в Node). В Runtime не входит, Run не блокирует и на оценку не влияет. См. ADR-0009.
_Avoid_: linter, LSP, language server

**Dependency Artifact**:
Неизменяемая browser-ready сборка `dependencies` Course по его `package-lock.json`, которую собирает `codda build`: ESM-модули, `importmap.json` и `types.json`. Один на Course, лежит в `deps/<hash>/`, `course.json` ссылается на него полем `deps`. См. ADR-0007.
_Avoid_: vendor, CDN-пакет, node_modules

**Точка входа** (entry point):
Specifier пакета, который импортирует хотя бы один Starter, Solution или Lesson Tests Course. Только точки входа попадают в Dependency Artifact, и только их может импортировать студент.
_Avoid_: entry, export, subpath (как синоним)

**Server Grader**:
Будущий серверный исполнитель решений для Submit и Hidden Tests.
_Avoid_: judge, backend runner

### Авторинг

**Author**:
Человек, создающий Lesson как файлы в Git.
_Avoid_: преподаватель, контент-менеджер

**Course Build** (сборка Course):
Папка статических файлов, которую выдаёт `codda build`: готовый UI, `course.json` и Dependency Artifact в `deps/<hash>/`, с маркером `.codda-build`. Её выкладывают на хостинг, её же проверяют `codda test` и e2e и раздаёт `codda dev`. Одна сборка — один Course (ADR-0008).
_Avoid_: dist, бандл, билд

**Pilot** (пилот):
Прохождение Course внутренними пользователями на постоянном адресе (GitHub Pages) в Chrome перед итогом MVP. Progress привязан к origin, поэтому адрес не меняется до конца пилота.
_Avoid_: бета, демо

**Golden Path**:
Единственный сквозной сценарий «открыть Lesson → изменить код → Run → PASS», доказывающий техническую гипотезу.
_Avoid_: MVP, демо
