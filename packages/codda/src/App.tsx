import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Editor, type EditorHandle } from "./Editor";
import type { BrokenLesson, CourseData, LessonData } from "./course-data";
import { run, type ConsoleLine, type TestReport } from "./runtime/runner";
import type { CompileError, TestResult } from "./runtime/types";
import {
  onTypeCheckerStatus,
  typeChecker,
  typeCheckerStatus,
  type TypeCheckerStatus,
  type TypeError,
} from "./type-checker/client";
import { courseStorage, type CourseStorage } from "./storage";
import "./styles.css";

const NO_ERRORS: CompileError[] = [];

/**
 * A Run of `source` against the Lesson Tests of `lesson`: the one path from a
 * Lesson to the Compiler, for «Запустить тесты» and for `codda test` (main.tsx).
 */
export function runLesson(course: CourseData, lesson: LessonData, source: string, options?: Parameters<typeof run>[1]) {
  // The artifact's folder in course.json is relative to the page (ADR-0008).
  const importMap = course.deps === null ? undefined : new URL(`${course.deps}importmap.json`, document.baseURI).href;
  return run(
    { source, sourceName: lesson.workspace.name, tests: lesson.tests, testsName: lesson.testsName, importMap },
    options,
  );
}

/**
 * The session's Type Checker, with types.json of the same Dependency Artifact
 * as the Compiler's. The first call starts it: after the Lesson screen is drawn.
 */
function sessionTypeChecker(course: CourseData) {
  return typeChecker(course.deps === null ? undefined : new URL(`${course.deps}types.json`, document.baseURI).href);
}

/** `#/<lesson id>` → the id; no fragment, `#/` or a broken escape → undefined. */
function lessonIdFromHash(): string | undefined {
  if (!location.hash.startsWith("#/") || location.hash.length === 2) return undefined;
  try {
    return decodeURIComponent(location.hash.slice(2));
  } catch {
    return undefined;
  }
}

function onHashChange(update: () => void) {
  window.addEventListener("hashchange", update);
  return () => window.removeEventListener("hashchange", update);
}

/** Every move to another Lesson: a new fragment, a new history entry, no page load. */
const go = (lessonId: string) => (location.hash = `#/${encodeURIComponent(lessonId)}`);

/**
 * The Lesson screen of `course`. The Lesson is the one in the fragment
 * `#/<lesson id>`, and follows it; no Lesson or an unknown id there opens the
 * first one not passed (all passed — the first) and puts its id in the
 * fragment in place of the old one.
 */
export function App({ course }: { course: CourseData }) {
  const lessonId = useSyncExternalStore(onHashChange, lessonIdFromHash);
  // All Lessons of all Modules in the order of course.yaml: the Course's one order.
  const lessons = course.modules.flatMap((m) => m.lessons);
  // One for the page: the Workspaces and marks it could not save live in it until a reload.
  const storage = useMemo(() => courseStorage(course.id), [course.id]);
  // Read anew on each new mark «пройден».
  useSyncExternalStore(storage.subscribe, storage.version);
  const passed = new Set(lessons.filter((l) => storage.passed(l.id)).map((l) => l.id));
  const found = lessons.findIndex((l) => l.id === lessonId);
  const index = found >= 0 ? found : Math.max(lessons.findIndex((l) => !passed.has(l.id)), 0);
  const lesson = lessons[index] as LessonData | BrokenLesson | undefined;
  // Collapsed until the student expands it again or the page reloads.
  const [treeOpen, setTreeOpen] = useState(true);

  useEffect(() => {
    if (lesson && lesson.id !== lessonId) history.replaceState(null, "", `#/${encodeURIComponent(lesson.id)}`);
  }, [lesson, lessonId]);

  // Only in the course.json of `codda dev`: course.yaml or the Course is broken.
  if (course.errors) return <Errors title="Ошибки в курсе" errors={course.errors} />;
  if (!lesson) return null;
  if ("errors" in lesson) return <Errors title={`Ошибки в Lesson ${lesson.id}`} errors={lesson.errors} />;
  return (
    <Lesson
      key={lesson.id}
      course={course}
      lesson={lesson}
      storage={storage}
      tree={<CourseTree course={course} current={lesson.id} passed={passed} open={treeOpen} onToggle={() => setTreeOpen(!treeOpen)} />}
      previous={lessons[index - 1]?.id}
      next={lessons[index + 1]?.id}
    />
  );
}

/**
 * The Course on the left of the Lesson: its title, «Пройдено N из M» with a
 * bar, its Modules and their Lessons in the order of course.yaml, each a link
 * to `#/<lesson id>`, ✓ at the passed ones. Collapsed, a narrow strip with the
 * button to expand it.
 */
function CourseTree({
  course,
  current,
  passed,
  open,
  onToggle,
}: {
  course: CourseData;
  current: string;
  /** The ids of the passed Lessons of this Course. */
  passed: Set<string>;
  open: boolean;
  onToggle: () => void;
}) {
  if (!open)
    return (
      <nav className="course-tree collapsed" aria-label="Уроки курса">
        <button className="tree-toggle" aria-label="Развернуть список уроков" title="Развернуть список уроков" onClick={onToggle}>
          »
        </button>
      </nav>
    );
  return (
    <nav className="course-tree" aria-label="Уроки курса">
      <div className="tree-head">
        <button className="tree-toggle" aria-label="Свернуть список уроков" title="Свернуть список уроков" onClick={onToggle}>
          «
        </button>
        <h2>{course.title}</h2>
      </div>
      <Progress passed={passed.size} total={course.modules.reduce((n, m) => n + m.lessons.length, 0)} />
      {course.modules.map((module, i) => (
        <div key={i} className="tree-module">
          <h3>{module.title}</h3>
          <ol aria-label={module.title}>
            {module.lessons.map((l) => (
              <li key={l.id}>
                <a href={`#/${encodeURIComponent(l.id)}`} aria-current={l.id === current ? "page" : undefined}>
                  {l.title}
                  {/* Drawn left of the title; read after it: «<title> пройден». */}
                  {passed.has(l.id) && (
                    <>
                      {" "}
                      <span className="passed" role="img" aria-label="пройден">
                        ✓
                      </span>
                    </>
                  )}
                </a>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </nav>
  );
}

function Progress({ passed, total }: { passed: number; total: number }) {
  return (
    <div className="progress">
      <p>
        Пройдено {passed} из {total}
      </p>
      <progress value={passed} max={total} aria-label="Прогресс курса" />
    </div>
  );
}

/** `codda dev`: the manifest errors in place of a Lesson or of the whole Course. */
function Errors({ title, errors }: { title: string; errors: string[] }) {
  return (
    <main className="errors">
      <h1>{title}</h1>
      <ul>
        {errors.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      <p className="muted">Исправьте файлы курса — страница обновится сама.</p>
    </main>
  );
}

/**
 * One Lesson from a clean slate; another Lesson is another instance (`key`),
 * so the Run going when it is left is cancelled with it.
 */
function Lesson({
  course,
  lesson,
  storage,
  tree,
  previous,
  next,
}: {
  course: CourseData;
  lesson: LessonData;
  /** Where the Workspace comes from when the Lesson opens and goes on each edit. */
  storage: CourseStorage;
  /** The Course tree, left of the Instructions. */
  tree: ReactNode;
  /** The ids of the Lessons before and after this one in the Course; none at its ends. */
  previous?: string;
  next?: string;
}) {
  // Read once: the editor starts from it, later edits go from the editor to the storage.
  const [initialWorkspace] = useState(() => storage.workspace(lesson));
  const [source, setSource] = useState(initialWorkspace);
  // After the read above: an error of that read shows in the same render.
  const storageFailed = useSyncExternalStore(storage.subscribe, storage.failed);
  const [report, setReport] = useState<TestReport>();
  const [running, setRunning] = useState(false);
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([]);
  // Underlined in the Workspace until the first edit or the next Run.
  const [underlined, setUnderlined] = useState(NO_ERRORS);
  const [tab, setTab] = useState<"tests" | "console" | "problems" | "solution">("tests");
  // The Workspace's type errors; none until its first check is done.
  const [typeErrors, setTypeErrors] = useState<TypeError[]>();
  const typeStatus = useSyncExternalStore(onTypeCheckerStatus, typeCheckerStatus);
  const workspace = useRef<EditorHandle>(null);
  const cancel = useRef<AbortController>(null);
  // Edited since the Run started: the compile errors no longer match the text.
  const editedDuringRun = useRef(false);

  useEffect(() => {
    document.title = `${lesson.title} — ${course.title}`;
  }, [lesson.title, course.title]);

  // Leaving the Lesson cancels its Run, as «■ Отмена» does.
  useEffect(() => () => cancel.current?.abort(), []);

  const onRun = async () => {
    setTab("tests");
    setConsoleLines([]);
    setUnderlined(NO_ERRORS);
    editedDuringRun.current = false;
    setRunning(true);
    cancel.current = new AbortController();
    try {
      const onConsole = (line: ConsoleLine) => setConsoleLines((lines) => [...lines, line]);
      const result = await runLesson(course, lesson, source, { signal: cancel.current.signal, onConsole });
      setReport(result);
      // This Lesson's own Run: leaving the Lesson cancels it, so its PASS never marks another one.
      if (isPass(result)) storage.markPassed(lesson.id);
      if (result.kind === "compile-error" && !editedDuringRun.current) setUnderlined(result.errors);
      // The student may have opened «Console» while the Run went.
      setTab("tests");
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="lesson">
      {tree}
      <h1>
        {course.title} · {lesson.title}
      </h1>
      <section className="instructions" aria-labelledby="instructions-title">
        <h2 id="instructions-title">Instructions</h2>
        {/* HTML from `codda build`: raw HTML of the Markdown is already escaped there. */}
        <div className="markdown" dangerouslySetInnerHTML={{ __html: lesson.instructions }} />
      </section>
      <section className="work">
        <div className="toolbar">
          {running ? (
            <button className="btn" onClick={() => cancel.current!.abort()}>
              ■ Отмена
            </button>
          ) : (
            <button className="btn primary" onClick={onRun}>
              ▶ Запустить тесты
            </button>
          )}
          <button className="btn" onClick={() => workspace.current!.replaceAll(lesson.workspace.starter)}>
            ↺ Сбросить
          </button>
          <button className="btn" onClick={() => setTab("solution")}>
            Показать решение
          </button>
          <span className="spacer" />
          <button className="btn" disabled={previous === undefined} onClick={() => go(previous!)}>
            ← Предыдущий
          </button>
          <button className="btn" disabled={next === undefined} onClick={() => go(next!)}>
            Следующий →
          </button>
        </div>
        <div className="workspace">
          {storageFailed && (
            <p className="storage-warning" role="status">
              Код и прогресс не сохраняются: хранилище браузера недоступно или переполнено
            </p>
          )}
          <h2 className="file">{lesson.workspace.name}</h2>
          <Editor
            ref={workspace}
            label={lesson.workspace.name}
            initialValue={initialWorkspace}
            onChange={(value) => {
              storage.saveWorkspace(lesson, value);
              setSource(value);
              setUnderlined(NO_ERRORS);
              editedDuringRun.current = true;
            }}
            errors={underlined}
            typeCheck={(text) => sessionTypeChecker(course).diagnostics(lesson.workspace.name, text)}
            complete={(text, pos) => sessionTypeChecker(course).completions(lesson.workspace.name, text, pos)}
            onTypeErrors={setTypeErrors}
            typeCheckStatus={typeStatus}
          />
        </div>
        <div className="panel">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === "tests"} onClick={() => setTab("tests")}>
              Тесты
              {report && <Counter report={report} />}
            </button>
            <button role="tab" aria-selected={tab === "console"} onClick={() => setTab("console")}>
              Console
              {consoleLines.length > 0 && <span className="badge count">{consoleLines.length}</span>}
            </button>
            <button role="tab" aria-selected={tab === "problems"} onClick={() => setTab("problems")}>
              Проблемы
              {typeStatus !== "unavailable" && (
                <span className="badge count">{typeStatus === "ready" && typeErrors ? typeErrors.length : "…"}</span>
              )}
            </button>
            <button role="tab" aria-selected={tab === "solution"} onClick={() => setTab("solution")}>
              Решение
            </button>
          </div>
          <div className="tab-body" role="tabpanel">
            {tab === "solution" ? (
              <Editor label="Решение" initialValue={lesson.solution} readOnly />
            ) : tab === "console" ? (
              <Console lines={consoleLines} />
            ) : tab === "problems" ? (
              <Problems status={typeStatus} errors={typeErrors} onPick={(pos) => workspace.current!.goTo(pos)} />
            ) : report ? (
              <Report report={report} next={next} />
            ) : (
              <p className="muted">Нажмите „Запустить тесты“</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

const passedOf = (results: TestResult[]) => results.filter((r) => r.status === "pass").length;
/** At least one test, all passed. No tests is not a PASS. */
const allPass = (results: TestResult[]) => results.length > 0 && passedOf(results) === results.length;
const isPass = (report: TestReport) => report.kind === "tests" && allPass(report.results);

/** The result of the last Run on the «Тесты» tab, seen from any tab. */
function Counter({ report }: { report: TestReport }) {
  if (report.kind === "cancelled") return null;
  if (report.kind !== "tests") return <span className="badge bad">✗</span>;
  const passed = passedOf(report.results);
  const ok = allPass(report.results);
  return (
    <span className={`badge ${ok ? "ok" : "bad"}`}>
      {passed}/{report.results.length}
    </span>
  );
}

/** The Console of the last Run: lines from the Sandbox, shown as text. */
function Console({ lines }: { lines: ConsoleLine[] }) {
  if (lines.length === 0) return <p className="muted">Нет вывода</p>;
  return (
    <ul className="console" aria-label="Console">
      {lines.map((line, i) => (
        <li key={i} className={line.level}>
          {line.text}
        </li>
      ))}
    </ul>
  );
}

/** The «Проблемы» tab: the Workspace's type errors; a click on one goes to it in the editor. */
function Problems({
  status,
  errors,
  onPick,
}: {
  status: TypeCheckerStatus;
  errors?: TypeError[];
  onPick: (pos: number) => void;
}) {
  if (status === "unavailable") return <p className="muted">Проверка типов недоступна</p>;
  if (status === "loading" || !errors) return <p className="muted">Проверка типов загружается</p>;
  if (errors.length === 0) return <p className="muted">Проблем нет</p>;
  return (
    <ul className="problems" aria-label="Проблемы">
      {errors.map((e, i) => (
        <li key={i}>
          <button onClick={() => onPick(e.from)}>
            {e.line}:{e.column} — {e.message} (TS{e.code})
          </button>
        </li>
      ))}
    </ul>
  );
}

function Report({ report, next }: { report: TestReport; next?: string }) {
  switch (report.kind) {
    case "tests":
      return <TestResults results={report.results} next={next} />;
    case "compile-error":
      return (
        <BrokenRun title="Ошибка компиляции">
          <ul>
            {report.errors.map((e, i) => (
              <li key={i}>
                {e.line !== undefined && `Строка ${e.line}:${e.column} — `}
                {e.message}
              </li>
            ))}
          </ul>
        </BrokenRun>
      );
    case "runtime-error":
      return (
        <BrokenRun title="Ошибка выполнения">
          <p>{report.message}</p>
        </BrokenRun>
      );
    case "cancelled":
      return (
        <section className="report" aria-label="Test Report">
          <h2>Запуск отменён</h2>
        </section>
      );
    case "timeout":
      return (
        <BrokenRun title={`Тесты не завершились за ${report.ms / 1000} с`}>
          <p>Возможные причины: бесконечный цикл, зависший промис или нехватка памяти.</p>
        </BrokenRun>
      );
    case "internal-error":
      return (
        <BrokenRun title="Внутренняя ошибка">
          <p>{report.message}</p>
          <p>Запустите тесты ещё раз.</p>
        </BrokenRun>
      );
  }
}

/** A Run that produced no test results: compile, runtime or internal error, or timeout. */
function BrokenRun({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="report broken" aria-label="Test Report">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/** `next`: the id of the Lesson after this one; none on the Course's last. */
function TestResults({ results, next }: { results: TestResult[]; next?: string }) {
  const passed = passedOf(results);
  const ok = allPass(results);
  return (
    <section className="report" aria-label="Test Report">
      {ok && (
        <div className="banner">
          <span>Все тесты пройдены</span>
          {next === undefined ? (
            <span className="last">Это последний урок курса</span>
          ) : (
            <button className="btn" onClick={() => go(next)}>
              Следующий урок →
            </button>
          )}
        </div>
      )}
      <ul>
        {results.map((r, i) => (
          <li key={i} className={r.status}>
            {r.status === "pass" ? "✓" : "✗"} {r.name}
            {r.error && ` — ${r.error}`}
          </li>
        ))}
      </ul>
      <p className={`summary ${ok ? "ok" : "bad"}`}>
        {ok ? "PASS" : "FAIL"} · {passed} / {results.length}
      </p>
    </section>
  );
}
