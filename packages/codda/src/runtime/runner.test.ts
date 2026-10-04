import { expect, test } from "vitest";
import { run } from "./runner";

// A React task: the Runner bundles React from the Dependency Artifacts, and
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
  const report = await run({ source: reactTask.solution, tests: reactTask.tests });

  expect(report).toEqual({
    kind: "tests",
    results: [{ name: "is off at first, on after a click", status: "pass" }],
  });
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

test("exception at the top level of the student's module is a runtime error", async () => {
  const source = `throw new Error("boom");
export const add = (a: number, b: number) => a + b;
`;

  const report = await run({ source, tests: addTask.tests });

  expect(report).toMatchObject({ kind: "runtime-error", message: "Error: boom" });
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
