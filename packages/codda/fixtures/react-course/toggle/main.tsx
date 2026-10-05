import { useState } from "react";

export function Toggle() {
  const [on] = useState(false);
  return <button>{on ? "on" : "off"}</button>;
}
