import { useEffect, useRef, useState, type ReactNode } from "react";
import { Editor, type EditorHandle } from "./Editor";
import type { CourseData, LessonData } from "./course-data";
import { run, type TestReport } from "./runtime/runner";
import type { TestResult } from "./runtime/types";
import "./styles.css";

/**
 * The Lesson screen for `lessonId` of `course`; without an id, the first
 * Lesson of the first Module. Another id opens that Lesson from a clean slate.
 */
export function App({ course, lessonId }: { course: CourseData; lessonId?: string }) {
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
  return <Lesson key={lesson.id} course={course} lesson={lesson} />;
}

function Lesson({ course, lesson }: { course: CourseData; lesson: LessonData }) {
  const [source, setSource] = useState(lesson.workspace.starter);
  const [report, setReport] = useState<TestReport>();
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<"tests" | "solution">("tests");
  const workspace = useRef<EditorHandle>(null);
  const cancel = useRef<AbortController>(null);

  useEffect(() => {
    document.title = `${lesson.title} — ${course.title}`;
  }, [lesson.title, course.title]);

  const onRun = async () => {
    setTab("tests");
    setRunning(true);
    cancel.current = new AbortController();
    try {
      setReport(await run({ source, tests: lesson.tests }, { signal: cancel.current.signal }));
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
            onChange={setSource}
          />
        </div>
        <div className="panel">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === "tests"} onClick={() => setTab("tests")}>
              Тесты
              {report && <Counter report={report} />}
            </button>
            <button role="tab" aria-selected={tab === "solution"} onClick={() => setTab("solution")}>
              Решение
            </button>
          </div>
          <div className="tab-body" role="tabpanel">
            {tab === "solution" ? (
              <Editor label="Решение" initialValue={lesson.solution} readOnly />
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
          <pre>{report.stack ?? report.message}</pre>
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
        <BrokenRun title={`Превышено время: ${report.ms / 1000} с`}>
          <p>Выполнение остановлено. Проверьте, нет ли в коде бесконечного цикла.</p>
        </BrokenRun>
      );
  }
}

/** A Run that produced no test results: compile error, runtime error or timeout. */
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
