# 01b: UI читает `course.json`, e2e и выкладка на сборке `codda build`, PoC-формат удалён

**What to build:** вторая половина нового формата. UI при старте загружает `course.json` и открывает первый Lesson или Lesson из `#/<id>`. Студент правит `main.tsx`, жмёт Run и получает PASS. PoC-формат удалён, UI больше не импортирует `courses/`. `npm run dev` работает через middleware с модулем чтения Course, e2e идут на настоящей сборке `codda build`, пилот выкладывается из неё. Экран пока остаётся PoC-шным (английский Test Report, Instructions простым текстом): его переделывают тикеты 03 и 04.

Подробности — в [spec.md](../spec.md): «UI → Загрузка, Выбор Lesson», «Runtime», «Разработка инструмента и e2e».

**Blocked by:** 01a

**Status:** done

**Runtime и удаление PoC-формата**

- [x] Compiler отдаёт Workspace Lesson Tests как `./main`; тест Runner на это
- [x] Удалены `courses/index.ts`, `courses/react-hooks/*.ts`, `courses/courses.test.ts`, PoC-задание Counter и параметр `?lesson=`
- [x] Тесты Runner и UI, которые брали PoC-задание, держат свои мини-Lesson прямо в тесте

**UI**

- [x] UI загружает `course.json` относительно страницы с `cache: "no-cache"`, пока грузится — «Загрузка курса…»
- [x] Без фрагмента открывается первый Lesson; `#/<id>` открывает этот Lesson; `hashchange` открывает другой Lesson с чистого листа (Starter, без Test Report)
- [x] Неизвестный id → «Урок „<id>“ не найден» и ссылка на первый Lesson
- [x] `course.json` не загрузился (сеть или не-2xx) → «Не удалось загрузить курс» и кнопка «Обновить»
- [x] В шапке и в `document.title` — название Lesson и Course; над редактором — имя файла Workspace
- [x] Instructions показываются как текст с сохранением переносов (Markdown — тикет 04)

**Разработка, e2e, CI**

- [x] `npm run dev`: Vite с HMR UI, `course.json` отдаёт middleware через модуль чтения Course для курса из переменной окружения; путь `courses/react-hooks` задаёт только скрипт корня. Ошибки Course → 500 с теми же строками
- [x] `npm run test:e2e`: сборка UI → `codda build` курса React Hooks → Playwright; основной проект открывает эту сборку из подпути `/codda/`, проект `dev` — один smoke-тест (Lesson открывается, Solution даёт PASS)
- [x] e2e: Solution каждого Lesson из собранного `course.json` даёт PASS по всем тестам, офлайн
- [x] e2e: `#/use-effect` открывает этот Lesson; неизвестный id; 404 на `course.json` (через `route`) показывает «Не удалось загрузить курс»
- [x] `golden-path.e2e.ts` и `sandbox-isolation.e2e.ts` переведены на Lesson `use-state`
- [ ] CI выкладывает на Pages выход `codda build`, который проверил e2e (без пересборки) — `ci.yml` переключён на `courses/react-hooks/dist/`; подтвердить — после merge PR #6 (выкладка только на push в `main`)
- [x] `npm run typecheck`, `npm test`, `npm run test:e2e` зелёные; `npm run dev` вручную открывает `use-state`

## Comments

- **2026-10-04 — реализация (агент).**
  - **Runtime.** `compiler.worker.ts` отдаёт Workspace как `./main`. `runner.test.ts` импортирует `./main` везде, PoC-тест Counter заменён мини-Lesson `Toggle` на React прямо в тесте (red: 10 падений «Cannot resolve "./main"» → green).
  - **PoC-формат удалён:** `courses/index.ts`, `courses/react-hooks/0*.ts`, `courses/courses.test.ts`, `packages/codda/src/lesson.ts`, параметр `?lesson=`. Браузерный проект Vitest снова смотрит только в `src/` пакета (`dir: "../.."` убран).
  - **UI.** `App({ course, lessonId })` — шов из спеки: без id первый Lesson первого Module, неизвестный id → «Урок „<id>“ не найден» и ссылка `#/<первый>`; Lesson рисуется с `key={lesson.id}`, поэтому другой id — чистый лист (Starter, без Test Report). Шапка `<Course> · <Lesson>`, `document.title` = `<Lesson> — <Course>`, над редактором `workspace.name`. Instructions — текст с `white-space: pre-wrap`. `main.tsx` — загрузка `course.json` (`fetch("course.json", { cache: "no-cache" })`, относительно страницы): «Загрузка курса…», при сети/не-2xx/битом JSON «Не удалось загрузить курс» и «Обновить» (`location.reload()`); `hashchange` меняет id. Test Report пока английский (тикет 03).
  - **`styles.css` импортирует `App.tsx`, а не `main.tsx`:** иначе браузерные тесты экрана идут без CSS и перенос строк в Instructions не проверить.
  - **`npm run dev`.** Плагин `codda-course-json` в `vite.config.ts`: на каждый запрос `/course.json` вызывает `readCourse` для `CODDA_COURSE`; нет переменной, нет `course.yaml` или ошибки Course → 500, текст — те же строки, что у `codda build`. Корневой скрипт: `CODDA_COURSE="$PWD/courses/react-hooks"` (POSIX-shell). `vite.config.ts` теперь импортирует Node-код, поэтому проверяется `cli/tsconfig.json`, а не браузерным `tsconfig.json`. Тест — `cli/dev-server.test.ts`: настоящий `createServer` Vite на временном Course (200 и подхват правки без перезапуска, 500 на ошибку Course, на отсутствие `course.yaml`, на отсутствие `CODDA_COURSE`).
  - **e2e.** `test:e2e` = `npm run build && codda build courses/react-hooks && playwright test`; Course Build лежит в `--out` по умолчанию `courses/react-hooks/dist/` (уже в `.gitignore` как `dist/`), проект `pages` отдаёт его `vite preview --outDir` из `/codda/`. Проект `dev` запускает корневой `npm run dev` и гоняет только `e2e/dev.e2e.ts` (smoke: `use-state` открывается, Solution → 3/3). Новый `e2e/course.e2e.ts`: Solution каждого Lesson из собранного `course.json` → PASS (перебор через `#/<id>` на одной странице, заодно проверяет `hashchange` и чистый лист), `#/use-effect`, неизвестный id и переход по ссылке, «Загрузка курса…» (задержанный `route`), 404 и обрыв сети + «Обновить». `golden-path` и `sandbox-isolation` переведены на `use-state`, Starter/Solution берут из `course.json` сервера.
  - **CI:** `upload-pages-artifact` берёт `courses/react-hooks/dist/` — ровно ту сборку, что проверил e2e в том же job.
  - **README** обновлён: сценарий на `use-state`, `#/<id>`, `test:e2e`, новые тесты, раскладка `src/`.
  - **«`npm run dev` вручную»** проверен запуском скрипта и запросом `course.json` (пять Lesson); в браузере `use-state` открывает и проходит smoke-тест `dev.e2e.ts`.
  - **TDD-оговорка:** e2e загрузки и выбора Lesson написаны после `main.tsx`, красными их не видел; App-тесты, тесты Runner и dev-сервера — red → green.
  - **Находки вне критериев:** Starter `use-state` проходит 2 из 3 тестов («is closed at first» и «closes on second click» зелёные на кнопке без обработчика) — слабые Lesson Tests, к `pilot-course`. `codda build` не чистит `--out`, поэтому в локальном `courses/react-hooks/dist/` копятся старые `assets/*` от прошлых сборок UI (в CI checkout чистый) — очистку делает `author-cli`.
