// ADR-0003: student code runs in an opaque-origin Sandbox. These tests submit
// hostile student code through the editor and check what it can and cannot do.
import type { Page } from "@playwright/test";
import { expect, test } from "./offline";
import { lesson } from "../src/lesson";

async function runStudentCode(page: Page, source: string) {
  await page.getByRole("textbox").fill(source);
  await page.getByRole("button", { name: "Run tests" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
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
  await expect(report).toContainText("Runtime error");
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

${lesson.starter}`,
  );

  const report = page.getByRole("region", { name: "Test Report" });
  await expect(report).toContainText("0 / 3 passed");
  await expect(report).not.toContainText("forged");
});

test.describe(() => {
  test.use({ expectedExternal: ["https://example.com/"] });

  test("student code's fetch to the Internet does not get through", async ({ page }) => {
    const failed = page.waitForEvent("requestfailed", (r) => r.url() === "https://example.com/");

    await runStudentCode(page, `fetch("https://example.com/");\n\n${lesson.starter}`);

    expect((await failed).failure()?.errorText).toContain("ERR_BLOCKED_BY_CLIENT");
    await expect(page.getByText("0 / 3 passed")).toBeVisible();
  });
});
