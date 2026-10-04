import type { CompileInput, CompileResult } from "./types";

let worker: Worker | undefined;
let nextId = 0;

// Dependency Artifacts live in public/deps/, next to the page. Resolved here,
// against the page: with the relative base of the build (vite.config.ts) the
// Worker could only resolve it against its own script in assets/.
const depsURL = new URL(`${import.meta.env.BASE_URL}deps/`, document.baseURI).href;

/**
 * Compiles in a Web Worker that stays warm between Runs. If `signal` aborts
 * before the result arrives, the Worker is treated as hung: it is terminated,
 * the next compile starts a fresh one, and the returned promise never settles.
 * If the Worker itself fails (esbuild.wasm or its own script did not load,
 * `initialize` threw), it is terminated too and the promise rejects with the
 * reason: the next compile starts a fresh Worker that loads esbuild.wasm anew.
 */
export function compile(input: CompileInput, signal: AbortSignal): Promise<CompileResult> {
  worker ??= new Worker(new URL("./compiler.worker.ts", import.meta.url), {
    type: "module",
  });
  const w = worker;
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const cleanUp = () => {
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
    };
    const drop = () => {
      w.terminate();
      if (worker === w) worker = undefined;
    };
    const onMessage = (
      event: MessageEvent<{ id: number; result: CompileResult } | { id: number; error: string }>,
    ) => {
      if (event.data.id !== id) return;
      cleanUp();
      if ("error" in event.data) {
        drop();
        reject(new Error(event.data.error));
      } else {
        resolve(event.data.result);
      }
    };
    // The Worker's script did not load or threw outside a compile.
    const onError = (event: Event) => {
      cleanUp();
      drop();
      reject(new Error((event as ErrorEvent).message || "Compiler Worker failed to start"));
    };
    const onAbort = () => {
      cleanUp();
      drop();
    };
    w.addEventListener("message", onMessage);
    w.addEventListener("error", onError);
    signal.addEventListener("abort", onAbort, { once: true });
    w.postMessage({ id, input, depsURL });
  });
}
