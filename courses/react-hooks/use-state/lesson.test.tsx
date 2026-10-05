import { test, expect } from "@codda/test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Spoiler } from "./main";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function renderSpoiler() {
  const container = document.createElement("div");
  document.body.append(container);
  await act(() => createRoot(container).render(<Spoiler />));

  return {
    label: () => container.querySelector("button")?.textContent,
    text: () => container.querySelector("p")?.textContent ?? null,
    toggle: async () => {
      const button = container.querySelector("button");
      if (!button) throw new Error("button not found");
      await act(() => button.click());
    },
  };
}

test("is closed at first", async () => {
  const spoiler = await renderSpoiler();
  expect(spoiler.label()).toBe("Show");
  expect(spoiler.text()).toBe(null);
});

test("opens on click", async () => {
  const spoiler = await renderSpoiler();
  await spoiler.toggle();
  expect(spoiler.label()).toBe("Hide");
  expect(spoiler.text()).toBe("Darth Vader is Luke's father");
});

test("closes on second click", async () => {
  const spoiler = await renderSpoiler();
  await spoiler.toggle();
  await spoiler.toggle();
  expect(spoiler.label()).toBe("Show");
  expect(spoiler.text()).toBe(null);
});
