import React, { useState } from "react";

export function Toggle() {
  const [on, setOn] = useState(false);
  return <button onClick={() => setOn(!on)}>{on ? "on" : "off"}</button>;
}

export const sameReact = React.useState === useState;
