import { compile } from "./compiler";
import type { CompileInput, ReportMessage, TestReport } from "./types";

export type { TestReport } from "./types";

/**
 * One Run: compile source + Lesson Tests, execute them in a fresh Sandbox.
 * The whole Run, compilation included, gets `timeoutMs`; `signal` cancels it.
 * Deadline and cancellation stop the Run the same way: the Sandbox is
 * destroyed (and the Worker, if it is still compiling) and the Run reports a
 * timeout or `cancelled`.
 */
export function run(
  input: CompileInput,
  { timeoutMs = 5000, signal }: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<TestReport> {
  if (signal?.aborted) return Promise.resolve({ kind: "cancelled" });
  const stop = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const stopped = new Promise<TestReport>((resolve) => {
    const stopWith = (report: TestReport) => {
      stop.abort();
      resolve(report);
    };
    timer = setTimeout(() => stopWith({ kind: "timeout", ms: timeoutMs }), timeoutMs);
    signal?.addEventListener("abort", () => stopWith({ kind: "cancelled" }), { once: true });
  });
  return Promise.race([compileAndExecute(input, stop.signal), stopped]).finally(() =>
    clearTimeout(timer),
  );
}

async function compileAndExecute(input: CompileInput, signal: AbortSignal): Promise<TestReport> {
  const compiled = await compile(input, signal);
  if (!compiled.ok) return { kind: "compile-error", errors: compiled.errors };
  return executeInSandbox(compiled.code, signal);
}

// Relies on Chrome giving the opaque-origin Sandbox its own process: otherwise
// a busy loop inside it would also freeze this page and the deadline timer.
function executeInSandbox(code: string, signal: AbortSignal): Promise<TestReport> {
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
    const dispose = () => {
      window.removeEventListener("message", onMessage);
      signal.removeEventListener("abort", dispose);
      iframe.remove();
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow || !isReportFor(event.data, runId)) return;
      dispose();
      resolve(event.data.report);
    };
    window.addEventListener("message", onMessage);
    signal.addEventListener("abort", dispose, { once: true });
    document.body.append(iframe);
  });
}

function isReportFor(data: unknown, runId: string): data is ReportMessage {
  if (typeof data !== "object" || data === null) return false;
  const message = data as Partial<ReportMessage>;
  return (
    message.type === "codda:report" &&
    message.runId === runId &&
    isSandboxReport(message.report)
  );
}

// Only the Test Harness reports from inside the Sandbox: either test results
// or an exception that escaped the Lesson Tests / student's module.
function isSandboxReport(report: unknown): report is TestReport {
  if (typeof report !== "object" || report === null) return false;
  const { kind, results, message, stack } = report as Record<string, unknown>;
  if (kind === "runtime-error") {
    return typeof message === "string" && (stack === undefined || typeof stack === "string");
  }
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
