// The pilot through a student's eyes (spec pilot-course): the Course Build of
// React Hooks that CI deploys, served from a subpath, offline. Solutions come
// from the built course.json, not from the Course sources.
import type { Page } from "@playwright/test";
import { expect, test } from "./offline";
// The Course Build of `codda build`: no Lesson in it has `errors` (BrokenLesson).
import type { CourseData, LessonData } from "../packages/codda/src/course-data";

async function lessonsOf(page: Page): Promise<LessonData[]> {
  const course: CourseData = await (await page.request.get("course.json")).json();
  return course.modules.flatMap((m) => m.lessons) as LessonData[];
}

const heading = (page: Page, lesson: LessonData) =>
  page.getByRole("heading", { name: `React Hooks · ${lesson.title}` });
const tree = (page: Page) => page.getByRole("navigation", { name: "Уроки курса" });
const editor = (page: Page, lesson: LessonData) => page.getByRole("textbox", { name: lesson.workspace.name });

// The student pastes the code into the Workspace. A paste is one CodeMirror
// transaction: `fill` under load sometimes doubles the text
// (.scratch/mvp-autorun/README.md, «Отложенные проблемы», course-ux review).
async function paste(page: Page, lesson: LessonData, text: string) {
  const box = editor(page, lesson);
  await box.click();
  await box.press("ControlOrMeta+a");
  await box.evaluate((element, text) => {
    const data = new DataTransfer();
    data.setData("text/plain", text);
    element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, text);
  // CodeMirror draws a line per element: textContent has no line breaks.
  await expect(box).toHaveText(text.replaceAll("\n", ""));
}

test("the student passes the 5 Lessons in a row with «Следующий урок →» and sees «Пройдено 5 из 5»; the last one has no next Lesson", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const lessons = await lessonsOf(page);
  expect(lessons).toHaveLength(5);

  await page.goto("./");
  await expect(tree(page).getByText("Пройдено 0 из 5")).toBeVisible();

  for (const [index, lesson] of lessons.entries()) {
    await test.step(lesson.id, async () => {
      await expect(heading(page, lesson)).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`#/${lesson.id}$`));

      await paste(page, lesson, lesson.solution);
      await page.getByRole("button", { name: "▶ Запустить тесты" }).click();

      await expect(page.getByText(/^PASS · (\d+) \/ \1$/)).toBeVisible();
      await expect(tree(page).getByRole("link", { name: lesson.title }).getByRole("img", { name: "пройден" })).toBeVisible();
      await expect(tree(page).getByText(`Пройдено ${index + 1} из 5`)).toBeVisible();
      if (index < lessons.length - 1) await page.getByRole("button", { name: "Следующий урок →" }).click();
    });
  }

  await expect(page.getByText("Это последний урок курса")).toBeVisible();
  await expect(page.getByRole("button", { name: "Следующий урок →" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Следующий →" })).toBeDisabled();
  await expect(heading(page, lessons[4])).toBeVisible();
  await expect(tree(page).getByRole("img", { name: "пройден" })).toHaveCount(5);
});

test("Run on the Starter of every Lesson gives FAIL: no ✓, the progress stays «Пройдено 0 из 5»", async ({ page }) => {
  test.setTimeout(90_000);
  const lessons = await lessonsOf(page);

  for (const lesson of lessons) {
    await test.step(lesson.id, async () => {
      await page.goto(`./#/${lesson.id}`);
      await expect(heading(page, lesson)).toBeVisible();
      await page.getByRole("button", { name: "▶ Запустить тесты" }).click();

      await expect(page.getByText(/^FAIL · \d+ \/ \d+$/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Следующий урок →" })).toHaveCount(0);
      await expect(tree(page).getByRole("img", { name: "пройден" })).toHaveCount(0);
      await expect(tree(page).getByText("Пройдено 0 из 5")).toBeVisible();
    });
  }
});

test("after a reload the same Lesson is open, with the progress and the typed Workspace", async ({ page }) => {
  const [first, second] = await lessonsOf(page);
  const typed = second.solution.replace(/\n*$/, "\n// не доделано\n");

  await page.goto("./");
  await paste(page, first, first.solution);
  await page.getByRole("button", { name: "▶ Запустить тесты" }).click();
  await expect(page.getByText(/^PASS · (\d+) \/ \1$/)).toBeVisible();
  await page.getByRole("button", { name: "Следующий урок →" }).click();
  await expect(heading(page, second)).toBeVisible();
  await paste(page, second, typed);

  await page.reload();

  await expect(heading(page, second)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#/${second.id}$`));
  await expect(editor(page, second)).toHaveText(typed.replaceAll("\n", ""));
  await expect(tree(page).getByText("Пройдено 1 из 5")).toBeVisible();
  await expect(tree(page).getByRole("link", { name: first.title }).getByRole("img", { name: "пройден" })).toBeVisible();
});
