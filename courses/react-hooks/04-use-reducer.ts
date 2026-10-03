export const lesson = {
  title: "React Hooks 4/5: useReducer",
  instructions:
    "Допишите редьюсер counterReducer(state, action) для состояния { count: number }: " +
    "действие { type: \"increment\" } увеличивает count на 1, { type: \"decrement\" } уменьшает на 1, " +
    "{ type: \"reset\" } возвращает count в 0. Редьюсер не меняет state, а возвращает новый объект. " +
    "Затем подключите его в Counter через useReducer: кнопки «+», «−» и «Reset» отправляют действия, " +
    "<output> показывает count.",
  starter: `import { useReducer } from "react";

type State = { count: number };
type Action = { type: "increment" } | { type: "decrement" } | { type: "reset" };

export function counterReducer(state: State, action: Action): State {
  return state;
}

export function Counter() {
  return (
    <div>
      <button>−</button>
      <output>?</output>
      <button>+</button>
      <button>Reset</button>
    </div>
  );
}
`,
  solution: `import { useReducer } from "react";

type State = { count: number };
type Action = { type: "increment" } | { type: "decrement" } | { type: "reset" };

export function counterReducer(state: State, action: Action): State {
  switch (action.type) {
    case "increment":
      return { count: state.count + 1 };
    case "decrement":
      return { count: state.count - 1 };
    case "reset":
      return { count: 0 };
  }
}

export function Counter() {
  const [state, dispatch] = useReducer(counterReducer, { count: 0 });
  return (
    <div>
      <button onClick={() => dispatch({ type: "decrement" })}>−</button>
      <output>{state.count}</output>
      <button onClick={() => dispatch({ type: "increment" })}>+</button>
      <button onClick={() => dispatch({ type: "reset" })}>Reset</button>
    </div>
  );
}
`,
  tests: `import { test, expect } from "@codda/test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Counter, counterReducer } from "./App";

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
    if (!button) throw new Error(\`button "\${label}" not found\`);
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
`,
};
