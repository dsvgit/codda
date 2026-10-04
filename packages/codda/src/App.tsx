import { useEffect, useRef, useState, type ReactNode } from "react";
import { Editor, type EditorHandle } from "./Editor";
import type { CourseData, LessonData } from "./course-data";
import { run, type ConsoleLine, type TestReport } from "./runtime/runner";
import type { CompileError, TestResult } from "./runtime/types";
import { typeChecker } from "./type-checker/client";
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
 * The type errors of the Workspace `text` of `lesson`, from the session's Type
 * Checker with types.json of the same Dependency Artifact as the Compiler's.
 * The first call starts it: after the Lesson screen is drawn.
 */
function typeCheck(course: CourseData, lesson: LessonData, text: string) {
  const types = course.deps === null ? undefined : new URL(`${course.deps}types.json`, document.baseURI).href;
  return typeChecker(types).diagnostics(lesson.workspace.name, text);
}

/**
 * The Lesson screen for `lessonId` of `course`; without an id, the first
 * Lesson of the first Module. Another id opens that Lesson from a clean slate.
 */
export function App({ course, lessonId }: { course: CourseData; lessonId?: string }) {
  // Only in the course.json of `codda dev`: course.yaml or the Course is broken.
  if (course.errors) return <Errors title="Ошибки в курсе" errors={course.errors} />;
  const lessons = course.modules.flatMap((m) => m.lessons);
  const first = lessons[0];
  const lesson = lessonId === undefined ? first : lessons.find((l) => l.id === lessonId);

  if (!lesson) {
    return (
      <main className="lesson">
        <p>Урок „{lessonId}“ не найден</p>
        <p>
          Первый урок курса: <a href={`#/${first.id}`}>{first.title}</a>
        </p>
      </main>
    );
  }
  if ("errors" in lesson) return <Errors title={`Ошибки в Lesson ${lesson.id}`} errors={lesson.errors} />;
  return <Lesson key={lesson.id} course={course} lesson={lesson} />;
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

function Lesson({ course, lesson }: { course: CourseData; lesson: LessonData }) {
  const [source, setSource] = useState(lesson.workspace.starter);
  const [report, setReport] = useState<TestReport>();
  const [running, setRunning] = useState(false);
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([]);
  // Underlined in the Workspace until the first edit or the next Run.
  const [underlined, setUnderlined] = useState(NO_ERRORS);
  const [tab, setTab] = useState<"tests" | "console" | "solution">("tests");
  const workspace = useRef<EditorHandle>(null);
  const cancel = useRef<AbortController>(null);
  // Edited since the Run started: the compile errors no longer match the text.
  const editedDuringRun = useRef(false);

  useEffect(() => {
    document.title = `${lesson.title} — ${course.title}`;
  }, [lesson.title, course.title]);

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
      if (result.kind === "compile-error" && !editedDuringRun.current) setUnderlined(result.errors);
      // The student may have opened «Console» while the Run went.
      setTab("tests");
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="lesson">
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
        </div>
        <div className="workspace">
          <h2 className="file">{lesson.workspace.name}</h2>
          <Editor
            ref={workspace}
            label={lesson.workspace.name}
            initialValue={lesson.workspace.starter}
            onChange={(value) => {
              setSource(value);
              setUnderlined(NO_ERRORS);
              editedDuringRun.current = true;
            }}
            errors={underlined}
            typeCheck={(text) => typeCheck(course, lesson, text)}
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
            <button role="tab" aria-selected={tab === "solution"} onClick={() => setTab("solution")}>
              Решение
            </button>
          </div>
          <div className="tab-body" role="tabpanel">
            {tab === "solution" ? (
              <Editor label="Решение" initialValue={lesson.solution} readOnly />
            ) : tab === "console" ? (
              <Console lines={consoleLines} />
            ) : report ? (
              <Report report={report} />
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

/** The result of the last Run on the «Тесты» tab, seen from any tab. */
function Counter({ report }: { report: TestReport }) {
  if (report.kind === "cancelled") return null;
  if (report.kind !== "tests") return <span className="badge bad">✗</span>;
  const passed = passedOf(report.results);
  const ok = passed === report.results.length;
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

function Report({ report }: { report: TestReport }) {
  switch (report.kind) {
    case "tests":
      return <TestResults results={report.results} />;
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

function TestResults({ results }: { results: TestResult[] }) {
  const passed = passedOf(results);
  const ok = passed === results.length;
  return (
    <section className="report" aria-label="Test Report">
      {ok && <p className="banner">Все тесты пройдены</p>}
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
