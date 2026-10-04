// The UI on a Course Build: loading course.json, choosing a Lesson by
// `#/<lesson id>`, and every Solution of the Course passing its Lesson Tests.
import { expect, test } from "./offline";
import type { CourseData } from "../packages/codda/src/course-data";

test("Solution of every Lesson in course.json passes all its tests, offline", async ({ page }) => {
  test.setTimeout(90_000);
  const course: CourseData = await (await page.request.get("course.json")).json();
  const lessons = course.modules.flatMap((m) => m.lessons);
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

      await page.getByRole("textbox").fill(lesson.solution);
      await page.getByRole("button", { name: "Run tests" }).click();

      await expect(page.getByText(/^(\d+) \/ \1 passed$/)).toBeVisible();
    });
  }
});

test("#/use-effect opens that Lesson, with its titles and Workspace", async ({ page }) => {
  await page.goto("./#/use-effect");

  await expect(page.getByRole("heading", { name: "React Hooks · useEffect" })).toBeVisible();
  await expect(page).toHaveTitle("useEffect — React Hooks");
  await expect(page.getByRole("heading", { name: "main.tsx" })).toBeVisible();
  await expect(page.getByText("Компонент `ClickTitle` уже считает клики.", { exact: false })).toBeVisible();
});

test("an unknown Lesson id shows a message with a link to the first Lesson", async ({ page }) => {
  await page.goto("./#/no-such-lesson");

  await expect(page.getByText("Урок „no-such-lesson“ не найден")).toBeVisible();
  await page.getByRole("link", { name: "useState" }).click();

  await expect(page.getByRole("heading", { name: "React Hooks · useState" })).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Run tests" })).toHaveCount(0);
});

test("after a network failure, «Обновить» loads the Course again", async ({ page }) => {
  await page.route("**/course.json", (route) => route.abort("failed"));
  await page.goto("./");
  await expect(page.getByText("Не удалось загрузить курс")).toBeVisible();

  await page.unroute("**/course.json");
  await page.getByRole("button", { name: "Обновить" }).click();

  await expect(page.getByRole("heading", { name: "React Hooks · useState" })).toBeVisible();
});
