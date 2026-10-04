# 01b: UI читает `course.json`, e2e и выкладка на сборке `codda build`, PoC-формат удалён

**What to build:** вторая половина нового формата. UI при старте загружает `course.json` и открывает первый Lesson или Lesson из `#/<id>`. Студент правит `main.tsx`, жмёт Run и получает PASS. PoC-формат удалён, UI больше не импортирует `courses/`. `npm run dev` работает через middleware с модулем чтения Course, e2e идут на настоящей сборке `codda build`, пилот выкладывается из неё. Экран пока остаётся PoC-шным (английский Test Report, Instructions простым текстом): его переделывают тикеты 03 и 04.

Подробности — в [spec.md](../spec.md): «UI → Загрузка, Выбор Lesson», «Runtime», «Разработка инструмента и e2e».

**Blocked by:** 01a

**Status:** ready-for-agent

**Runtime и удаление PoC-формата**

- [ ] Compiler отдаёт Workspace Lesson Tests как `./main`; тест Runner на это
- [ ] Удалены `courses/index.ts`, `courses/react-hooks/*.ts`, `courses/courses.test.ts`, PoC-задание Counter и параметр `?lesson=`
- [ ] Тесты Runner и UI, которые брали PoC-задание, держат свои мини-Lesson прямо в тесте

**UI**

- [ ] UI загружает `course.json` относительно страницы с `cache: "no-cache"`, пока грузится — «Загрузка курса…»
- [ ] Без фрагмента открывается первый Lesson; `#/<id>` открывает этот Lesson; `hashchange` открывает другой Lesson с чистого листа (Starter, без Test Report)
- [ ] Неизвестный id → «Урок „<id>“ не найден» и ссылка на первый Lesson
- [ ] `course.json` не загрузился (сеть или не-2xx) → «Не удалось загрузить курс» и кнопка «Обновить»
- [ ] В шапке и в `document.title` — название Lesson и Course; над редактором — имя файла Workspace
- [ ] Instructions показываются как текст с сохранением переносов (Markdown — тикет 04)

**Разработка, e2e, CI**

- [ ] `npm run dev`: Vite с HMR UI, `course.json` отдаёт middleware через модуль чтения Course для курса из переменной окружения; путь `courses/react-hooks` задаёт только скрипт корня. Ошибки Course → 500 с теми же строками
- [ ] `npm run test:e2e`: сборка UI → `codda build` курса React Hooks → Playwright; основной проект открывает эту сборку из подпути `/codda/`, проект `dev` — один smoke-тест (Lesson открывается, Solution даёт PASS)
- [ ] e2e: Solution каждого Lesson из собранного `course.json` даёт PASS по всем тестам, офлайн
- [ ] e2e: `#/use-effect` открывает этот Lesson; неизвестный id; 404 на `course.json` (через `route`) показывает «Не удалось загрузить курс»
- [ ] `golden-path.e2e.ts` и `sandbox-isolation.e2e.ts` переведены на Lesson `use-state`
- [ ] CI выкладывает на Pages выход `codda build`, который проверил e2e (без пересборки)
- [ ] `npm run typecheck`, `npm test`, `npm run test:e2e` зелёные; `npm run dev` вручную открывает `use-state`
