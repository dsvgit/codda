// The Workspace kept in localStorage (spec course-ux): a reload, a move to
// another Lesson and back, «↺ Сбросить». Runs on `npm run dev` and on the Course Build.
import { expect, test } from "./offline";

const editor = (page: import("@playwright/test").Page) => page.getByRole("textbox", { name: /^main\.tsx?$/ });
const heading = (page: import("@playwright/test").Page, title: string) =>
  page.getByRole("heading", { name: `React Hooks · ${title}` });
const mine = "// my code\n";

test("an edit stays after a reload", async ({ page }) => {
  await page.goto("./#/use-state");
  await expect(heading(page, "useState")).toBeVisible();
  await editor(page).fill(mine);

  await page.reload();

  await expect(heading(page, "useState")).toBeVisible();
  await expect(editor(page)).toHaveText("// my code");
});

test("an edit in a Lesson stays after «Следующий →» and «← Предыдущий»", async ({ page }) => {
  await page.goto("./#/use-state");
  await editor(page).fill(mine);

  await page.getByRole("button", { name: "Следующий →" }).click();
  await expect(heading(page, "useEffect")).toBeVisible();
  await expect(editor(page)).not.toHaveText("// my code");
  await page.getByRole("button", { name: "← Предыдущий" }).click();

  await expect(heading(page, "useState")).toBeVisible();
  await expect(editor(page)).toHaveText("// my code");
});

test("after «↺ Сбросить» a reload opens the Starter", async ({ page }) => {
  await page.goto("./#/use-state");
  await expect(editor(page)).not.toHaveText("");
  const starter = await editor(page).textContent();
  await editor(page).fill(mine);
  await page.getByRole("button", { name: "↺ Сбросить" }).click();
  await expect(editor(page)).toHaveText(starter!);

  await page.reload();

  await expect(heading(page, "useState")).toBeVisible();
  await expect(editor(page)).toHaveText(starter!);
});

test("a Workspace saved before the page opens is what the Lesson opens with, not the Starter", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("codda:react-hooks/use-state:workspace", "// saved before\n"));

  await page.goto("./#/use-state");

  await expect(heading(page, "useState")).toBeVisible();
  await expect(editor(page)).toHaveText("// saved before");
  await expect(page.getByText("Код и прогресс не сохраняются")).toHaveCount(0);
});
