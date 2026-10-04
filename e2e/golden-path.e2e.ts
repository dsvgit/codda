import { expect, test } from "./offline";
import { lessons } from "../courses";
import { lesson } from "../src/lesson";

test("student runs the starter, fixes it and sees every test pass, offline", async ({ page }) => {
  await page.goto("./");
  const runTests = page.getByRole("button", { name: "Run tests" });

  await runTests.click();
  await expect(page.getByText("0 / 3 passed")).toBeVisible();

  await page.getByRole("textbox").fill(lesson.solution);
  await runTests.click();

  await expect(page.getByText("3 / 3 passed")).toBeVisible();
});

test("student opens a course Lesson by its id and passes it, offline", async ({ page }) => {
  const id = "react-hooks/01-use-state";
  await page.goto(`./?lesson=${id}`);
  await expect(page.getByRole("heading", { name: lessons[id].title })).toBeVisible();

  await page.getByRole("textbox").fill(lessons[id].solution);
  await page.getByRole("button", { name: "Run tests" }).click();

  await expect(page.getByText(/^(\d+) \/ \1 passed$/)).toBeVisible();
});
