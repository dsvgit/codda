// The progress of a Course kept in localStorage (spec course-ux): ✓ at the
// passed Lessons and «Пройдено N из M». Runs on `npm run dev` and on the Course Build.
import { expect, test } from "./offline";
// The Course Build of `codda build`: no Lesson in it has `errors` (BrokenLesson).
import type { CourseData, LessonData } from "../packages/codda/src/course-data";

test("PASS marks the Lesson: ✓ and «Пройдено 1 из 5»; Reset and a reload keep them; the address without a Lesson opens the second one", async ({
  page,
}) => {
  const course: CourseData = await (await page.request.get("course.json")).json();
  const [first, second] = course.modules.flatMap((m) => m.lessons) as LessonData[];
  const tree = page.getByRole("navigation", { name: "Уроки курса" });
  const heading = (lesson: LessonData) => page.getByRole("heading", { name: `React Hooks · ${lesson.title}` });
  const mark = tree.getByRole("link", { name: first.title }).getByRole("img", { name: "пройден" });

  await page.goto(`./#/${first.id}`);
  await expect(heading(first)).toBeVisible();
  await expect(tree.getByText("Пройдено 0 из 5")).toBeVisible();
  await expect(tree.getByRole("img", { name: "пройден" })).toHaveCount(0);

  await page.getByRole("textbox", { name: first.workspace.name }).fill(first.solution);
  await page.getByRole("button", { name: "▶ Запустить тесты" }).click();
  await expect(page.getByText(/^PASS · (\d+) \/ \1$/)).toBeVisible();

  await expect(mark).toBeVisible();
  await expect(tree.getByText("Пройдено 1 из 5")).toBeVisible();
  await expect(tree.getByRole("progressbar")).toHaveAttribute("value", "1");

  await page.getByRole("button", { name: "↺ Сбросить" }).click();
  await page.reload();

  await expect(heading(first)).toBeVisible();
  await expect(mark).toBeVisible();
  await expect(tree.getByText("Пройдено 1 из 5")).toBeVisible();
  await expect(tree.getByRole("img", { name: "пройден" })).toHaveCount(1);

  await page.goto("./");

  await expect(heading(second)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#/${second.id}$`));
});
