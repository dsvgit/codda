import { test, expect } from "@codda/test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { ClickTitle } from "./main";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function renderClickTitle() {
  document.title = "";
  const container = document.createElement("div");
  document.body.append(container);
  await act(() => createRoot(container).render(<ClickTitle />));

  return {
    click: async () => {
      const button = container.querySelector("button");
      if (!button) throw new Error("button not found");
      await act(() => button.click());
    },
  };
}

test("sets the title on mount", async () => {
  await renderClickTitle();
  expect(document.title).toBe("Clicked 0 times");
});

test("updates the title after clicks", async () => {
  const page = await renderClickTitle();
  await page.click();
  await page.click();
  expect(document.title).toBe("Clicked 2 times");
});
