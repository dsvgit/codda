import { useRef, useState } from "react";

export function Greeting() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [greeting, setGreeting] = useState("");
  return (
    <div>
      <input ref={inputRef} placeholder="Your name" />
      <button onClick={() => setGreeting(`Hello, ${inputRef.current?.value}!`)}>Greet</button>
      <output>{greeting}</output>
    </div>
  );
}
