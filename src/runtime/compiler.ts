import type { CompileInput, CompileResult } from "./types";

let worker: Worker | undefined;
let nextId = 0;

/** Compiles in a Web Worker that stays warm between Runs. */
export function compile(input: CompileInput): Promise<CompileResult> {
  worker ??= new Worker(new URL("./compiler.worker.ts", import.meta.url), {
    type: "module",
  });
  const w = worker;
  const id = nextId++;
  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent<{ id: number; result: CompileResult }>) => {
      if (event.data.id !== id) return;
      w.removeEventListener("message", onMessage);
      resolve(event.data.result);
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ id, input });
  });
}
