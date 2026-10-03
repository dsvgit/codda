import type { CompileInput, CompileResult } from "./types";

let worker: Worker | undefined;
let nextId = 0;

/**
 * Compiles in a Web Worker that stays warm between Runs. If `signal` aborts
 * before the result arrives, the Worker is treated as hung (or as having never
 * loaded esbuild): it is terminated and the next compile starts a fresh one.
 * The returned promise then never settles.
 */
export function compile(input: CompileInput, signal: AbortSignal): Promise<CompileResult> {
  worker ??= new Worker(new URL("./compiler.worker.ts", import.meta.url), {
    type: "module",
  });
  const w = worker;
  const id = nextId++;
  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent<{ id: number; result: CompileResult }>) => {
      if (event.data.id !== id) return;
      w.removeEventListener("message", onMessage);
      signal.removeEventListener("abort", onAbort);
      resolve(event.data.result);
    };
    const onAbort = () => {
      w.removeEventListener("message", onMessage);
      w.terminate();
      if (worker === w) worker = undefined;
    };
    w.addEventListener("message", onMessage);
    signal.addEventListener("abort", onAbort, { once: true });
    w.postMessage({ id, input });
  });
}
