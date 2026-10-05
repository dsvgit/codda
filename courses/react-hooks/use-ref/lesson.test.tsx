import { test, expect } from "@codda/test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Greeting } from "./main";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function renderGreeting() {
  const container = document.createElement("div");
  document.body.append(container);
  await act(() => createRoot(container).render(<Greeting />));

  return {
    output: () => container.querySelector("output")?.textContent,
    type: (value: string) => {
      const input = container.querySelector("input");
      if (!input) throw new Error("input not found");
      input.value = value;
    },
    greet: async () => {
      const button = container.querySelector("button");
      if (!button) throw new Error("button not found");
      await act(() => button.click());
    },
  };
}

test("output is empty at first", async () => {
  const greeting = await renderGreeting();
  expect(greeting.output()).toBe("");
});

test("greets by the name typed in the input", async () => {
  const greeting = await renderGreeting();
  greeting.type("Ada");
  await greeting.greet();
  expect(greeting.output()).toBe("Hello, Ada!");
});
