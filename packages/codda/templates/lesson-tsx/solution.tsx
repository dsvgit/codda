import { useState } from "react";

export function Spoiler() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Show</button>
      {open && <p>Секрет</p>}
    </div>
  );
}
