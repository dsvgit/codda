import { useReducer } from "react";

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
