import { afterEach, expect, test } from "vitest";
import { page } from "vitest/browser";
import { createRoot, type Root } from "react-dom/client";
import { App } from "./App";
import type { CourseData } from "./course-data";

// The Course comes as a literal, as the UI gets it from course.json.
const course: CourseData = {
  id: "demo",
  title: "Демо",
  modules: [
    {
      title: "Первый",
      lessons: [
        {
          id: "add",
          title: "Сложение",
          instructions: "Допишите функцию add.\nОна складывает два числа.",
          workspace: {
            name: "main.ts",
            starter: "export function add(a: number, b: number) {\n  return a - b;\n}\n",
          },
          solution: "export function add(a: number, b: number) {\n  return a + b;\n}\n",
          tests: `import { test, expect } from "@codda/test";
import { add } from "./main";

test("adds two positive numbers", () => {
  expect(add(2, 3)).toBe(5);
});

test("adds a negative number", () => {
  expect(add(-1, 1)).toBe(0);
});
`,
        },
      ],
    },
    {
      title: "Второй",
      lessons: [
        {
          id: "greet",
          title: "Приветствие",
          instructions: "Верните приветствие.",
          workspace: { name: "main.tsx", starter: 'export const greet = () => "?";\n' },
          solution: 'export const greet = () => "hi";\n',
          tests: `import { test, expect } from "@codda/test";
import { greet } from "./main";

test("greets", () => {
  expect(greet()).toBe("hi");
});
`,
        },
      ],
    },
  ],
};

let root: Root | undefined;

afterEach(() => {
  root?.unmount();
  root = undefined;
  document.body.innerHTML = "";
});

function renderApp(lessonId?: string) {
  if (!root) {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  }
  root.render(<App course={course} lessonId={lessonId} />);
}

const editor = () => page.getByRole("textbox");
const runTests = () => page.getByRole("button", { name: "Run tests" });

test("student runs the starter, fixes it and sees every test pass", async () => {
  renderApp("add");

  await runTests().click();
  await expect.element(page.getByText("0 / 2 passed")).toBeVisible();
  await expect.element(page.getByText("expected 5, got -1", { exact: false })).toBeVisible();

  await editor().fill(course.modules[0].lessons[0].solution);
  await runTests().click();

  await expect.element(page.getByText("2 / 2 passed")).toBeVisible();
});

test("student who breaks the syntax sees where the compile error is", async () => {
  renderApp("add");

  await editor().fill("export function add(a: number, b: number) {\n  return a +;\n}\n");
  await runTests().click();

  await expect.element(page.getByText("Compile error")).toBeVisible();
  await expect.element(page.getByText('Line 2, column 13: Unexpected ";"')).toBeVisible();
});

test("the Lesson shows its and the Course's title, its Instructions and Workspace", async () => {
  renderApp("greet");

  await expect.element(page.getByRole("heading", { name: "Демо · Приветствие" })).toBeVisible();
  await expect.poll(() => document.title).toBe("Приветствие — Демо");
  await expect.element(page.getByRole("heading", { name: "main.tsx" })).toBeVisible();
  await expect.element(page.getByText("Верните приветствие.")).toBeVisible();
  await expect.element(editor()).toHaveTextContent('export const greet = () => "?";');
});

test("Instructions keep their line breaks", async () => {
  renderApp("add");

  const instructions = page.getByText("Допишите функцию add.", { exact: false });
  await expect.element(instructions).toBeVisible();
  expect(instructions.element()).toHaveProperty(
    "innerText",
    "Допишите функцию add.\nОна складывает два числа.",
  );
});

test("without a Lesson id the first Lesson of the first Module opens", async () => {
  renderApp(undefined);

  await expect.element(page.getByRole("heading", { name: "Демо · Сложение" })).toBeVisible();
});

test("an unknown Lesson id shows a message and a link to the first Lesson", async () => {
  renderApp("nope");

  await expect.element(page.getByText("Урок „nope“ не найден")).toBeVisible();
  await expect
    .element(page.getByRole("link", { name: "Сложение" }))
    .toHaveAttribute("href", "#/add");
  await expect.element(runTests()).not.toBeInTheDocument();
});

test("another Lesson opens from a clean slate: its Starter, no Test Report", async () => {
  renderApp("add");
  await editor().fill("export const edited = 1;\n");
  await runTests().click();
  await expect.element(page.getByRole("region", { name: "Test Report" })).toBeVisible();

  renderApp("greet");

  await expect.element(page.getByRole("heading", { name: "Демо · Приветствие" })).toBeVisible();
  await expect.element(editor()).toHaveTextContent('export const greet = () => "?";');
  await expect.element(page.getByRole("region", { name: "Test Report" })).not.toBeInTheDocument();
});
