import { test, expect } from "@codda/test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Spoiler } from "./main";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function renderSpoiler() {
  const container = document.createElement("div");
  document.body.append(container);
  await act(() => createRoot(container).render(<Spoiler />));
  return container;
}

test("сначала секрет скрыт", async () => {
  const container = await renderSpoiler();
  expect(container.querySelector("p")).toBe(null);
});

test("по клику секрет виден", async () => {
  const container = await renderSpoiler();
  await act(() => container.querySelector("button")!.click());
  expect(container.querySelector("p")?.textContent).toBe("Секрет");
});
