# codda — инструмент автора курсов

Course — это Git-репозиторий с обычными файлами: задание в Markdown, Starter, Solution и Lesson Tests. CLI `codda` проверяет курс, показывает его локально и собирает в папку статических файлов. Её можно выложить на любой статический хостинг. Студент открывает курс в Chrome, правит код и запускает тесты. Код компилируется и исполняется прямо в браузере, без обращений к внешним сервисам.

Образец курса — [`courses/react-hooks/`](../../courses/react-hooks/): 5 Lesson по хукам React в одном Module.

## Требования

- **Node.js 24** (проверено на 24.20) и npm. CLI написан на TypeScript и запускается Node без сборки.
- **Chromium для Playwright 1.63.0.** На нём `codda test` прогоняет тесты. Ставится один раз из корня репозитория `codda`: `npx playwright install chromium`. Если доступа к Internet нет, укажите внутреннее зеркало: `PLAYWRIGHT_DOWNLOAD_HOST=<адрес зеркала> npx playwright install chromium`. Без Chromium `codda test` завершается с кодом `2` и печатает команду установки.
- **npm registry для зависимостей курса.** Его задаёт `.npmrc` курса. В закрытом контуре это внутренний registry.
- **Пакет `codda` пока не опубликован** (тикет [`misc-04-cli-package-publish`](../../.scratch/misc/issues/04-cli-package-publish.md)). Курс подключает его по пути через `"codda": "file:<путь к packages/codda>"` в `devDependencies`, поэтому рядом с курсом нужен checkout репозитория `codda`. `codda init` прописывает этот путь сам.

## Новый курс: `codda init`

```bash
mkdir my-course && cd my-course
node <путь к codda>/packages/codda/cli/codda.ts init            # или init --ci github / --ci gitlab
```

Папка должна быть пустой (можно с `.git`), а её имя — в kebab-case: из него берутся `id` и `title` курса. `init` создаёт `course.yaml` с одним Module «Основы» и Lesson `hello` (название курса потом можно поменять в `title`), а также `package.json` с `codda` в `devDependencies`, `.npmrc` (`save-exact=true`) и `.gitignore`. Затем он запускает `npm install`. После этого все команды вызываются как `npx codda …` из любой папки внутри курса.

`--ci github` добавляет `.github/workflows/codda.yml`, `--ci gitlab` — `.gitlab-ci.yml` (см. «CI» ниже).

## Новый Lesson: `codda lesson`

```bash
npx codda lesson sum-two                       # урок на TypeScript в последний Module
npx codda lesson counter --tsx                 # урок с компонентом React
npx codda lesson counter --module "Основы"     # в Module с этим названием
```

`<id>` пишется в kebab-case. Команда создаёт папку урока из шаблона и дописывает `<id>` в `course.yaml`, сохраняя комментарии. `--module` выбирает уже существующий Module по `title`. Новый Module пока добавляется вручную в `course.yaml`. Для `--tsx` нужны `react` и `react-dom` в `dependencies`:

```bash
npm install react react-dom @types/react @types/react-dom
```

## Файлы курса

```
my-course/
├ course.yaml          id, title, modules → lessons (порядок Lesson — здесь)
├ package.json         зависимости Lesson (точные версии) и codda в devDependencies
├ package-lock.json
└ use-state/           папка Lesson: имя = id из course.yaml
   ├ lesson.md         frontmatter с title + Instructions в Markdown
   ├ main.tsx          Starter: с него студент начинает (main.ts — без JSX)
   ├ solution.tsx      Solution: расширение как у Starter
   └ lesson.test.tsx   Lesson Tests (.ts или .tsx)
```

```yaml
# course.yaml
id: react-hooks
title: React Hooks
modules:
  - title: Хуки
    lessons:
      - use-state
      - use-effect
```

- **`lesson.md`.** Между строками `---` — frontmatter с одним полем `title`, ниже — Instructions в Markdown: заголовки, списки, код, таблицы, ссылки. Внешние ссылки открываются в новой вкладке. Raw HTML показывается как текст. Картинки не поддерживаются, и `codda` выдаёт на них ошибку курса.
- **Starter `main.*`** — недоделанный код. Он должен проваливать хотя бы один тест. Ошибка типов в нём — не ошибка курса, а предупреждение `⚠` (код `0`), но студент увидит подчёркивания с первой секунды, поэтому лучше без них. Студент видит его в редакторе как `main.ts` или `main.tsx`.
- **Solution** — тот же файл, но решённый: он проходит все тесты. Студент открывает его кнопкой «Показать решение».
- **Lesson Tests** импортируют `test` и `expect` из `@codda/test`, код студента — из `./main`, пакеты — как обычно. У `expect` есть `toBe` (`Object.is`) и `toEqual` (структурное сравнение), тесты могут быть `async`. Имена тестов и тексты ошибок студент видит как есть, поэтому пишите их на языке курса.

```ts
import { test, expect } from "@codda/test";
import { sum } from "./main";

test("складывает два числа", () => {
  expect(sum(2, 3)).toBe(5);
});
```

Тесты компонента React — через `act` и `createRoot`, как в шаблоне `--tsx` и в Lesson [`use-state`](../../courses/react-hooks/use-state/lesson.test.tsx).

## Зависимости

Пакеты, которые импортируют Lesson, объявляются в `dependencies` `package.json` курса с точной версией (`npm install <пакет>` с `.npmrc` из `init` пишет точную сама). Нужен и `package-lock.json`. `codda build` и `codda test` собирают из них Dependency Artifact курса: в него попадают только точки входа, импортированные из файлов Lesson. Типы для подсказок в редакторе берутся из пакетов и их `@types/*`. Импорт пакета, которого нет в `dependencies`, или пакета, который использует Node built-in, — ошибка курса. Студенту доступны только те импорты, которые есть в файлах Lesson курса. На любой другой Run покажет «Импорт "…" не предусмотрен заданием».

## Посмотреть курс: `codda dev`

```bash
npx codda dev            # http://127.0.0.1:4173/, --port <n> — другой порт, --port 0 — любой свободный
```

После правки любого файла курса страница перезагружается. Lesson с ошибками показывает их списком, остальные Lesson открываются как обычно. Те же ошибки печатаются в терминале. Ctrl+C останавливает сервер.

## Проверить курс: `codda test`

```bash
npx codda test           # весь курс
npx codda test use-state # один Lesson (или запуск из папки Lesson)
```

Для каждого Lesson `codda test` проверяет:

- файлы Lesson и `course.yaml` (все ошибки за один запуск);
- что Solution проходит все Lesson Tests, а Starter не проходит хотя бы один (в Chromium, как у студента);
- что ни Solution, ни Starter не обращаются к чужим адресам;
- типы: ошибка типов в Solution или в Lesson Tests — ошибка урока, в Starter — предупреждение.

```
Зависимости: deps/f6003b7313d15f6f — из кэша
⚠ hello
  hello/main.ts:2:9 — Type 'number' is not assignable to type 'string'. (TS2322)
✗ sum-two
  sum-two/solution.ts: тест «складывает два числа» не прошёл: expected 5, got -1
✓ counter
2 из 3 Lesson прошли, 1 предупреждение
```

`✓` — Lesson в порядке, `✗` — ошибка (под ней строки с файлом и причиной), `⚠` — только предупреждения. Коды выхода: `0` — ошибок нет (предупреждения допустимы), `1` — ошибки курса, `2` — окружение или вызов (например, нет Chromium). В CI предупреждения Starter лучше не оставлять: студент увидит подчёркивания с первой секунды.

## Собрать курс: `codda build`

```bash
npx codda build          # в <курс>/dist, --out <папка> — в другую
```

В сборке — UI, `course.json`, `deps/<hash>/` и маркер `.codda-build`. Все URL в ней относительные, поэтому её можно отдавать из любого подпути. При ошибке курса команда завершается с кодом `1` и не трогает старую сборку. Непустую папку `--out` `codda build` перезапишет, только если в ней есть маркер `.codda-build`, то есть это прежняя сборка; иначе — код `2`.

Сайт должен открываться по HTTPS или с localhost: браузер проверяет `integrity` зависимостей только в secure context. `.wasm` нужно отдавать с MIME `application/wasm`.

## CI

Шаблон из `codda init --ci …` на каждый PR и push выполняет `npm ci` → `npx codda test` → `npx codda build`. Push в `main` после этого выкладывает тот же `dist/` без пересборки.

- **GitHub** (`.github/workflows/codda.yml`): контейнер Playwright той же версии, что у `codda`, выкладка на GitHub Pages. Один раз включите Settings → Pages → Source: GitHub Actions и branch protection на `main` с проверкой `check`.
- **GitLab** (`.gitlab-ci.yml`): внутренний образ `$CODDA_IMAGE` (Node 24 и Chromium), выкладка `aws s3 sync` в S3. Переменные CI/CD перечислены в начале файла.

Пока пакет `codda` не опубликован, `npm ci` в отдельном репозитории курса не найдёт `codda` по `file:`-пути (тикет [`misc-04-cli-package-publish`](../../.scratch/misc/issues/04-cli-package-publish.md)). Курсы в `courses/` репозитория `codda` проверяет его собственный CI.
