import { compile } from "./compiler";
import type { CompileInput, ReportMessage, TestReport } from "./types";

export type { TestReport } from "./types";

/** One Run: compile source + Lesson Tests, execute them in a fresh Sandbox. */
export async function run(input: CompileInput): Promise<TestReport> {
  const compiled = await compile(input);
  if (!compiled.ok) return { kind: "compile-error", errors: compiled.errors };
  return executeInSandbox(compiled.code);
}

function executeInSandbox(code: string): Promise<TestReport> {
  const runId = crypto.randomUUID();
  const iframe = document.createElement("iframe");
  // ADR-0003: allow-scripts only, never allow-same-origin.
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.hidden = true;
  iframe.srcdoc =
    `<!doctype html><html><body>` +
    `<script>var __coddaRunId = ${JSON.stringify(runId)};</script>` +
    `<script>${code.replace(/<\/script/gi, "<\\/script")}</script>` +
    `</body></html>`;

  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow || !isReportFor(event.data, runId)) return;
      window.removeEventListener("message", onMessage);
      iframe.remove();
      resolve(event.data.report);
    };
    window.addEventListener("message", onMessage);
    document.body.append(iframe);
  });
}

function isReportFor(data: unknown, runId: string): data is ReportMessage {
  if (typeof data !== "object" || data === null) return false;
  const message = data as Partial<ReportMessage>;
  return (
    message.type === "codda:report" &&
    message.runId === runId &&
    isTestsReport(message.report)
  );
}

// Only the Test Harness reports from inside the Sandbox, and it only sends "tests".
function isTestsReport(report: unknown): report is TestReport {
  if (typeof report !== "object" || report === null) return false;
  const { kind, results } = report as { kind?: unknown; results?: unknown };
  return (
    kind === "tests" &&
    Array.isArray(results) &&
    results.every(
      (r) =>
        typeof r?.name === "string" &&
        (r.status === "pass" || r.status === "fail") &&
        (r.error === undefined || typeof r.error === "string"),
    )
  );
}
