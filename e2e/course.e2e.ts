// The UI on a Course Build: loading course.json, choosing a Lesson by
// `#/<lesson id>`, and every Solution of the Course passing its Lesson Tests.
import { expect, test } from "./offline";
// The Course Build of `codda build`: no Lesson in it has `errors` (BrokenLesson).
import type { CourseData, LessonData } from "../packages/codda/src/course-data";

test("Solution of every Lesson in course.json passes all its tests, offline", async ({ page }) => {
  test.setTimeout(90_000);
  const course: CourseData = await (await page.request.get("course.json")).json();
  const lessons = course.modules.flatMap((m) => m.lessons) as LessonData[];
  expect(lessons.map((l) => l.id)).toEqual([
    "use-state",
    "use-effect",
    "use-ref",
    "use-reducer",
    "use-context",
  ]);

  await page.goto("./");
  for (const lesson of lessons) {
    await test.step(lesson.id, async () => {
      // Same page, another fragment: the Lesson opens from a clean slate.
      await page.goto(`./#/${lesson.id}`);
      await expect(page.getByRole("heading", { name: `React Hooks · ${lesson.title}` })).toBeVisible();
      await expect(page.getByRole("region", { name: "Test Report" })).toHaveCount(0);

      await page.getByRole("textbox", { name: "main.tsx" }).fill(lesson.solution);
      await page.getByRole("button", { name: "▶ Запустить тесты" }).click();

      await expect(page.getByText(/^PASS · (\d+) \/ \1$/)).toBeVisible();
    });
  }
});

test("#/use-effect opens that Lesson, with its titles and Workspace", async ({ page }) => {
  await page.goto("./#/use-effect");

  await expect(page.getByRole("heading", { name: "React Hooks · useEffect" })).toBeVisible();
  await expect(page).toHaveTitle("useEffect — React Hooks");
  await expect(page.getByRole("heading", { name: "main.tsx" })).toBeVisible();
  await expect(page.getByText("уже считает клики.", { exact: false })).toBeVisible();
});

test("Instructions of use-state are shown formatted, without the frontmatter", async ({ page }) => {
  await page.goto("./#/use-state");

  const instructions = page.getByRole("region", { name: "Instructions" });
  await expect(instructions.getByRole("code").filter({ hasText: /^useState$/ })).toBeVisible();
  await expect(instructions).not.toContainText("title:");
  await expect(instructions).not.toContainText("---");
  await expect(instructions).not.toContainText("`");
});

test("another fragment resets the editor, the Test Report and the tab to «Тесты»", async ({ page }) => {
  const course: CourseData = await (await page.request.get("course.json")).json();
  const useEffect = course.modules.flatMap((m) => m.lessons).find((l) => l.id === "use-effect") as LessonData;
  await page.goto("./#/use-state");
  await page.getByRole("textbox", { name: "main.tsx" }).fill("export const edited = 1;\n");
  await page.getByRole("button", { name: "▶ Запустить тесты" }).click();
  await expect(page.getByRole("region", { name: "Test Report" })).toBeVisible();
  await page.getByRole("button", { name: "Показать решение" }).click();
  await expect(page.getByRole("tab", { name: "Решение" })).toHaveAttribute("aria-selected", "true");

  await page.goto("./#/use-effect");

  await expect(page.getByRole("heading", { name: "React Hooks · useEffect" })).toBeVisible();
  // CodeMirror draws a line per element: textContent has no line breaks.
  await expect(page.getByRole("textbox", { name: "main.tsx" })).toHaveText(
    useEffect.workspace.starter.replaceAll("\n", ""),
  );
  await expect(page.getByRole("tab", { name: "Тесты" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Тесты" })).toHaveText("Тесты");
  await expect(page.getByRole("region", { name: "Test Report" })).toHaveCount(0);
  await expect(page.getByText("Нажмите „Запустить тесты“")).toBeVisible();
});

test("while course.json loads, the page says so", async ({ page }) => {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/course.json", async (route) => {
    await released;
    await route.fallback();
  });

  await page.goto("./");
  await expect(page.getByText("Загрузка курса…")).toBeVisible();

  release();
  await expect(page.getByRole("heading", { name: "React Hooks · useState" })).toBeVisible();
});

test("404 on course.json shows that the Course did not load", async ({ page }) => {
  await page.route("**/course.json", (route) => route.fulfill({ status: 404 }));

  await page.goto("./");

  await expect(page.getByText("Не удалось загрузить курс")).toBeVisible();
  await expect(page.getByRole("button", { name: "▶ Запустить тесты" })).toHaveCount(0);
});

test("after a network failure, «Обновить» loads the Course again", async ({ page }) => {
  await page.route("**/course.json", (route) => route.abort("failed"));
  await page.goto("./");
  await expect(page.getByText("Не удалось загрузить курс")).toBeVisible();

  await page.unroute("**/course.json");
  await page.getByRole("button", { name: "Обновить" }).click();

  await expect(page.getByRole("heading", { name: "React Hooks · useState" })).toBeVisible();
});
