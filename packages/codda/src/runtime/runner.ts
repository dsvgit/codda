import { compile } from "./compiler";
import type {
  CompileInput,
  ConsoleLevel,
  ConsoleLine,
  ConsoleMessage,
  ReportMessage,
  TestReport,
} from "./types";

export type { ConsoleLine, TestReport } from "./types";

type RunOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Called with each line of the Console of this Run, as it is printed. */
  onConsole?: (line: ConsoleLine) => void;
};

/**
 * One Run: compile source + Lesson Tests, execute them in a fresh Sandbox.
 * The whole Run, compilation included, gets `timeoutMs`; `signal` cancels it.
 * Deadline and cancellation stop the Run the same way: the Sandbox is
 * destroyed (and the Worker, if it is still compiling) and the Run reports a
 * timeout or `cancelled`.
 */
export function run(
  input: CompileInput,
  { timeoutMs = 5000, signal, onConsole = () => {} }: RunOptions = {},
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
  return Promise.race([compileAndExecute(input, stop.signal, onConsole), stopped]).finally(() =>
    clearTimeout(timer),
  );
}

async function compileAndExecute(
  input: CompileInput,
  signal: AbortSignal,
  onConsole: (line: ConsoleLine) => void,
): Promise<TestReport> {
  const compiled = await compile(input, signal);
  if (!compiled.ok) return { kind: "compile-error", errors: compiled.errors };
  return executeInSandbox(compiled.code, signal, onConsole);
}

const CONSOLE_LEVELS: ConsoleLevel[] = ["log", "info", "warn", "error", "debug"];

// The same limits as in the Test Harness (harness.ts).
const MAX_CONSOLE_LINES = 1000;
const MAX_LINE_LENGTH = 10_000;
const DROPPED_LINE: ConsoleLine = {
  level: "warn",
  text: "Console: показаны первые 1000 строк, остальное отброшено",
};

// Relies on Chrome giving the opaque-origin Sandbox its own process: otherwise
// a busy loop inside it would also freeze this page and the deadline timer.
//
// The Sandbox talks back over a MessagePort, not window.postMessage: Chrome
// delivers a window message only after the sending task ends, so a student's
// busy loop would hold back the Console lines printed before it, while a port
// delivers them at once. The Sandbox creates the channel and hands one end to
// this page; the bundle starts a task later, once that hand-over is sent.
function executeInSandbox(
  code: string,
  signal: AbortSignal,
  onConsole: (line: ConsoleLine) => void,
): Promise<TestReport> {
  const runId = crypto.randomUUID();
  const iframe = document.createElement("iframe");
  // ADR-0003: allow-scripts only, never allow-same-origin.
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.hidden = true;
  iframe.srcdoc =
    `<!doctype html><html><body>` +
    `<script>var __coddaRunId = ${JSON.stringify(runId)};` +
    `var __coddaChannel = new MessageChannel(), __coddaPort = __coddaChannel.port1;` +
    `parent.postMessage({ type: "codda:port", runId: __coddaRunId }, "*", [__coddaChannel.port2]);` +
    `setTimeout(function () {` +
    `  var bundle = document.createElement("script");` +
    `  bundle.textContent = document.getElementById("codda-bundle").textContent;` +
    `  document.body.append(bundle);` +
    `});</script>` +
    `<script type="text/plain" id="codda-bundle">${code.replace(/<\/script/gi, "<\\/script")}</script>` +
    `</body></html>`;

  let port: MessagePort | undefined;
  let lines = 0;
  return new Promise((resolve) => {
    const dispose = () => {
      window.removeEventListener("message", onPortHandover);
      port?.close();
      signal.removeEventListener("abort", dispose);
      iframe.remove();
    };
    const onPortHandover = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow || !isPortFor(event.data, runId) || !event.ports[0]) {
        return;
      }
      window.removeEventListener("message", onPortHandover);
      port = event.ports[0];
      port.onmessage = onSandboxMessage;
    };
    const onSandboxMessage = ({ data }: MessageEvent) => {
      if (isConsoleFor(data, runId)) {
        // The Test Harness keeps these limits too, but the Sandbox is not trusted.
        lines++;
        if (lines <= MAX_CONSOLE_LINES) {
          onConsole({ level: data.level, text: data.text.slice(0, MAX_LINE_LENGTH) });
        } else if (lines === MAX_CONSOLE_LINES + 1) {
          onConsole(DROPPED_LINE);
        }
      } else if (isReportFor(data, runId)) {
        dispose();
        resolve(data.report);
      }
    };
    window.addEventListener("message", onPortHandover);
    signal.addEventListener("abort", dispose, { once: true });
    document.body.append(iframe);
  });
}

function isPortFor(data: unknown, runId: string): boolean {
  if (typeof data !== "object" || data === null) return false;
  const { type, runId: id } = data as Record<string, unknown>;
  return type === "codda:port" && id === runId;
}

function isConsoleFor(data: unknown, runId: string): data is ConsoleMessage {
  if (typeof data !== "object" || data === null) return false;
  const { type, runId: id, level, text } = data as Record<string, unknown>;
  return (
    type === "codda:console" &&
    id === runId &&
    CONSOLE_LEVELS.includes(level as ConsoleLevel) &&
    typeof text === "string"
  );
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
  const { kind, results, message } = report as Record<string, unknown>;
  if (kind === "runtime-error") return typeof message === "string";
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
