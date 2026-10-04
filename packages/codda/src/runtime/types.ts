export type TestResult = {
  name: string;
  status: "pass" | "fail";
  error?: string;
};

export type CompileError = { message: string; line?: number; column?: number };

export type TestReport =
  | { kind: "tests"; results: TestResult[] }
  | { kind: "compile-error"; errors: CompileError[] }
  | { kind: "runtime-error"; message: string }
  | { kind: "timeout"; ms: number }
  | { kind: "cancelled" }
  | { kind: "internal-error"; message: string };

export type CompileInput = {
  source: string;
  /** The Workspace's file name: its extension picks the loader. Without one, TSX as in the PoC. */
  sourceName?: "main.ts" | "main.tsx";
  tests: string;
  /** The Lesson Tests' file name, the same way. */
  testsName?: "lesson.test.ts" | "lesson.test.tsx";
  /** Absolute URL of importmap.json of the Course's Dependency Artifact; none if the Course has none. */
  importMap?: string;
};

export type CompileResult =
  | { ok: true; code: string }
  | { ok: false; errors: CompileError[] };

export type ConsoleLevel = "log" | "info" | "warn" | "error" | "debug";

/** One line of the Console: one `console.*` call inside the Sandbox. */
export type ConsoleLine = { level: ConsoleLevel; text: string };

/** The Test Report of a Run, sent by the Sandbox once. */
export type ReportMessage = {
  type: "codda:report";
  runId: string;
  report: TestReport;
};

/** A line of the Console, sent by the Sandbox as soon as it is printed. */
export type ConsoleMessage = { type: "codda:console"; runId: string } & ConsoleLine;
