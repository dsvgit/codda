import { useState, type ReactNode } from "react";
import { Editor } from "./Editor";
import { lesson } from "./lesson";
import { run, type TestReport } from "./runtime/runner";
import type { TestResult } from "./runtime/types";

export function App() {
  const [source, setSource] = useState(lesson.starter);
  const [report, setReport] = useState<TestReport>();
  const [running, setRunning] = useState(false);

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
      <h1>{lesson.title}</h1>
      <div className="panes">
        <section className="instructions">
          <h2>Instructions</h2>
          <p>{lesson.instructions}</p>
        </section>
        <section>
          <h2>App.tsx</h2>
          <Editor initialValue={lesson.starter} onChange={setSource} />
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
