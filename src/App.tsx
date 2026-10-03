import { useState } from "react";
import { Editor } from "./Editor";
import { lesson } from "./lesson";
import { run, type TestReport } from "./runtime/runner";

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
  if (report.kind !== "tests") {
    return <pre className="report">{JSON.stringify(report, null, 2)}</pre>;
  }
  const passed = report.results.filter((r) => r.status === "pass").length;
  return (
    <section className="report" aria-label="Test Report">
      <ul>
        {report.results.map((r, i) => (
          <li key={i} className={r.status}>
            {r.status === "pass" ? "✓" : "✗"} {r.name}
            {r.error && <span className="error"> — {r.error}</span>}
          </li>
        ))}
      </ul>
      <p className="summary">
        {passed} / {report.results.length} passed
      </p>
    </section>
  );
}
