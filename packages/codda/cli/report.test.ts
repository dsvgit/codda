// The report of `codda test`: a line per Lesson with its errors and warnings
// under it, and the summary line.
import { expect, test } from "vitest";
import { formatLesson, formatSummary } from "./report.ts";

test("a passed Lesson: ✓ and its id", () => {
  expect(formatLesson({ id: "sum", errors: [], warnings: [] })).toBe("✓ sum\n");
});

test("a failed Lesson: ✗, errors indented under it, warnings after them", () => {
  expect(formatLesson({ id: "sum", errors: ["sum/solution.ts: a", "sum/solution.ts: b"], warnings: ["sum/main.ts: w"] })).toBe(
    "✗ sum\n  sum/solution.ts: a\n  sum/solution.ts: b\n  sum/main.ts: w\n",
  );
});

test("a Lesson with warnings only: ⚠, it still counts as passed", () => {
  const lesson = { id: "sum", errors: [], warnings: ["sum/main.ts: w"] };
  expect(formatLesson(lesson)).toBe("⚠ sum\n  sum/main.ts: w\n");
  expect(formatSummary([lesson, { id: "greet", errors: [], warnings: [] }])).toBe("2 из 2 Lesson прошли, 1 предупреждение\n");
});

test("summary: passed of all, warnings only when there are some, Russian plural", () => {
  const ok = { id: "a", errors: [], warnings: [] };
  const failed = { id: "b", errors: ["b/main.ts: x"], warnings: [] };
  expect(formatSummary([ok, failed])).toBe("1 из 2 Lesson прошли\n");
  expect(formatSummary([ok], 2)).toBe("1 из 1 Lesson прошли, 2 предупреждения\n");
  expect(formatSummary([ok], 5)).toBe("1 из 1 Lesson прошли, 5 предупреждений\n");
  expect(formatSummary([ok], 11)).toBe("1 из 1 Lesson прошли, 11 предупреждений\n");
  expect(formatSummary([ok], 21)).toBe("1 из 1 Lesson прошли, 21 предупреждение\n");
});

test("colour: ✓ green, ✗ red, ⚠ yellow — only the mark, only when asked", () => {
  const ok = { id: "a", errors: [], warnings: [] };
  const failed = { id: "b", errors: ["b/main.ts: x"], warnings: [] };
  const warned = { id: "c", errors: [], warnings: ["c/main.ts: w"] };

  expect(formatLesson(ok, true)).toBe("\x1b[32m✓\x1b[0m a\n");
  expect(formatLesson(failed, true)).toBe("\x1b[31m✗\x1b[0m b\n  b/main.ts: x\n");
  expect(formatLesson(warned, true)).toBe("\x1b[33m⚠\x1b[0m c\n  c/main.ts: w\n");
  expect(formatLesson(failed, false)).toBe("✗ b\n  b/main.ts: x\n");
});
