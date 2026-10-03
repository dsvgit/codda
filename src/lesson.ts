export const lesson = {
  title: "React: Counter",
  instructions:
    "Допишите компонент Counter: он показывает число в <output>, начиная с 0. " +
    "Кнопка «+» увеличивает число на 1, кнопка «−» уменьшает на 1. " +
    "Храните число в состоянии через useState.",
  starter: `import { useState } from "react";

export function Counter() {
  return (
    <div>
      <button>−</button>
      <output>?</output>
      <button>+</button>
    </div>
  );
}
`,
  solution: `import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button onClick={() => setCount(count - 1)}>−</button>
      <output>{count}</output>
      <button onClick={() => setCount(count + 1)}>+</button>
    </div>
  );
}
`,
  tests: `import { test, expect } from "@codda/test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Counter } from "./App";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function renderCounter() {
  const container = document.createElement("div");
  document.body.append(container);
  await act(() => createRoot(container).render(<Counter />));

  return {
    count: () => container.querySelector("output")?.textContent,
    click: async (label: string) => {
      const button = [...container.querySelectorAll("button")].find(
        (b) => b.textContent === label,
      );
      if (!button) throw new Error(\`button "\${label}" not found\`);
      await act(() => button.click());
    },
  };
}

test("renders initial value", async () => {
  const counter = await renderCounter();
  expect(counter.count()).toBe("0");
});

test("increments", async () => {
  const counter = await renderCounter();
  await counter.click("+");
  expect(counter.count()).toBe("1");
});

test("decrements", async () => {
  const counter = await renderCounter();
  await counter.click("−");
  expect(counter.count()).toBe("-1");
});
`,
};
