import { useEffect, useState, type ReactNode } from "react";
import { Editor } from "./Editor";
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

  useEffect(() => {
    document.title = `${lesson.title} — ${course.title}`;
  }, [lesson.title, course.title]);

  const onRun = async () => {
    setRunning(true);
    try {
      setReport(await run({ source, tests: lesson.tests }));
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="lesson">
      <h1>
        {course.title} · {lesson.title}
      </h1>
      <div className="panes">
        <section className="instructions">
          <h2>Instructions</h2>
          <p>{lesson.instructions}</p>
        </section>
        <section>
          <h2>{lesson.workspace.name}</h2>
          <Editor initialValue={lesson.workspace.starter} onChange={setSource} />
        </section>
      </div>
      <button className="run" onClick={onRun} disabled={running}>
        {running ? "Running…" : "Run tests"}
      </button>
      {report && <Report report={report} />}
    </main>
  );
}

function Report({ report }: { report: TestReport }) {
  switch (report.kind) {
    case "tests":
      return <TestResults results={report.results} />;
    case "compile-error":
      return (
        <BrokenRun title="Compile error">
          <ul>
            {report.errors.map((e, i) => (
              <li key={i}>
                {e.line !== undefined && `Line ${e.line}, column ${e.column}: `}
                {e.message}
              </li>
            ))}
          </ul>
        </BrokenRun>
      );
    case "runtime-error":
      return (
        <BrokenRun title="Runtime error">
          <p>An uncaught exception stopped the Run before the tests could finish.</p>
          <pre>{report.stack ?? report.message}</pre>
        </BrokenRun>
      );
    case "timeout":
      return (
        <BrokenRun title="Timed out">
          <p>
            The Run did not finish in {report.ms / 1000} s and was stopped. Look for an
            infinite loop.
          </p>
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
  const passed = results.filter((r) => r.status === "pass").length;
  return (
    <section className="report" aria-label="Test Report">
      <ul>
        {results.map((r, i) => (
          <li key={i} className={r.status}>
            {r.status === "pass" ? "✓" : "✗"} {r.name}
            {r.error && <span className="error"> — {r.error}</span>}
          </li>
        ))}
      </ul>
      <p className="summary">
        {passed} / {results.length} passed
      </p>
    </section>
  );
}
