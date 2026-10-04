// ADR-0003: student code runs in an opaque-origin Sandbox. These tests submit
// hostile student code through the editor and check what it can and cannot do.
import type { Page } from "@playwright/test";
import { expect, test } from "./offline";
// The Course Build of `codda build`: no Lesson in it has `errors` (BrokenLesson).
import type { CourseData, LessonData } from "../packages/codda/src/course-data";

// The first Lesson, use-state; its Starter passes 2 of 3 tests: the button does nothing.
let starter: string;

async function runStudentCode(page: Page, source: string) {
  await page.getByRole("textbox", { name: "main.tsx" }).fill(source);
  await page.getByRole("button", { name: "▶ Запустить тесты" }).click();
}

test.beforeEach(async ({ page }) => {
  const course: CourseData = await (await page.request.get("course.json")).json();
  starter = (course.modules[0].lessons[0] as LessonData).workspace.starter;
  await page.goto("./");
});

test("student code cannot read the app's document, cookies or storage", async ({ page }) => {
  await page.evaluate(() => {
    document.cookie = "session=app-secret";
    localStorage.setItem("token", "app-secret");
  });

  await runStudentCode(
    page,
    `function probe(name: string, read: () => unknown): string {
  try {
    return name + " = " + JSON.stringify(read());
  } catch (e) {
    return name + " threw " + (e as Error).name;
  }
}

throw new Error(
  [
    probe("parent.document", () => parent.document.cookie),
    probe("document.cookie", () => document.cookie),
    probe("localStorage", () => localStorage.getItem("token")),
  ].join("; "),
);
`,
  );

  const report = page.getByRole("region", { name: "Test Report" });
  await expect(report).toContainText("Ошибка выполнения");
  await expect(report).toContainText("parent.document threw SecurityError");
  await expect(report).toContainText("document.cookie threw SecurityError");
  await expect(report).toContainText("localStorage threw SecurityError");
  await expect(report).not.toContainText("app-secret");
});

test("messages of a foreign shape or for another Run do not change the Test Report", async ({
  page,
}) => {
  await runStudentCode(
    page,
    `declare const __coddaRunId: string;

const forged = { kind: "tests", results: [{ name: "forged", status: "pass" }] };
parent.postMessage("codda:report", "*");
parent.postMessage({ type: "codda:report", runId: "another-run", report: forged }, "*");
parent.postMessage({ type: "codda:result", runId: __coddaRunId, report: forged }, "*");
parent.postMessage({ type: "codda:report", runId: __coddaRunId, report: { kind: "tests", results: "all" } }, "*");
parent.postMessage({ type: "codda:report", runId: __coddaRunId, report: { kind: "timeout", ms: 1 } }, "*");

${starter}`,
  );

  const report = page.getByRole("region", { name: "Test Report" });
  await expect(report).toContainText("FAIL · 2 / 3");
  await expect(report).not.toContainText("forged");
});

test.describe(() => {
  test.use({ expectedExternal: ["https://example.com/"] });

  test("student code's fetch to the Internet does not get through", async ({ page }) => {
    // The request is seen, and the offline fixture aborts it. Not
    // "requestfailed": the Run removes the Sandbox iframe right after its
    // report, and if that beats the abort, Playwright never emits the event.
    const request = page.waitForRequest("https://example.com/");

    // The rejection is caught: unhandled, it would fail the running test (R8).
    await runStudentCode(page, `fetch("https://example.com/").catch(() => {});\n\n${starter}`);

    await request;
    await expect(page.getByText("FAIL · 2 / 3")).toBeVisible();
  });
});
