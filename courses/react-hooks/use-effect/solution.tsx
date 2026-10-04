import { useEffect, useState } from "react";

export function ClickTitle() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    document.title = `Clicked ${count} times`;
  }, [count]);
  return <button onClick={() => setCount(count + 1)}>Click me</button>;
}
