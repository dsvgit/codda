// A Compiler Worker that cannot load esbuild.wasm (the network blinked): the
// Run ends at once with «Внутренняя ошибка», and the next Run works without
// reloading the page.
import { expect, test } from "./offline";
// The Course Build of `codda build`: no Lesson in it has `errors` (BrokenLesson).
import type { CourseData, LessonData } from "../packages/codda/src/course-data";

const RED = "rgb(207, 34, 46)";

test("esbuild.wasm that fails to load gives «Внутренняя ошибка» before the deadline; the next Run passes", async ({
  page,
}) => {
  const course: CourseData = await (await page.request.get("course.json")).json();
  const useState = course.modules[0].lessons[0] as LessonData;
  await page.route(/esbuild.*\.wasm/, (route) => route.abort());
  await page.goto("./");
  await page.getByRole("textbox", { name: "main.tsx" }).fill(useState.solution);
  const runTests = page.getByRole("button", { name: "▶ Запустить тесты" });
  const report = page.getByRole("region", { name: "Test Report" });

  const started = Date.now();
  await runTests.click();

  const heading = report.getByRole("heading", { name: "Внутренняя ошибка" });
  await expect(heading).toBeVisible();
  expect(Date.now() - started).toBeLessThan(5000);
  await expect(heading).toHaveCSS("color", RED);
  await expect(report.getByText("Запустите тесты ещё раз.")).toBeVisible();

  await page.unrouteAll();
  await runTests.click();

  await expect(page.getByText("PASS · 3 / 3")).toBeVisible();
});
