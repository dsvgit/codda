// Smoke test of `npm run dev`: course.json comes from its middleware.
import { expect, test } from "./offline";
import type { CourseData } from "../packages/codda/src/course-data";

test("npm run dev opens the first Lesson, and its Solution passes", async ({ page }) => {
  const course: CourseData = await (await page.request.get("course.json")).json();

  await page.goto("./");
  await expect(page.getByRole("heading", { name: "React Hooks · useState" })).toBeVisible();

  await page.getByRole("textbox", { name: "main.tsx" }).fill(course.modules[0].lessons[0].solution);
  await page.getByRole("button", { name: "▶ Запустить тесты" }).click();

  await expect(page.getByText("PASS · 3 / 3")).toBeVisible();
});
