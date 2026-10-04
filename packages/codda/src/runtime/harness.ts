// Test Harness: compiled into every bundle as the `@codda/test` module and
// executed inside the Sandbox. Lesson Tests import `test` and `expect` from it.
import type { ReportMessage, TestReport, TestResult } from "./types";

declare const __coddaRunId: string;

type TestFn = () => void | Promise<void>;

const registered: { name: string; fn: TestFn }[] = [];

// This module is evaluated before the Lesson Tests and the student's code, so
// an exception thrown at their top level lands here and runAll never starts.
addEventListener("error", (event) => {
  const err: unknown = event.error;
  sendReport({
    kind: "runtime-error",
    message: String(err ?? event.message),
    stack: err instanceof Error ? err.stack : undefined,
  });
});

let reported = false;

function sendReport(report: TestReport): void {
  if (reported) return;
  reported = true;
  const message: ReportMessage = { type: "codda:report", runId: __coddaRunId, report };
  parent.postMessage(message, "*");
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

export async function runAll(): Promise<void> {
  const results: TestResult[] = [];
  for (const { name, fn } of registered) {
    try {
      await fn();
      results.push({ name, status: "pass" });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({ name, status: "fail", error });
    }
  }
  sendReport({ kind: "tests", results });
}
