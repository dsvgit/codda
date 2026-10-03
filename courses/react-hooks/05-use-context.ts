export const lesson = {
  title: "React Hooks 5/5: useContext",
  instructions:
    "ThemeContext уже создан со значением по умолчанию \"light\". Допишите ThemedButton: " +
    "он читает тему из ThemeContext через useContext и рендерит <button> с классом, равным теме, " +
    "и текстом «Theme: <тема>». Без провайдера кнопка светлая, внутри <ThemeContext value=\"dark\"> — тёмная.",
  starter: `import { createContext, useContext } from "react";

export const ThemeContext = createContext("light");

export function ThemedButton() {
  return <button className="light">Theme: light</button>;
}
`,
  solution: `import { createContext, useContext } from "react";

export const ThemeContext = createContext("light");

export function ThemedButton() {
  const theme = useContext(ThemeContext);
  return <button className={theme}>Theme: {theme}</button>;
}
`,
  tests: `import { test, expect } from "@codda/test";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeContext, ThemedButton } from "./App";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function renderButton(tree: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  await act(() => createRoot(container).render(tree));
  const button = container.querySelector("button");
  return { text: button?.textContent, className: button?.className };
}

test("uses the default theme without a provider", async () => {
  const button = await renderButton(<ThemedButton />);
  expect(button).toEqual({ text: "Theme: light", className: "light" });
});

test("reads the theme from the provider", async () => {
  const button = await renderButton(
    <ThemeContext value="dark">
      <ThemedButton />
    </ThemeContext>,
  );
  expect(button).toEqual({ text: "Theme: dark", className: "dark" });
});
`,
};
