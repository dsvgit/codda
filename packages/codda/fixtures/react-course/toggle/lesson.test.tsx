import { test, expect } from "@codda/test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Toggle } from "./main";

test("is off at first, on after a click", async () => {
  const container = document.createElement("div");
  await act(() => createRoot(container).render(<Toggle />));
  await act(() => container.querySelector("button")!.click());
  expect(container.textContent).toBe("on");
});
