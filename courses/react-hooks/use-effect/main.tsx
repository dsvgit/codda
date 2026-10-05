import { useEffect, useState } from "react";

export function ClickTitle() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>Click me</button>;
}
