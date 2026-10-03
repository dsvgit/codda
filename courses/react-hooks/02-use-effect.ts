export const lesson = {
  title: "React Hooks 2/5: useEffect",
  instructions:
    "Компонент ClickTitle уже считает клики. Добавьте эффект: после каждого рендера " +
    "заголовок вкладки (document.title) должен быть «Clicked N times», где N — текущее число кликов. " +
    "Используйте useEffect с массивом зависимостей.",
  starter: `import { useEffect, useState } from "react";

export function ClickTitle() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>Click me</button>;
}
`,
  solution: `import { useEffect, useState } from "react";

export function ClickTitle() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    document.title = \`Clicked \${count} times\`;
  }, [count]);
  return <button onClick={() => setCount(count + 1)}>Click me</button>;
}
`,
  tests: `import { test, expect } from "@codda/test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { ClickTitle } from "./App";

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
`,
};
