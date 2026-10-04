import { expect, test } from "vitest";
import { run } from "../packages/codda/src/runtime/runner";
import { lessons } from "./index";

test.each(Object.entries(lessons))("%s: solution passes every lesson test", async (_, lesson) => {
  const report = await run({ source: lesson.solution, tests: lesson.tests });

  expect(report.kind).toBe("tests");
  if (report.kind !== "tests") return;
  expect(report.results.length).toBeGreaterThan(0);
  expect(report.results.filter((r) => r.status === "fail")).toEqual([]);
});
