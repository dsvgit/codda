export const lesson = {
  title: "React Hooks 1/5: useState",
  instructions:
    "Допишите компонент Spoiler. Сначала видна только кнопка «Show». " +
    "По клику под кнопкой появляется <p> с текстом «Darth Vader is Luke's father», а кнопка меняет надпись на «Hide». " +
    "Повторный клик снова прячет текст. Храните флаг «открыто» в состоянии через useState.",
  starter: `import { useState } from "react";

export function Spoiler() {
  return (
    <div>
      <button>Show</button>
    </div>
  );
}
`,
  solution: `import { useState } from "react";

export function Spoiler() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"}</button>
      {open && <p>Darth Vader is Luke's father</p>}
    </div>
  );
}
`,
  tests: `import { test, expect } from "@codda/test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Spoiler } from "./App";

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
`,
};
