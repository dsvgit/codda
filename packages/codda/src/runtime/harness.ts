// Test Harness: compiled into every bundle as the `@codda/test` module and
// executed inside the Sandbox. Lesson Tests import `test` and `expect` from it.
import type {
  ConsoleLevel,
  ConsoleLine,
  ConsoleMessage,
  ReportMessage,
  TestReport,
  TestResult,
} from "./types";

declare const __coddaRunId: string;
/** The Sandbox's end of the channel to the Runner (runner.ts). */
declare const __coddaPort: MessagePort;

type TestFn = () => void | Promise<void>;

const registered: { name: string; fn: TestFn }[] = [];

/** The test that is running: from its call until shortly after its end. */
let currentTest: { error?: string } | undefined;
let started = false;

// This module is evaluated before the Lesson Tests and the student's code, so
// an exception thrown at their top level lands here and runAll never starts:
// a runtime error. Once runAll has started, an uncaught error or an unhandled
// rejection belongs to the test that is running (R8): it fails that test, and
// the other tests still run. Between and after the tests it is not seen.
addEventListener("error", (event) => {
  const err: unknown = event.error ?? event.message;
  if (started) {
    failCurrentTest(err);
    return;
  }
  sendReport({
    kind: "runtime-error",
    message: String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
});
addEventListener("unhandledrejection", (event) => failCurrentTest(event.reason));

// The Console: every console.* call in the Sandbox (the student's code, the
// Lesson Tests, React's warnings) goes to the parent as soon as it is made.
// After MAX_CONSOLE_LINES one warn line says the rest is dropped, and the
// Console goes silent: a loop printing forever must not flood the parent.
// The Runner keeps the same limit on its side (runner.ts): this module is
// compiled from source into the bundle, so it cannot share the constants.
const MAX_CONSOLE_LINES = 1000;
const MAX_LINE_LENGTH = 10_000;
const DROPPED_LINE: ConsoleLine = {
  level: "warn",
  text: "Console: показаны первые 1000 строк, остальное отброшено",
};
let printed = 0;
for (const level of ["log", "info", "warn", "error", "debug"] satisfies ConsoleLevel[]) {
  console[level] = (...args: unknown[]) => {
    if (printed > MAX_CONSOLE_LINES) return;
    printed++;
    const line: ConsoleLine =
      printed > MAX_CONSOLE_LINES
        ? DROPPED_LINE
        : {
            level,
            text: args
              .map((arg) =>
                typeof arg === "string" ? arg : arg instanceof Error ? String(arg) : format(arg),
              )
              .join(" ")
              .slice(0, MAX_LINE_LENGTH),
          };
    const message: ConsoleMessage = { type: "codda:console", runId: __coddaRunId, ...line };
    __coddaPort.postMessage(message);
  };
}

let reported = false;

function sendReport(report: TestReport): void {
  if (reported) return;
  reported = true;
  const message: ReportMessage = { type: "codda:report", runId: __coddaRunId, report };
  __coddaPort.postMessage(message);
}

export function test(name: string, fn: TestFn): void {
  registered.push({ name, fn });
}

function format(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (Object.is(value, -0)) return "-0";
  if (typeof value === "number" || value === undefined) return String(value);
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

export function expect(actual: unknown) {
  const assert = (pass: boolean, expected: unknown) => {
    if (!pass) throw new Error(`expected ${format(expected)}, got ${format(actual)}`);
  };
  return {
    toBe(expected: unknown) {
      assert(Object.is(actual, expected), expected);
    },
    toEqual(expected: unknown) {
      assert(deepEqual(actual, expected), expected);
    },
  };
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// A test keeps the first error it got, whether from expect or asynchronous.
function failCurrentTest(err: unknown): void {
  if (currentTest) currentTest.error ??= messageOf(err);
}

function nextMacrotask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function runAll(): Promise<void> {
  started = true;
  const results: TestResult[] = [];
  for (const { name, fn } of registered) {
    currentTest = {};
    try {
      await fn();
    } catch (err) {
      failCurrentTest(err);
    }
    // Two macrotasks more, so that zero-delay timers and rejections left after
    // the test's microtasks still land on this test: Chrome reports an
    // unhandled rejection in a task of its own, queued after the first timer.
    await nextMacrotask();
    await nextMacrotask();
    const { error } = currentTest;
    currentTest = undefined;
    results.push(error === undefined ? { name, status: "pass" } : { name, status: "fail", error });
  }
  sendReport({ kind: "tests", results });
}
