export const lesson = {
  title: "React Hooks 3/5: useRef",
  instructions:
    "Допишите компонент Greeting. Поле <input> неуправляемое: React не хранит его значение в состоянии. " +
    "По клику на кнопку «Greet» прочитайте текущее значение поля через useRef и покажите в <output> " +
    "текст «Hello, <имя>!». До первого клика <output> пустой.",
  starter: `import { useRef, useState } from "react";

export function Greeting() {
  return (
    <div>
      <input placeholder="Your name" />
      <button>Greet</button>
      <output></output>
    </div>
  );
}
`,
  solution: `import { useRef, useState } from "react";

export function Greeting() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [greeting, setGreeting] = useState("");
  return (
    <div>
      <input ref={inputRef} placeholder="Your name" />
      <button onClick={() => setGreeting(\`Hello, \${inputRef.current?.value}!\`)}>Greet</button>
      <output>{greeting}</output>
    </div>
  );
}
`,
  tests: `import { test, expect } from "@codda/test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Greeting } from "./App";

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
`,
};
