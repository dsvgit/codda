export type TestResult = {
  name: string;
  status: "pass" | "fail";
  error?: string;
};

export type CompileError = { message: string; line?: number; column?: number };

export type TestReport =
  | { kind: "tests"; results: TestResult[] }
  | { kind: "compile-error"; errors: CompileError[] }
  | { kind: "runtime-error"; message: string; stack?: string }
  | { kind: "timeout"; ms: number }
  | { kind: "cancelled" };

export type CompileInput = { source: string; tests: string };

export type CompileResult =
  | { ok: true; code: string }
  | { ok: false; errors: CompileError[] };

/** The single message a Sandbox sends to its parent. */
export type ReportMessage = {
  type: "codda:report";
  runId: string;
  report: TestReport;
};
