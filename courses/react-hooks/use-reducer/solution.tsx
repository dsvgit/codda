import { useReducer } from "react";

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
