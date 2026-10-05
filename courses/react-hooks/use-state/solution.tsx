import { useState } from "react";

export function Spoiler() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"}</button>
      {open && <p>Darth Vader is Luke's father</p>}
    </div>
  );
}
