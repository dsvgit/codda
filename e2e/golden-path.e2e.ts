import { expect, test } from "./offline";
import type { CourseData } from "../packages/codda/src/course-data";

test("student opens the Course, runs the starter, fixes it and sees every test pass, offline", async ({
  page,
}) => {
  const course: CourseData = await (await page.request.get("course.json")).json();
  const useState = course.modules[0].lessons[0];

  await page.goto("./");
  await expect(page.getByRole("heading", { name: "React Hooks · useState" })).toBeVisible();
  const runTests = page.getByRole("button", { name: "Run tests" });

  await runTests.click();
  await expect(page.getByText("2 / 3 passed")).toBeVisible();
  await expect(page.getByText("✗ opens on click", { exact: false })).toBeVisible();

  await page.getByRole("textbox").fill(useState.solution);
  await runTests.click();

  await expect(page.getByText("3 / 3 passed")).toBeVisible();
});
