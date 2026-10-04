import { test, expect } from "@codda/test";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeContext, ThemedButton } from "./main";

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
