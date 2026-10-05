// Moving between the Lessons of a Course (spec course-ux): the toolbar, the
// PASS banner, the fragment `#/<lesson id>` and the browser's history. Runs on
// `npm run dev` and on the Course Build.
import { expect, test } from "./offline";
// The Course Build of `codda build`: no Lesson in it has `errors` (BrokenLesson).
import type { CourseData, LessonData } from "../packages/codda/src/course-data";

test("Следующий → , the Solution, PASS, «Следующий урок →»; «Назад» and a reload keep the Lesson, course.json does not load again", async ({
  page,
}) => {
  const course: CourseData = await (await page.request.get("course.json")).json();
  const [first, second, third] = course.modules.flatMap((m) => m.lessons) as LessonData[];
  const courseLoads: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith("/course.json")) courseLoads.push(request.url());
  });
  const heading = (lesson: LessonData) => page.getByRole("heading", { name: `React Hooks · ${lesson.title}` });

  await page.goto("./");
  await expect(heading(first)).toBeVisible();
  await expect(page.getByRole("button", { name: "← Предыдущий" })).toBeDisabled();
  // `npm run dev` loads it twice on start: React's StrictMode runs the effect twice.
  courseLoads.length = 0;

  await page.getByRole("button", { name: "Следующий →" }).click();

  await expect(heading(second)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#/${second.id}$`));

  await page.getByRole("textbox", { name: "main.tsx" }).fill(second.solution);
  await page.getByRole("button", { name: "▶ Запустить тесты" }).click();
  await expect(page.getByText(/^PASS · (\d+) \/ \1$/)).toBeVisible();

  await page.getByRole("button", { name: "Следующий урок →" }).click();

  await expect(heading(third)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#/${third.id}$`));
  expect(courseLoads, "no page load between Lessons").toEqual([]);

  await page.goBack();

  await expect(heading(second)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#/${second.id}$`));

  await page.reload();

  await expect(heading(second)).toBeVisible();
});

for (const [name, fragment] of [
  ["no fragment", ""],
  ["#/", "#/"],
  ["an unknown Lesson id", "#/no-such-lesson"],
]) {
  test(`${name} opens the first Lesson, its id in the fragment; «Назад» does not go to the old address`, async ({
    page,
  }) => {
    await page.goto("./#/use-effect");
    await expect(page.getByRole("heading", { name: "React Hooks · useEffect" })).toBeVisible();

    await page.goto(`./${fragment}`);

    await expect(page.getByRole("heading", { name: "React Hooks · useState" })).toBeVisible();
    await expect(page).toHaveURL(/#\/use-state$/);
    await expect(page.getByText("не найден")).toHaveCount(0);

    await page.goBack();

    await expect(page.getByRole("heading", { name: "React Hooks · useEffect" })).toBeVisible();
  });
}

test("the Course tree: a click on the third Lesson opens it; «Свернуть список уроков» hides the Lessons, «Развернуть список уроков» brings them back", async ({
  page,
}) => {
  const tree = page.getByRole("navigation", { name: "Уроки курса" });
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "React Hooks · useState" })).toBeVisible();
  await expect(tree.getByRole("link")).toHaveCount(5);

  await tree.getByRole("link").nth(2).click();

  await expect(page.getByRole("heading", { name: "React Hooks · useRef" })).toBeVisible();
  await expect(page).toHaveURL(/#\/use-ref$/);
  await expect(tree.getByRole("link", { name: "useRef" })).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Свернуть список уроков" }).click();

  await expect(tree.getByRole("link")).toHaveCount(0);

  await page.getByRole("button", { name: "Развернуть список уроков" }).click();

  await expect(tree.getByRole("link")).toHaveCount(5);
  await expect(tree.getByRole("link", { name: "useRef" })).toBeVisible();
});
