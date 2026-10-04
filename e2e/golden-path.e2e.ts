import { expect, test } from "./offline";
import type { CourseData } from "../packages/codda/src/course-data";

test("student opens the Course, runs the starter, fixes it and sees every test pass, offline", async ({
  page,
}) => {
  const course: CourseData = await (await page.request.get("course.json")).json();
  const useState = course.modules[0].lessons[0];

  await page.goto("./");
  await expect(page.getByRole("heading", { name: "React Hooks · useState" })).toBeVisible();
  const runTests = page.getByRole("button", { name: "▶ Запустить тесты" });

  await runTests.click();
  await expect(page.getByText("FAIL · 2 / 3")).toBeVisible();
  await expect(page.getByText("✗ opens on click", { exact: false })).toBeVisible();

  await page.getByRole("textbox", { name: "main.tsx" }).fill(useState.solution);
  await runTests.click();

  await expect(page.getByText("PASS · 3 / 3")).toBeVisible();
  await expect(page.getByText("Все тесты пройдены")).toBeVisible();
});
