import { afterEach, expect, test } from "vitest";
import { page } from "vitest/browser";
import { createRoot, type Root } from "react-dom/client";
import { App } from "./App";
import { lesson } from "./lesson";

let root: Root | undefined;

afterEach(() => {
  root?.unmount();
  document.body.innerHTML = "";
});

function renderApp() {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  root.render(<App />);
}

test("student runs the starter, fixes it and sees every test pass", async () => {
  renderApp();
  const runTests = page.getByRole("button", { name: "Run tests" });

  await runTests.click();
  await expect.element(page.getByText("0 / 3 passed")).toBeVisible();
  await expect.element(page.getByText('expected "1", got "?"', { exact: false })).toBeVisible();

  await page.getByRole("textbox").fill(lesson.solution);
  await runTests.click();

  await expect.element(page.getByText("3 / 3 passed")).toBeVisible();
});

test("student who breaks the syntax sees where the compile error is", async () => {
  renderApp();

  await page
    .getByRole("textbox")
    .fill("export function add(a: number, b: number) {\n  return a +;\n}\n");
  await page.getByRole("button", { name: "Run tests" }).click();

  await expect.element(page.getByText("Compile error")).toBeVisible();
  await expect.element(page.getByText('Line 2, column 13: Unexpected ";"')).toBeVisible();
});
