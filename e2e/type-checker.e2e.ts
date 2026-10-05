// The Type Checker in the Workspace editor (ADR-0009): TS errors are
// underlined with their message and code on hover, from lib files and
// types.json of our own origin only (offline fixture).
import type { Page } from "@playwright/test";
import { expect, test } from "./offline";
// The Course Build of `codda build`: no Lesson in it has `errors` (BrokenLesson).
import type { CourseData, LessonData } from "../packages/codda/src/course-data";

const underlines = (page: Page) => page.locator(".cm-content .cm-lintRange-error");

/** The tooltip of the `nth` underline: its messages, one per diagnostic. */
async function hoverText(page: Page, nth = 0) {
  await page.mouse.move(0, 0);
  await underlines(page).nth(nth).hover();
  const tooltip = page.locator(".cm-tooltip-lint");
  await expect(tooltip).toBeVisible();
  return tooltip.innerText();
}

async function useState(page: Page) {
  const course: CourseData = await (await page.request.get("course.json")).json();
  return course.modules[0].lessons[0] as LessonData;
}

/** A line that is surely a type error: it proves the check of the text above it is done. */
const MARKER = `\nexport const marker: number = "not a number";\n`;

test("a type error is underlined, its message and code on hover; a fix removes it", async ({ page }) => {
  await page.goto("./#/use-state");
  const editor = page.getByRole("textbox", { name: "main.tsx" });

  await editor.fill(`import { useState } from "react";

export function Spoiler() {
  const [open, setOpen] = useState(false);
  setOpen("yes");
  return <div>{String(open)}</div>;
}
`);

  await expect(underlines(page)).toHaveCount(1);
  await expect(underlines(page)).toHaveText(`"yes"`);
  expect(await hoverText(page)).toBe(
    `Argument of type '"yes"' is not assignable to parameter of type 'SetStateAction<boolean>'. (TS2345)`,
  );

  await editor.fill(`import { useState } from "react";

export function Spoiler() {
  const [open, setOpen] = useState(false);
  setOpen(true);
  return <div>{String(open)}</div>;
}
${MARKER}`);
  await expect(underlines(page)).toHaveCount(1);
  await expect(underlines(page)).toHaveText(`marker`);
});

test("the Solution of React Hooks has no underline: react, react-dom/client and JSX resolve from types.json", async ({
  page,
}) => {
  const lesson = await useState(page);
  await page.goto("./#/use-state");

  // The Solution renders with react-dom/client in the Lesson Tests; here the student's file uses it too.
  await page.getByRole("textbox", { name: "main.tsx" }).fill(
    `${lesson.solution}
import { createRoot } from "react-dom/client";
export const mount = (el: HTMLElement) => createRoot(el).render(<Spoiler />);
${MARKER}`,
  );

  await expect(underlines(page)).toHaveCount(1);
  await expect(underlines(page)).toHaveText("marker");
});

test("a syntax error is underlined with its TS code", async ({ page }) => {
  await page.goto("./#/use-state");

  await page.getByRole("textbox", { name: "main.tsx" }).fill(`export function add(a: number, b: number) {
  return a +;
}
`);

  await expect(underlines(page)).toHaveCount(1);
  expect(await hoverText(page)).toBe("Expression expected. (TS1109)");
});

test("only errors: the unused import of the Starter and an unused variable are not underlined", async ({ page }) => {
  const lesson = await useState(page);
  expect(lesson.workspace.starter).toContain('import { useState } from "react";');
  await page.goto("./#/use-state");

  await page.getByRole("textbox", { name: "main.tsx" }).fill(`${lesson.workspace.starter}
function unused(param: number) {
  const nobody = 1;
}
${MARKER}`);

  await expect(underlines(page)).toHaveCount(1);
  await expect(underlines(page)).toHaveText("marker");
});

test("toSorted and Object.groupBy are not underlined, and a Run with them passes (ESNext for both)", async ({
  page,
}) => {
  const lesson = await useState(page);
  await page.goto("./#/use-state");

  await page.getByRole("textbox", { name: "main.tsx" }).fill(`${lesson.solution}
export const sorted = [3, 1, 2].toSorted();
export const groups = Object.groupBy([1, 2, 3], (n) => (n % 2 ? "odd" : "even"));
console.log(sorted.join(","), Object.keys(groups).join(","));
`);
  await page.getByRole("button", { name: "▶ Запустить тесты" }).click();

  await expect(page.getByText("PASS · 3 / 3")).toBeVisible();
  await page.getByRole("tab", { name: /Console/ }).click();
  await expect(page.getByText("1,2,3 odd,even")).toBeVisible();
  // The check of this text is done once the Run is: there is nothing to underline.
  await page.getByRole("textbox", { name: "main.tsx" }).press("End");
  await page.keyboard.type(MARKER);
  await expect(underlines(page)).toHaveCount(1);
  await expect(underlines(page)).toHaveText("marker");
});

test("an import of a package the Course does not have is Cannot find module (TS2307)", async ({ page }) => {
  await page.goto("./#/use-state");

  await page.getByRole("textbox", { name: "main.tsx" }).fill(`import { debounce } from "lodash";\nexport const d = debounce;\n`);

  await expect(underlines(page)).toHaveCount(1);
  expect(await hoverText(page)).toMatch(/^Cannot find module 'lodash' or its corresponding type declarations\. \(TS2307\)$/);
});

test("a Run with a type error runs the tests and gives the usual Test Report", async ({ page }) => {
  const lesson = await useState(page);
  await page.goto("./#/use-state");

  await page.getByRole("textbox", { name: "main.tsx" }).fill(`${lesson.solution}${MARKER}`);
  await expect(underlines(page)).toHaveCount(1);
  await page.getByRole("button", { name: "▶ Запустить тесты" }).click();

  await expect(page.getByText("PASS · 3 / 3")).toBeVisible();
});

test("the compile error of a Run and the type errors are underlined side by side", async ({ page }) => {
  await page.goto("./#/use-state");

  await page.getByRole("textbox", { name: "main.tsx" }).fill(`import { debounce } from "lodash";
export const d = debounce;
${MARKER}`);
  await expect(underlines(page)).toHaveCount(2);
  await page.getByRole("button", { name: "▶ Запустить тесты" }).click();
  await expect(page.getByRole("heading", { name: "Ошибка компиляции" })).toBeVisible();

  // Line 1: the Compiler's error next to TS2307; the marker line keeps its own.
  await expect.poll(() => hoverText(page, 0)).toContain('Импорт "lodash" не предусмотрен заданием');
  expect(await hoverText(page, 0)).toContain("(TS2307)");
  await expect(underlines(page).filter({ hasText: "marker" })).toHaveCount(1);
});

test("the read-only editor of «Решение» underlines nothing", async ({ page }) => {
  await page.goto("./#/use-state");
  await page.getByRole("textbox", { name: "main.tsx" }).fill(`export const n: number = "1";\n`);
  await expect(underlines(page)).toHaveCount(1);

  await page.getByRole("button", { name: "Показать решение" }).click();
  await expect(page.getByRole("textbox", { name: "Решение" })).toBeVisible();
  // Its text has the unused-in-isolation import of a Solution and no errors; a
  // checked editor would be checked after the same 300 ms as the Workspace.
  await page.waitForTimeout(1000);
  await expect(page.locator(".tab-body .cm-lintRange-error")).toHaveCount(0);
  await expect(underlines(page)).toHaveCount(1);
});

test("a Course without a Dependency Artifact: lib files only, no types.json, an error is underlined", async ({
  page,
}) => {
  const lesson: LessonData = {
    id: "add",
    title: "Сложение",
    instructions: "<p>Сложите.</p>",
    workspace: { name: "main.ts", starter: "export const add = (a: number, b: number) => a - b;\n" },
    solution: "export const add = (a: number, b: number) => a + b;\n",
    tests: 'import { test, expect } from "@codda/test";\nimport { add } from "./main";\ntest("adds", () => expect(add(1, 2)).toBe(3));\n',
    testsName: "lesson.test.ts",
  };
  const course: CourseData = { id: "plain", title: "Plain", deps: null, modules: [{ title: "M", lessons: [lesson] }] };
  await page.route("**/course.json", (route) => route.fulfill({ json: course }));
  const typesRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("types.json")) typesRequests.push(request.url());
  });
  await page.goto("./");

  await page.getByRole("textbox", { name: "main.ts" }).fill(`export const add = (a: number, b: number): string => a + b;\n`);

  await expect(underlines(page)).toHaveCount(1);
  expect(await hoverText(page)).toBe("Type 'number' is not assignable to type 'string'. (TS2322)");
  expect(typesRequests).toEqual([]);
});
