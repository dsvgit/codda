import { expect, inject, test } from "vitest";
import { commands } from "vitest/browser";
import { run } from "./runner";
import type { ConsoleLine } from "./types";

declare module "vitest" {
  export interface ProvidedContext {
    /** Path of importmap.json of the fixture Course's Dependency Artifact (vitest.global-setup.ts). */
    importMap: string;
  }
}

// The Dependency Artifact of fixtures/react-course with real react and
// react-dom, built by the code of `codda build`, as the page passes it.
const importMap = new URL(inject("importMap"), location.href).href;

// A React task: the Runner bundles React from the Dependency Artifact, and
// Lesson Tests import the student's Workspace as "./main".
const reactTask = {
  solution: `import { useState } from "react";

export function Toggle() {
  const [on, setOn] = useState(false);
  return <button onClick={() => setOn(!on)}>{on ? "on" : "off"}</button>;
}
`,
  tests: `import { test, expect } from "@codda/test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Toggle } from "./main";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test("is off at first, on after a click", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  await act(() => createRoot(container).render(<Toggle />));
  expect(container.textContent).toBe("off");
  await act(() => container.querySelector("button")!.click());
  expect(container.textContent).toBe("on");
});
`,
};

test("React solution passes the Lesson Tests that import it as ./main", async () => {
  const report = await run({ source: reactTask.solution, tests: reactTask.tests, importMap });

  expect(report).toEqual({
    kind: "tests",
    results: [{ name: "is off at first, on after a click", status: "pass" }],
  });
});

test("default and named imports of a CommonJS package work in one file", async () => {
  const report = await run({
    source: `import React, { useState } from "react";
export const same = React.useState === useState && typeof useState === "function";
`,
    tests: `import { test, expect } from "@codda/test";
import { same } from "./main";

test("same useState", () => expect(same).toBe(true));
`,
    importMap,
  });

  expect(report).toEqual({ kind: "tests", results: [{ name: "same useState", status: "pass" }] });
});

test("the default import of a CommonJS package without __esModule is module.exports itself", async () => {
  const report = await run({
    source: `import React from "react";
export const kind = Object.prototype.toString.call(React);
export const hasDefault = "default" in React;
export const keys = Object.keys(React).includes("useState");
`,
    tests: `import { test, expect } from "@codda/test";
import { kind, hasDefault, keys } from "./main";

test("module.exports", () => {
  expect(kind).toBe("[object Object]");
  expect(hasDefault).toBe(false);
  expect(keys).toBe(true);
});
`,
    importMap,
  });

  expect(report).toEqual({ kind: "tests", results: [{ name: "module.exports", status: "pass" }] });
});

// A plain-TypeScript task: the Runner tests below are about the Runner, not
// about the current Lesson.
const addTask = {
  starter: `export function add(a: number, b: number) {
  return a - b;
}
`,
  tests: `import { test, expect } from "@codda/test";
import { add } from "./main";

test("adds two positive numbers", () => {
  expect(add(2, 3)).toBe(5);
});

test("adds a negative number", () => {
  expect(add(-1, 1)).toBe(0);
});
`,
  solution: `export function add(a: number, b: number) {
  return a + b;
}
`,
};

test("correct solution passes every test", async () => {
  const report = await run({ source: addTask.solution, tests: addTask.tests });

  expect(report).toEqual({
    kind: "tests",
    results: [
      { name: "adds two positive numbers", status: "pass" },
      { name: "adds a negative number", status: "pass" },
    ],
  });
});

test("main.ts and lesson.test.ts compile as TS, not TSX: generic arrows and type assertions", async () => {
  const report = await run({
    source: `export const id = <T>(x: T) => x;
const value: unknown = 2;
export const two = <number>value;
`,
    sourceName: "main.ts",
    tests: `import { test, expect } from "@codda/test";
import { id, two } from "./main";

const first = <T>(xs: T[]) => xs[0];
test("works", () => {
  expect(id(first([two]))).toBe(<number>(<unknown>2));
});
`,
    testsName: "lesson.test.ts",
  });

  expect(report).toEqual({ kind: "tests", results: [{ name: "works", status: "pass" }] });
});

test("main.tsx still compiles JSX", async () => {
  const report = await run({ ...reactTask, source: reactTask.solution, sourceName: "main.tsx", testsName: "lesson.test.tsx", importMap });

  expect(report).toMatchObject({ kind: "tests", results: [{ status: "pass" }] });
});

test("starter fails each test with expected and actual values", async () => {
  const report = await run({ source: addTask.starter, tests: addTask.tests });

  expect(report).toEqual({
    kind: "tests",
    results: [
      { name: "adds two positive numbers", status: "fail", error: "expected 5, got -1" },
      { name: "adds a negative number", status: "fail", error: "expected 0, got -2" },
    ],
  });
});

test("harness awaits async tests, compares deeply and keeps going after a failure", async () => {
  const tests = `import { test, expect } from "@codda/test";
import { pair } from "./main";

test("async pass", async () => {
  const value = await new Promise((resolve) => setTimeout(() => resolve(pair(1)), 10));
  expect(value).toEqual({ items: [1, 1] });
});

test("async fail", async () => {
  await Promise.resolve();
  expect(pair(2)).toEqual({ items: [2, 3] });
});

test("runs after a failure", () => {
  expect(pair(3).items.length).toBe(2);
});
`;
  const source = `export const pair = (n: number) => ({ items: [n, n] });`;

  const report = await run({ source, tests });

  expect(report).toEqual({
    kind: "tests",
    results: [
      { name: "async pass", status: "pass" },
      {
        name: "async fail",
        status: "fail",
        error: 'expected {"items":[2,3]}, got {"items":[2,2]}',
      },
      { name: "runs after a failure", status: "pass" },
    ],
  });
});

test("failure message shows NaN and -0 as they are", async () => {
  const tests = `import { test, expect } from "@codda/test";
import { value } from "./main";

test("not a number", () => {
  expect(value("nan")).toBe(1);
});

test("negative zero", () => {
  expect(value("-0")).toBe(0);
});
`;
  const source = `export const value = (kind: string) => (kind === "nan" ? NaN : -0);`;

  const report = await run({ source, tests });

  expect(report).toEqual({
    kind: "tests",
    results: [
      { name: "not a number", status: "fail", error: "expected 1, got NaN" },
      { name: "negative zero", status: "fail", error: "expected 0, got -0" },
    ],
  });
});

test("overlapping runs each get their own report", async () => {
  const [starter, solution] = await Promise.all([
    run({ source: addTask.starter, tests: addTask.tests }),
    run({ source: `export const add = (a: number, b: number) => a + b;`, tests: addTask.tests }),
  ]);

  expect(starter.kind === "tests" && starter.results.map((r) => r.status)).toEqual([
    "fail",
    "fail",
  ]);
  expect(solution.kind === "tests" && solution.results.map((r) => r.status)).toEqual([
    "pass",
    "pass",
  ]);
});

test("syntax error is reported as a compile error with line and column", async () => {
  const source = `export function add(a: number, b: number) {
  return a +;
}
`;

  const report = await run({ source, tests: addTask.tests });

  expect(report).toEqual({
    kind: "compile-error",
    errors: [{ message: 'Unexpected ";"', line: 2, column: 13 }],
  });
});

test("a compile error in the Lesson Tests (the student renamed the export) has no line and column", async () => {
  const source = `export function sum(a: number, b: number) {
  return a + b;
}
`;

  const report = await run({ source, tests: addTask.tests });

  expect(report).toEqual({
    kind: "compile-error",
    errors: [{ message: 'No matching export in "main" for import "add"' }],
  });
});

test("exception at the top level of the student's module is a runtime error", async () => {
  const source = `throw new Error("boom");
export const add = (a: number, b: number) => a + b;
`;

  const report = await run({ source, tests: addTask.tests });

  expect(report).toEqual({ kind: "runtime-error", message: "boom" });
});

const looping = `while (true) {}
export const add = (a: number, b: number) => a + b;
`;

test("infinite loop times out after 5 s and the next Run works", { timeout: 20_000 }, async () => {
  expect(await run({ source: looping, tests: addTask.tests })).toEqual({
    kind: "timeout",
    ms: 5000,
  });
  expect(document.querySelector("iframe")).toBeNull();

  const next = await run({ source: addTask.solution, tests: addTask.tests });
  expect(next.kind === "tests" && next.results.map((r) => r.status)).toEqual(["pass", "pass"]);
});

test("compilation that outlives the deadline times out, runs nothing later, and the next Run works", async () => {
  expect(await run({ source: looping, tests: addTask.tests }, { timeoutMs: 1 })).toEqual({
    kind: "timeout",
    ms: 1,
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));
  expect(document.querySelector("iframe")).toBeNull();

  const next = await run({ source: addTask.solution, tests: addTask.tests });
  expect(next.kind === "tests" && next.results.map((r) => r.status)).toEqual(["pass", "pass"]);
});

test("cancelling during the tests stops the Run before the deadline, and the next Run works", async () => {
  const cancel = new AbortController();
  const started = performance.now();
  const report = run({ source: looping, tests: addTask.tests }, { signal: cancel.signal });
  // The Sandbox appears once compilation is over; cancel while it loops.
  await expect.poll(() => document.querySelector("iframe")).not.toBeNull();
  cancel.abort();

  expect(await report).toEqual({ kind: "cancelled" });
  expect(performance.now() - started).toBeLessThan(5000);
  expect(document.querySelector("iframe")).toBeNull();

  const next = await run({ source: addTask.solution, tests: addTask.tests });
  expect(next.kind === "tests" && next.results.map((r) => r.status)).toEqual(["pass", "pass"]);
});

test("cancelling during compilation stops the Run, runs nothing later, and the next Run works", async () => {
  const cancel = new AbortController();
  const report = run({ source: looping, tests: addTask.tests }, { signal: cancel.signal });
  cancel.abort();

  expect(await report).toEqual({ kind: "cancelled" });
  await new Promise((resolve) => setTimeout(resolve, 1000));
  expect(document.querySelector("iframe")).toBeNull();

  const next = await run({ source: addTask.solution, tests: addTask.tests });
  expect(next.kind === "tests" && next.results.map((r) => r.status)).toEqual(["pass", "pass"]);
});

test("an already cancelled signal gives cancelled at once, with no compilation and no Sandbox", async () => {
  const report = run({ source: looping, tests: addTask.tests }, { signal: AbortSignal.abort() });

  // No compilation fits before the next macrotask.
  const nextTask = new Promise((resolve) => setTimeout(() => resolve("not yet"), 0));
  expect(await Promise.race([report, nextTask])).toEqual({ kind: "cancelled" });
  await new Promise((resolve) => setTimeout(resolve, 1000));
  expect(document.querySelector("iframe")).toBeNull();
});

test("cancelling after the report has come changes nothing", async () => {
  const cancel = new AbortController();
  const report = await run({ source: addTask.solution, tests: addTask.tests }, { signal: cancel.signal });

  cancel.abort();

  expect(report).toEqual({
    kind: "tests",
    results: [
      { name: "adds two positive numbers", status: "pass" },
      { name: "adds a negative number", status: "pass" },
    ],
  });
  const next = await run({ source: addTask.solution, tests: addTask.tests });
  expect(next.kind === "tests" && next.results.map((r) => r.status)).toEqual(["pass", "pass"]);
});

// Console: what the Sandbox prints reaches `onConsole`, line by line.
function collectConsole() {
  const lines: ConsoleLine[] = [];
  return { lines, onConsole: (line: ConsoleLine) => lines.push(line) };
}

test("console lines of the student's code reach onConsole with their level, formatted like expect messages", async () => {
  const source = `console.log("a", 1, { x: [1] });
console.warn("careful");
console.error(new Error("boom"));
console.log(new Error("boom"));
export const add = (a: number, b: number) => a + b;
`;
  const { lines, onConsole } = collectConsole();

  await run({ source, tests: addTask.tests }, { onConsole });

  expect(lines).toEqual([
    { level: "log", text: 'a 1 {"x":[1]}' },
    { level: "warn", text: "careful" },
    { level: "error", text: "Error: boom" },
    { level: "log", text: "Error: boom" },
  ]);
});

test("lines of the Lesson Tests reach onConsole too, all in the order they were printed", async () => {
  const source = `console.info("module");
export const add = (a: number, b: number) => { console.debug("add", a, b); return a + b; };
`;
  const tests = `import { test, expect } from "@codda/test";
import { add } from "./main";

console.log("tests module");
test("one", () => {
  console.log("before");
  expect(add(1, 2)).toBe(3);
  console.log("after");
});
`;
  const { lines, onConsole } = collectConsole();

  await run({ source, tests }, { onConsole });

  expect(lines).toEqual([
    { level: "info", text: "module" },
    { level: "log", text: "tests module" },
    { level: "log", text: "before" },
    { level: "debug", text: "add 1 2" },
    { level: "log", text: "after" },
  ]);
});

test("lines printed before a timeout stay, the report is timeout", { timeout: 20_000 }, async () => {
  const source = `console.log("start");
while (true) {}
export const add = (a: number, b: number) => a + b;
`;
  const { lines, onConsole } = collectConsole();

  const report = await run({ source, tests: addTask.tests }, { onConsole });

  expect(report).toEqual({ kind: "timeout", ms: 5000 });
  expect(lines).toEqual([{ level: "log", text: "start" }]);
});

const DROPPED = { level: "warn", text: "Console: показаны первые 1000 строк, остальное отброшено" };

test("console.log in an infinite loop gives the first 1000 lines, one warn line, then timeout; the page stays responsive", { timeout: 20_000 }, async () => {
  const source = `while (true) console.log(1);
export const add = (a: number, b: number) => a + b;
`;
  const { lines, onConsole } = collectConsole();

  const report = run({ source, tests: addTask.tests }, { onConsole });
  await expect.poll(() => lines.length, { timeout: 4000 }).toBe(1001);
  const asked = performance.now();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(performance.now() - asked).toBeLessThan(200);

  expect(await report).toEqual({ kind: "timeout", ms: 5000 });
  expect(lines.slice(0, 1000)).toEqual(Array(1000).fill({ level: "log", text: "1" }));
  expect(lines.slice(1000)).toEqual([DROPPED]);
});

// Student code reaches what the Test Harness uses: the Runner does not trust it.
const sandboxGlobals = `declare const __coddaRunId: string;
declare const __coddaPort: MessagePort;
`;

test("the Runner keeps the 1000-line limit itself when the Sandbox bypasses the harness", async () => {
  const source = `${sandboxGlobals}
for (let i = 0; i < 1500; i++) {
  __coddaPort.postMessage({ type: "codda:console", runId: __coddaRunId, level: "log", text: "x" });
}
export const add = (a: number, b: number) => a + b;
`;
  const { lines, onConsole } = collectConsole();

  await run({ source, tests: addTask.tests }, { onConsole });

  expect(lines.slice(0, 1000)).toEqual(Array(1000).fill({ level: "log", text: "x" }));
  expect(lines.slice(1000)).toEqual([DROPPED]);
});

test("a line longer than 10 000 characters is cut to 10 000", async () => {
  const source = `console.log("a".repeat(12_000));
export const add = (a: number, b: number) => a + b;
`;
  const { lines, onConsole } = collectConsole();

  await run({ source, tests: addTask.tests }, { onConsole });

  expect(lines).toEqual([{ level: "log", text: "a".repeat(10_000) }]);
});

test("the Runner cuts a line to 10 000 characters itself when the Sandbox bypasses the harness", async () => {
  const source = `${sandboxGlobals}
__coddaPort.postMessage({ type: "codda:console", runId: __coddaRunId, level: "log", text: "b".repeat(12_000) });
export const add = (a: number, b: number) => a + b;
`;
  const { lines, onConsole } = collectConsole();

  await run({ source, tests: addTask.tests }, { onConsole });

  expect(lines).toEqual([{ level: "log", text: "b".repeat(10_000) }]);
});

test("console messages of a wrong form or with another runId do not reach onConsole", async () => {
  const source = `${sandboxGlobals}
const line = { type: "codda:console", runId: __coddaRunId, level: "log", text: "ok" };
__coddaPort.postMessage({ ...line, text: 42 });
__coddaPort.postMessage({ ...line, text: { toString: "x" } });
__coddaPort.postMessage({ ...line, level: "table" });
__coddaPort.postMessage({ ...line, level: undefined });
__coddaPort.postMessage({ ...line, runId: "another run" });
__coddaPort.postMessage(null);
__coddaPort.postMessage("codda:console");
parent.postMessage({ ...line, text: "through the window" }, "*");
__coddaPort.postMessage(line);
export const add = (a: number, b: number) => a + b;
`;
  const { lines, onConsole } = collectConsole();

  const report = await run({ source, tests: addTask.tests }, { onConsole });

  expect(report.kind).toBe("tests");
  expect(lines).toEqual([{ level: "log", text: "ok" }]);
});

test("lines printed after the report do not reach onConsole", async () => {
  const source = `export const add = (a: number, b: number) => {
  // Past the window of the test (R8), which takes zero-delay timers in.
  setTimeout(() => console.log("late"), 100);
  return a + b;
};
`;
  const { lines, onConsole } = collectConsole();

  await run({ source, tests: addTask.tests }, { onConsole });
  await new Promise((resolve) => setTimeout(resolve, 400));

  expect(lines).toEqual([]);
});

test("overlapping runs each get only their own console lines", async () => {
  const printing = (word: string) =>
    `export const add = (a: number, b: number) => { console.log("${word}"); return a + b; };`;
  const first = collectConsole();
  const second = collectConsole();

  await Promise.all([
    run({ source: printing("first"), tests: addTask.tests }, { onConsole: first.onConsole }),
    run({ source: printing("second"), tests: addTask.tests }, { onConsole: second.onConsole }),
  ]);

  expect(first.lines).toEqual(Array(2).fill({ level: "log", text: "first" }));
  expect(second.lines).toEqual(Array(2).fill({ level: "log", text: "second" }));
});

// R8: an error the student's code throws asynchronously while a test runs
// fails that test; the other tests still run and stay in the Test Report.
const asyncTests = `import { test, expect } from "@codda/test";
import { add } from "./main";

test("adds once", () => {
  expect(add(2, 3)).toBe(5);
});

test("adds again", () => {
  expect(add(1, 1)).toBe(2);
});
`;

test("an exception in a zero-delay timer fails the test it happened in, the next tests run and pass", async () => {
  const source = `let calls = 0;
export const add = (a: number, b: number) => {
  if (++calls === 1) setTimeout(() => { throw new Error("timer boom"); }, 0);
  return a + b;
};
`;

  const report = await run({ source, tests: asyncTests });

  expect(report).toEqual({
    kind: "tests",
    results: [
      { name: "adds once", status: "fail", error: "timer boom" },
      { name: "adds again", status: "pass" },
    ],
  });
});

test("an unhandled rejection with an Error fails the test it happened in with the error's message", async () => {
  const source = `let calls = 0;
export const add = (a: number, b: number) => {
  if (++calls === 1) Promise.reject(new Error("x"));
  return a + b;
};
`;

  const report = await run({ source, tests: asyncTests });

  expect(report).toEqual({
    kind: "tests",
    results: [
      { name: "adds once", status: "fail", error: "x" },
      { name: "adds again", status: "pass" },
    ],
  });
});

test("an unhandled rejection with a non-Error fails the test with the value as text", async () => {
  const source = `let calls = 0;
export const add = (a: number, b: number) => {
  if (++calls === 1) Promise.reject("oops");
  return a + b;
};
`;

  const report = await run({ source, tests: asyncTests });

  expect(report).toEqual({
    kind: "tests",
    results: [
      { name: "adds once", status: "fail", error: "oops" },
      { name: "adds again", status: "pass" },
    ],
  });
});

test("a delayed timer that throws while an async test still awaits fails that test, not its neighbours", async () => {
  const tests = `import { test, expect } from "@codda/test";
import { add, startTimer } from "./main";

test("before", () => {
  expect(add(1, 1)).toBe(2);
});

test("waits", async () => {
  startTimer();
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(add(2, 2)).toBe(4);
});

test("after", () => {
  expect(add(3, 3)).toBe(6);
});
`;
  const source = `export const add = (a: number, b: number) => a + b;
export const startTimer = () => setTimeout(() => { throw new Error("late boom"); }, 30);
`;

  const report = await run({ source, tests });

  expect(report).toEqual({
    kind: "tests",
    results: [
      { name: "before", status: "pass" },
      { name: "waits", status: "fail", error: "late boom" },
      { name: "after", status: "pass" },
    ],
  });
});

test("a test that already failed on expect keeps that first error when an async one comes later", async () => {
  const source = `let calls = 0;
export const add = (a: number, b: number) => {
  if (++calls === 1) {
    setTimeout(() => { throw new Error("timer boom"); }, 0);
    return a - b;
  }
  return a + b;
};
`;

  const report = await run({ source, tests: asyncTests });

  expect(report).toEqual({
    kind: "tests",
    results: [
      { name: "adds once", status: "fail", error: "expected 5, got -1" },
      { name: "adds again", status: "pass" },
    ],
  });
});

test("an error in a timer that fires after the last test does not change the report", async () => {
  const source = `export const add = (a: number, b: number) => {
  setTimeout(() => { throw new Error("too late"); }, 1000);
  return a + b;
};
`;

  const report = await run({ source, tests: asyncTests });
  await new Promise((resolve) => setTimeout(resolve, 1200));

  expect(report).toEqual({
    kind: "tests",
    results: [
      { name: "adds once", status: "pass" },
      { name: "adds again", status: "pass" },
    ],
  });
});

// Compiler Worker failures. The Worker cannot be broken from the page, so the
// test breaks its network instead: Vitest commands (vite.config.ts) make the
// Playwright page abort requests whose URL matches a pattern.
declare module "vitest/browser" {
  interface BrowserCommands {
    failRequests: (pattern: string, response?: { status: number; body?: string }) => Promise<void>;
    restoreRequests: () => Promise<void>;
  }
}

/** Drops the warm Compiler Worker: a Run cancelled while compiling terminates it. */
async function coldCompiler() {
  const cancel = new AbortController();
  const report = run({ source: addTask.solution, tests: addTask.tests }, { signal: cancel.signal });
  cancel.abort();
  await report;
}

async function expectInternalErrorBeforeDeadline(failing: string) {
  await coldCompiler();
  await commands.failRequests(failing);
  try {
    const started = performance.now();
    const report = await run({ source: addTask.solution, tests: addTask.tests });

    expect(report).toEqual({ kind: "internal-error", message: expect.any(String) });
    expect(report.kind === "internal-error" && report.message).not.toBe("");
    expect(performance.now() - started).toBeLessThan(5000);
    expect(document.querySelector("iframe")).toBeNull();
  } finally {
    await commands.restoreRequests();
  }
}

test("esbuild.wasm that fails to load gives internal-error before the deadline; the next Run loads it anew and works", async () => {
  await expectInternalErrorBeforeDeadline("esbuild\\.wasm");

  const next = await run({ source: addTask.solution, tests: addTask.tests });
  expect(next.kind === "tests" && next.results.map((r) => r.status)).toEqual(["pass", "pass"]);
});

test("a Compiler Worker whose script fails to load gives internal-error before the deadline; the next Run works", async () => {
  await expectInternalErrorBeforeDeadline("compiler\\.worker");

  const next = await run({ source: addTask.solution, tests: addTask.tests });
  expect(next.kind === "tests" && next.results.map((r) => r.status)).toEqual(["pass", "pass"]);
});

// Errors of the Dependency Artifact (dependency-artifacts/04).

/** The student's code imports `specifier` on line 2 of a Workspace that would pass. */
const importing = (specifier: string) => `export const add = (a: number, b: number) => a + b;
import "${specifier}";
`;
const notInTask = (specifier: string) => ({
  kind: "compile-error",
  errors: [{ message: `Импорт "${specifier}" не предусмотрен заданием`, line: 2, column: 8 }],
});

test("an import of a package the artifact lacks is a compile error on the import's line", async () => {
  const report = await run({ source: importing("lodash"), tests: addTask.tests, importMap });

  expect(report).toEqual(notInTask("lodash"));
});

test("an import of a subpath of an installed package that is not an entry point is the same compile error", async () => {
  const report = await run({ source: importing("react-dom/server"), tests: addTask.tests, importMap });

  expect(report).toEqual(notInTask("react-dom/server"));
});

test("a bare import in a Course without an artifact is the same compile error", async () => {
  const report = await run({ source: importing("react"), tests: addTask.tests });

  expect(report).toEqual(notInTask("react"));
});

/**
 * Runs the React task on a cold Compiler (the artifact is not loaded yet)
 * while requests matching `pattern` get `response` (or are aborted).
 */
async function runWithBrokenArtifact(
  pattern: string,
  response?: { status: number; body?: string },
  source = reactTask.solution,
) {
  await coldCompiler();
  await commands.failRequests(pattern, response);
  try {
    return await run({ source, tests: reactTask.tests, importMap });
  } finally {
    await commands.restoreRequests();
  }
}

const courseUpdated = { kind: "compile-error", errors: [{ message: "Курс обновился, перезагрузите страницу" }] };

test("404 on importmap.json is «Курс обновился, перезагрузите страницу» without a line", async () => {
  expect(await runWithBrokenArtifact("importmap\\.json", { status: 404 })).toEqual(courseUpdated);
});

test("404 on a chunk of the artifact is the same compile error", async () => {
  expect(await runWithBrokenArtifact("/chunk-[^/]*\\.js", { status: 404 })).toEqual(courseUpdated);
});

test("a tampered file of the artifact fails its integrity: a load error, and the student's code never runs", async () => {
  const { lines, onConsole } = collectConsole();
  await coldCompiler();
  await commands.failRequests("/react-[A-Z0-9]+\\.js", { status: 200, body: "export const tampered = 1;" });
  let report;
  try {
    report = await run(
      { source: `console.log("student code ran");\n${reactTask.solution}`, tests: reactTask.tests, importMap },
      { onConsole },
    );
  } finally {
    await commands.restoreRequests();
  }

  expect(report).toEqual({
    kind: "compile-error",
    errors: [{ message: expect.stringMatching(/^Не удалось загрузить зависимости курса: .+/) }],
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(lines).toEqual([]);
  expect(document.querySelector("iframe")).toBeNull();
});

test("after a load error the next Run loads the artifact anew, without a page reload, and passes", async () => {
  const failed = await runWithBrokenArtifact("/chunk-[^/]*\\.js");
  expect(failed).toEqual({
    kind: "compile-error",
    errors: [{ message: expect.stringMatching(/^Не удалось загрузить зависимости курса: .+/) }],
  });

  const next = await run({ source: reactTask.solution, tests: reactTask.tests, importMap });
  expect(next).toEqual({
    kind: "tests",
    results: [{ name: "is off at first, on after a click", status: "pass" }],
  });
});
