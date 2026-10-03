import { expect, test } from "vitest";
import { lesson } from "../lesson";
import { run } from "./runner";

const solution = `export function add(a: number, b: number) {
  return a + b;
}
`;

test("correct solution passes every lesson test", async () => {
  const report = await run({ source: solution, tests: lesson.tests });

  expect(report).toEqual({
    kind: "tests",
    results: [
      { name: "adds two positive numbers", status: "pass" },
      { name: "adds a negative number", status: "pass" },
    ],
  });
});

test("starter fails each lesson test with expected and actual values", async () => {
  const report = await run({ source: lesson.starter, tests: lesson.tests });

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
import { pair } from "./App";

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
import { value } from "./App";

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
    run({ source: lesson.starter, tests: lesson.tests }),
    run({ source: `export const add = (a: number, b: number) => a + b;`, tests: lesson.tests }),
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

  const report = await run({ source, tests: lesson.tests });

  expect(report).toEqual({
    kind: "compile-error",
    errors: [{ message: 'Unexpected ";"', line: 2, column: 13 }],
  });
});

test("exception at the top level of the student's module is a runtime error", async () => {
  const source = `throw new Error("boom");
export const add = (a: number, b: number) => a + b;
`;

  const report = await run({ source, tests: lesson.tests });

  expect(report).toMatchObject({ kind: "runtime-error", message: "Error: boom" });
});

const looping = `while (true) {}
export const add = (a: number, b: number) => a + b;
`;

test("infinite loop times out after 5 s and the next Run works", { timeout: 20_000 }, async () => {
  expect(await run({ source: looping, tests: lesson.tests })).toEqual({
    kind: "timeout",
    ms: 5000,
  });
  expect(document.querySelector("iframe")).toBeNull();

  const next = await run({ source: solution, tests: lesson.tests });
  expect(next.kind === "tests" && next.results.map((r) => r.status)).toEqual(["pass", "pass"]);
});

test("compilation that outlives the deadline times out, runs nothing later, and the next Run works", async () => {
  expect(await run({ source: looping, tests: lesson.tests }, { timeoutMs: 1 })).toEqual({
    kind: "timeout",
    ms: 1,
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));
  expect(document.querySelector("iframe")).toBeNull();

  const next = await run({ source: solution, tests: lesson.tests });
  expect(next.kind === "tests" && next.results.map((r) => r.status)).toEqual(["pass", "pass"]);
});
