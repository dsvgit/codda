import { expect, test } from "./offline";
// The Course Build of `codda build`: no Lesson in it has `errors` (BrokenLesson).
import type { CourseData, LessonData } from "../packages/codda/src/course-data";

test("student opens the Course, runs the starter, fixes it and sees every test pass, offline", async ({
  page,
  context,
  baseURL,
}) => {
  const course: CourseData = await (await page.request.get("course.json")).json();
  const useState = course.modules[0].lessons[0] as LessonData;
  // The Dependency Artifact: fetched by the Compiler Worker from our origin on
  // the first Run, once.
  expect(course.deps).toMatch(/^deps\/[0-9a-f]{16}\/$/);
  const importMap = await (await page.request.get(`${course.deps}importmap.json`)).json();
  const depsRequests: string[] = [];
  context.on("request", (request) => {
    if (request.url().includes("/deps/")) depsRequests.push(request.url());
  });

  await page.goto("./");
  await expect(page.getByRole("heading", { name: "React Hooks · useState" })).toBeVisible();
  const runTests = page.getByRole("button", { name: "▶ Запустить тесты" });

  await runTests.click();
  await expect(page.getByText("FAIL · 2 / 3")).toBeVisible();
  await expect(page.getByText("✗ opens on click", { exact: false })).toBeVisible();
  const artifactURLs = [`${course.deps}importmap.json`, ...Object.keys(importMap.integrity)];
  expect(depsRequests.sort()).toEqual(artifactURLs.map((path) => new URL(path, baseURL).href).sort());
  depsRequests.length = 0;

  await page.getByRole("textbox", { name: "main.tsx" }).fill(useState.solution);
  await runTests.click();

  await expect(page.getByText("PASS · 3 / 3")).toBeVisible();
  await expect(page.getByText("Все тесты пройдены")).toBeVisible();
  expect(depsRequests, "the second Run takes the artifact from the Worker's memory").toEqual([]);
});
