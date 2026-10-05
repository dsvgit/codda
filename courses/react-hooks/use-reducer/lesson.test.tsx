import { test, expect } from "@codda/test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Counter, counterReducer } from "./main";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test("reducer handles every action", () => {
  expect(counterReducer({ count: 5 }, { type: "increment" })).toEqual({ count: 6 });
  expect(counterReducer({ count: 5 }, { type: "decrement" })).toEqual({ count: 4 });
  expect(counterReducer({ count: 5 }, { type: "reset" })).toEqual({ count: 0 });
});

test("reducer does not mutate state", () => {
  const state = { count: 1 };
  counterReducer(state, { type: "increment" });
  expect(state).toEqual({ count: 1 });
});

test("Counter dispatches actions from its buttons", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  await act(() => createRoot(container).render(<Counter />));

  const click = async (label: string) => {
    const button = [...container.querySelectorAll("button")].find((b) => b.textContent === label);
    if (!button) throw new Error(`button "${label}" not found`);
    await act(() => button.click());
  };
  const count = () => container.querySelector("output")?.textContent;

  expect(count()).toBe("0");
  await click("+");
  await click("+");
  expect(count()).toBe("2");
  await click("−");
  expect(count()).toBe("1");
  await click("Reset");
  expect(count()).toBe("0");
});
