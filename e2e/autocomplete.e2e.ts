// Autocomplete from TypeScript in the Workspace's editor (spec ts-tooling,
// ticket 03): one source — the Type Checker — while typing and on
// Ctrl+Space, none in strings, comments and the read-only «Решение». Offline
// fixture: the Type Checker's files come from our own origin only (ADR-0002).
import type { Page } from "@playwright/test";
import { expect, test } from "./offline";

const list = (page: Page) => page.locator(".cm-tooltip-autocomplete");
const option = (page: Page, label: string) =>
  list(page).getByRole("option").filter({ has: page.locator(".cm-completionLabel", { hasText: new RegExp(`^${label}$`) }) });
const labels = (page: Page) => list(page).locator(".cm-completionLabel").allTextContents();
const lines = (page: Page) => page.locator(".cm-content .cm-line").allTextContents();

/** The use-state Lesson with `text` in its editor and the cursor at the end of it. */
async function workspace(page: Page, text: string) {
  await page.goto("./#/use-state");
  const editor = page.getByRole("textbox", { name: "main.tsx" });
  await editor.fill(text);
  await page.keyboard.press("Control+End");
  return editor;
}

/** Long enough for a Type Checker's answer (one request to the Worker): no list by then means none. */
const noListAfterAWhile = async (page: Page) => {
  await page.waitForTimeout(1000);
  await expect(list(page)).toHaveCount(0);
};

test("typing `useSta` lists useState as a function with its signature; Enter replaces the typed prefix, imports stay as they are", async ({
  page,
}) => {
  await workspace(page, `import { useState } from "react";\nexport const state = `);

  await page.keyboard.type("useSta");

  const useState = option(page, "useState");
  await expect(useState).toHaveCount(1);
  await expect(useState.locator(".cm-completionIcon-function")).toHaveCount(1);
  await expect(useState.locator(".cm-completionDetail")).toContainText("useState<S>(initialState: S | (() => S))");

  await expect(list(page).getByRole("option", { selected: true })).toContainText("useState");
  await page.keyboard.press("Enter");
  await expect(list(page)).toHaveCount(0);
  expect(await lines(page)).toEqual([`import { useState } from "react";`, "export const state = useState"]);
});

test("no auto-import: a hook not imported is not offered", async ({ page }) => {
  await workspace(page, `import { useState } from "react";\nexport const effect = `);

  await page.keyboard.type("useEffe");
  await page.keyboard.press("Control+Space");

  await page.waitForTimeout(1000);
  await expect(option(page, "useEffect")).toHaveCount(0);
  expect((await lines(page))[0]).toBe(`import { useState } from "react";`);
});

test("after `document.` querySelector is listed; after `.` of an array — map and toSorted (ESNext)", async ({ page }) => {
  await workspace(page, `const items = [3, 1, 2];\n`);

  await page.keyboard.type("document.");
  await expect(list(page)).toBeVisible();
  await page.keyboard.type("querySel");
  await expect(option(page, "querySelector")).toHaveCount(1);
  await expect(option(page, "querySelector").locator(".cm-completionIcon-method")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("items.");
  await expect(option(page, "map")).toHaveCount(1);
  await expect(option(page, "toSorted")).toHaveCount(1);
});

test("Ctrl+Space opens the list without typing", async ({ page }) => {
  await workspace(page, `import { useState } from "react";\n\nexport function Spoiler() {\n  const [open, setOpen] = useState(false);\n  `);

  await page.keyboard.press("Control+Space");

  await expect(list(page)).toBeVisible();
  // A global of TS's lib files: lang-javascript knows nothing of it.
  await expect(option(page, "AbortController")).toHaveCount(1);
});

test("one label — one item: the keyword completion of lang-javascript is not in the list", async ({ page }) => {
  await workspace(page, `const items = [1];\n`);

  await page.keyboard.type("i");

  await expect(option(page, "items")).toHaveCount(1);
  const shown = await labels(page);
  expect(shown).toContain("if");
  expect(shown.length).toBe(new Set(shown).size);
});

test("no list inside a string or a comment, typed or on Ctrl+Space", async ({ page }) => {
  await workspace(page, `export const title = "`);
  await page.keyboard.type("docu");
  await page.keyboard.press("Control+Space");
  await noListAfterAWhile(page);

  await page.getByRole("textbox", { name: "main.tsx" }).fill(`// `);
  await page.keyboard.press("Control+End");
  await page.keyboard.type("docu");
  await page.keyboard.press("Control+Space");
  await noListAfterAWhile(page);
});

test("the Type Checker unavailable (lib files do not load): typing works, no list, no errors in the page's console", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    // The aborted request itself is the browser's line, not the page's error.
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/ts-lib-*.json", (route) => route.abort());

  await workspace(page, `const items = [1];\nexport const all = `);
  await page.getByRole("tab", { name: /^Проблемы/ }).click();
  await expect(page.getByText("Проверка типов недоступна")).toBeVisible();
  await page.getByRole("textbox", { name: "main.tsx" }).click();
  await page.keyboard.press("Control+End");
  // lang-javascript would list the local `items`.
  await page.keyboard.type("ite");
  await page.keyboard.press("Control+Space");

  await noListAfterAWhile(page);
  expect((await lines(page)).at(-1)).toBe("export const all = ite");
  expect(errors).toEqual([]);
});

test("the read-only «Решение» gives no completions", async ({ page }) => {
  await page.goto("./#/use-state");
  await page.getByRole("button", { name: "Показать решение" }).click();
  const solution = page.getByRole("textbox", { name: "Решение" });
  await solution.click();

  await page.keyboard.press("Control+End");
  await page.keyboard.press("Control+Space");

  await noListAfterAWhile(page);
});
