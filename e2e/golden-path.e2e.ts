import { expect, test } from "./offline";
import { lesson } from "../src/lesson";

test("student runs the starter, fixes it and sees every test pass, offline", async ({ page }) => {
  await page.goto("/");
  const runTests = page.getByRole("button", { name: "Run tests" });

  await runTests.click();
  await expect(page.getByText("0 / 3 passed")).toBeVisible();

  await page.getByRole("textbox").fill(lesson.solution);
  await runTests.click();

  await expect(page.getByText("3 / 3 passed")).toBeVisible();
});
