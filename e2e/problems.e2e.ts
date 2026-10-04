// The «Проблемы» tab of the Lesson screen (spec ts-tooling): the Type
// Checker's errors as a list with a counter, its loading and its failure,
// one Type Checker per session across Lessons. Offline fixture: lib files and
// types.json come from our own origin only (ADR-0002).
import type { Page } from "@playwright/test";
import { expect, test } from "./offline";
import type { CourseData, LessonData } from "../packages/codda/src/course-data";

const underlines = (page: Page) => page.locator(".cm-content .cm-lintRange-error");
const problemsTab = (page: Page) => page.getByRole("tab", { name: /^Проблемы/ });
const problems = (page: Page) => page.getByRole("list", { name: "Проблемы" }).getByRole("button");
const runTests = (page: Page) => page.getByRole("button", { name: "▶ Запустить тесты" });
const LIB = "**/ts-lib-*.json";

/** Two errors, on lines 2 and 4. */
const TWO_ERRORS = `import { useState } from "react";
export const n: number = "1";
export function Spoiler() {
  const [open, setOpen] = useState(false);
  setOpen("yes");
  return <div>{String(open)}</div>;
}
`;

test("«Проблемы»: the counter and the list match the underlines and follow edits; no errors — «Проблем нет»", async ({
  page,
}) => {
  await page.goto("./#/use-state");
  const editor = page.getByRole("textbox", { name: "main.tsx" });
  await editor.fill(TWO_ERRORS);
  await expect(underlines(page)).toHaveCount(2);

  await problemsTab(page).click();
  await expect(problemsTab(page)).toHaveText("Проблемы2");
  await expect(problems(page)).toHaveText([
    "2:14 — Type 'string' is not assignable to type 'number'. (TS2322)",
    `5:11 — Argument of type '"yes"' is not assignable to parameter of type 'SetStateAction<boolean>'. (TS2345)`,
  ]);

  await editor.fill(TWO_ERRORS.replace(`"yes"`, "true"));
  await expect(underlines(page)).toHaveCount(1);
  await expect(problemsTab(page)).toHaveText("Проблемы1");
  await expect(problems(page)).toHaveText(["2:14 — Type 'string' is not assignable to type 'number'. (TS2322)"]);

  await editor.fill(TWO_ERRORS.replace(`"yes"`, "true").replace(`"1"`, "1"));
  await expect(page.getByText("Проблем нет")).toBeVisible();
  await expect(problemsTab(page)).toHaveText("Проблемы0");
  await expect(underlines(page)).toHaveCount(0);
});

test("a click on a problem puts the cursor at the error's start; typing goes there", async ({ page }) => {
  await page.goto("./#/use-state");
  const editor = page.getByRole("textbox", { name: "main.tsx" });
  await editor.fill(TWO_ERRORS);
  await problemsTab(page).click();

  await problems(page).nth(1).click();
  await page.keyboard.type("!");

  await expect(editor).toContainText(`setOpen(!"yes");`);
});

test("after a Run «Тесты» opens, not «Проблемы»", async ({ page }) => {
  await page.goto("./#/use-state");
  await page.getByRole("textbox", { name: "main.tsx" }).fill(TWO_ERRORS);
  await problemsTab(page).click();
  await expect(problems(page)).toHaveCount(2);

  await runTests(page).click();

  await expect(page.getByRole("tab", { name: /^Тесты/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("region", { name: "Test Report" })).toBeVisible();
});

test("«↺ Сбросить» recounts the problems for the Starter; the Solution on «Решение» is not counted", async ({ page }) => {
  await page.goto("./#/use-state");
  await page.getByRole("textbox", { name: "main.tsx" }).fill(TWO_ERRORS);
  await expect(problemsTab(page)).toHaveText("Проблемы2");

  await page.getByRole("button", { name: "↺ Сбросить" }).click();
  await expect(problemsTab(page)).toHaveText("Проблемы0");

  await page.getByRole("button", { name: "Показать решение" }).click();
  await expect(page.getByRole("textbox", { name: "Решение" })).toBeVisible();
  // A checked «Решение» would be checked after the Workspace's 300 ms.
  await page.waitForTimeout(1000);
  await expect(problemsTab(page)).toHaveText("Проблемы0");
});

async function useStateSolution(page: Page) {
  const course: CourseData = await (await page.request.get("course.json")).json();
  return (course.modules[0].lessons[0] as LessonData).solution;
}

/** The URLs of the requests of the page and its Workers that end with `suffix`. */
function requestsTo(page: Page, suffix: RegExp) {
  const urls: string[] = [];
  page.context().on("request", (request) => {
    if (suffix.test(request.url())) urls.push(request.url());
  });
  return urls;
}

test("the Type Checker starts once the editor is drawn; while its lib files are on the way the editor takes input, «Проверка типов загружается», a Run gives the usual Test Report", async ({
  page,
}) => {
  const solution = await useStateSolution(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  let editorDrawn: boolean | undefined;
  await page.route(LIB, async (route) => {
    editorDrawn = (await page.locator(".cm-content").count()) > 0;
    await held;
    await route.fallback();
  });
  await page.goto("./#/use-state");
  const editor = page.getByRole("textbox", { name: "main.tsx" });

  await editor.fill(solution);
  await expect(editor).toContainText("export function Spoiler");
  await problemsTab(page).click();
  await expect(page.getByText("Проверка типов загружается")).toBeVisible();
  await expect(problemsTab(page)).toHaveText("Проблемы…");
  await runTests(page).click();
  await expect(page.getByText("PASS · 3 / 3")).toBeVisible();
  expect(editorDrawn).toBe(true);

  release();
  await expect(problemsTab(page)).toHaveText("Проблемы0");
});

test("lib files do not load: «Проверка типов недоступна», no underlines, a Run works, no second request", async ({
  page,
}) => {
  const solution = await useStateSolution(page);
  const libRequests = requestsTo(page, /\/ts-lib-[0-9a-f]+\.json$/);
  await page.route(LIB, (route) => route.abort());
  await page.goto("./#/use-state");
  const editor = page.getByRole("textbox", { name: "main.tsx" });

  await editor.fill(TWO_ERRORS);
  await problemsTab(page).click();
  await expect(page.getByText("Проверка типов недоступна")).toBeVisible();
  await expect(problemsTab(page)).toHaveText("Проблемы");
  await expect(underlines(page)).toHaveCount(0);

  await editor.fill(solution);
  await runTests(page).click();
  await expect(page.getByText("PASS · 3 / 3")).toBeVisible();

  await page.goto("./#/use-effect");
  await page.getByRole("textbox", { name: "main.tsx" }).fill(TWO_ERRORS);
  await problemsTab(page).click();
  await expect(page.getByText("Проверка типов недоступна")).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(underlines(page)).toHaveCount(0);
  expect(libRequests).toHaveLength(1);
});

test("the Worker's script does not load (`error` of the Worker): «Проверка типов недоступна», a Run works", async ({
  page,
}) => {
  const solution = await useStateSolution(page);
  await page.route("**/type-checker.worker-*.js", (route) => route.abort());
  await page.goto("./#/use-state");

  await problemsTab(page).click();
  await expect(page.getByText("Проверка типов недоступна")).toBeVisible();
  await page.getByRole("textbox", { name: "main.tsx" }).fill(solution);
  await runTests(page).click();
  await expect(page.getByText("PASS · 3 / 3")).toBeVisible();
});

test("the Worker fails mid-session: «Проверка типов недоступна», its underlines go away, a Run works", async ({
  page,
}) => {
  const solution = await useStateSolution(page);
  const workers: import("@playwright/test").Worker[] = [];
  page.on("worker", (worker) => workers.push(worker));
  await page.goto("./#/use-state");
  const editor = page.getByRole("textbox", { name: "main.tsx" });
  await editor.fill(TWO_ERRORS);
  await expect(underlines(page)).toHaveCount(2);
  await problemsTab(page).click();
  await expect(problems(page)).toHaveCount(2);

  const checker = workers.find((w) => w.url().includes("type-checker"))!;
  await checker.evaluate(() => {
    setTimeout(() => {
      throw new Error("the Type Checker fails");
    });
  });

  await expect(page.getByText("Проверка типов недоступна")).toBeVisible();
  await expect(problemsTab(page)).toHaveText("Проблемы");
  await expect(underlines(page)).toHaveCount(0);
  await editor.fill(solution);
  await runTests(page).click();
  await expect(page.getByText("PASS · 3 / 3")).toBeVisible();
});

test("another Lesson via #/<id> is checked with its Starter; one Type Checker, lib files and types.json once a session", async ({
  page,
}) => {
  const workers: string[] = [];
  page.on("worker", (worker) => workers.push(worker.url()));
  const libRequests = requestsTo(page, /\/ts-lib-[0-9a-f]+\.json$/);
  const typesRequests = requestsTo(page, /\/types\.json$/);
  await page.goto("./#/use-state");
  await page.getByRole("textbox", { name: "main.tsx" }).fill(TWO_ERRORS);
  await expect(problemsTab(page)).toHaveText("Проблемы2");

  await page.goto("./#/use-effect");
  await expect(page.getByRole("heading", { name: "React Hooks · useEffect" })).toBeVisible();
  await expect(problemsTab(page)).toHaveText("Проблемы0");
  await page.getByRole("textbox", { name: "main.tsx" }).fill(TWO_ERRORS.replace(`"yes"`, "true"));
  await expect(problemsTab(page)).toHaveText("Проблемы1");

  expect(workers.filter((url) => url.includes("type-checker"))).toHaveLength(1);
  expect(libRequests).toHaveLength(1);
  expect(typesRequests).toHaveLength(1);
});

test("from a main.tsx Lesson to a main.ts one and back: no errors left from the other file", async ({ page }) => {
  // Scripts, not modules: a file left from the other Lesson would redeclare `count` (TS2451).
  const lesson = (id: string, name: LessonData["workspace"]["name"], starter: string): LessonData => ({
    id,
    title: id,
    instructions: "<p>—</p>",
    workspace: { name, starter },
    solution: starter,
    tests: 'import { test } from "@codda/test";\ntest("runs", () => {});\n',
    testsName: "lesson.test.ts",
  });
  const course: CourseData = {
    id: "mixed",
    title: "Mixed",
    deps: null,
    modules: [
      {
        title: "M",
        lessons: [
          lesson("tsx", "main.tsx", "const count = 1;\n"),
          lesson("ts", "main.ts", "const count = 2;\nconst id = <T>(x: T) => x;\n"),
        ],
      },
    ],
  };
  await page.route("**/course.json", (route) => route.fulfill({ json: course }));
  await page.goto("./#/tsx");
  await expect(problemsTab(page)).toHaveText("Проблемы0");

  await page.goto("./#/ts");
  await expect(page.getByRole("textbox", { name: "main.ts" })).toBeVisible();
  await expect(problemsTab(page)).toHaveText("Проблемы0");

  await page.goto("./#/tsx");
  await expect(page.getByRole("textbox", { name: "main.tsx" })).toBeVisible();
  await expect(problemsTab(page)).toHaveText("Проблемы0");
  await expect(underlines(page)).toHaveCount(0);
});
