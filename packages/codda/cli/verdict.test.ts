// The verdict of a Lesson in `codda test`: Test Reports of its Solution and
// Starter → errors under the Lesson's line.
import { expect, test } from "vitest";
import type { TestReport } from "../src/runtime/types.ts";
import { verdict } from "./verdict.ts";

const lesson = { id: "sum", workspace: { name: "main.ts" as const } };
const passing: TestReport = { kind: "tests", results: [{ name: "складывает", status: "pass" }, { name: "с нулём", status: "pass" }] };
const failing: TestReport = {
  kind: "tests",
  results: [
    { name: "складывает", status: "fail", error: "ожидалось 3, получено 0" },
    { name: "с нулём", status: "pass" },
  ],
};

test("Solution passes every test, Starter fails one: no errors", () => {
  expect(verdict(lesson, passing, failing)).toEqual([]);
});

test("Solution with a failed test: an error per failed test, at solution.ts", () => {
  expect(verdict(lesson, failing)).toEqual(["sum/solution.ts: тест «складывает» не прошёл: ожидалось 3, получено 0"]);
});

test("Solution with zero tests is an error", () => {
  expect(verdict(lesson, { kind: "tests", results: [] })).toEqual(["sum/solution.ts: в Lesson Tests нет ни одного теста"]);
});

test("Starter that passes every test is an error at main.ts / main.tsx", () => {
  expect(verdict(lesson, passing, passing)).toEqual(["sum/main.ts: Starter уже проходит все тесты"]);
  expect(verdict({ id: "app", workspace: { name: "main.tsx" } }, passing, passing)).toEqual([
    "app/main.tsx: Starter уже проходит все тесты",
  ]);
});

test("a broken Run is an error for Solution and Starter alike", () => {
  const broken: [TestReport, string][] = [
    [{ kind: "compile-error", errors: [{ message: "Expected \";\"", line: 2, column: 5 }] }, "строка 2: ошибка компиляции: Expected \";\""],
    [{ kind: "compile-error", errors: [{ message: "a" }, { message: "b" }] }, "ошибка компиляции: a"],
    [{ kind: "runtime-error", message: "boom" }, "ошибка при выполнении: boom"],
    [{ kind: "timeout", ms: 5000 }, "тесты не завершились за 5 с"],
    [{ kind: "cancelled" }, "Run отменён"],
    [{ kind: "internal-error", message: "Worker упал" }, "внутренняя ошибка: Worker упал"],
  ];
  for (const [report, text] of broken) {
    expect(verdict(lesson, report)[0]).toBe(`sum/solution.ts: ${text}`);
    expect(verdict(lesson, passing, report)[0]).toBe(`sum/main.ts: ${text}`);
  }
  expect(verdict(lesson, { kind: "compile-error", errors: [{ message: "a" }, { message: "b" }] })).toEqual([
    "sum/solution.ts: ошибка компиляции: a",
    "sum/solution.ts: ошибка компиляции: b",
  ]);
});
