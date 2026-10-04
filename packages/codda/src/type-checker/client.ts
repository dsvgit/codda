// The page's side of the Type Checker (ADR-0009): one Worker per session,
// started by the first check, so after the Lesson screen is drawn and outside
// the editor's component: a new EditorView does not restart it. Requests sent
// before it is ready wait for it; once it is unavailable (did not load or
// failed later) every request gets no errors and no completions, and there are no retries.
import type { Completions, TypeError } from "./core.ts";

export type { Completions, TypeError } from "./core.ts";

export type TypeCheckerRequest =
  | { type: "init"; lib: string; types?: string }
  | { type: "diagnostics"; id: number; file: string; text: string }
  | { type: "completions"; id: number; file: string; text: string; pos: number };

export type TypeCheckerResponse =
  | { type: "ready" }
  | { type: "failed"; message: string }
  | { type: "diagnostics"; id: number; errors: TypeError[] }
  | { type: "completions"; id: number; completions: Completions };

/** `loading` until the Worker has its lib files and types.json, also before it is started. */
export type TypeCheckerStatus = "loading" | "ready" | "unavailable";

type TypeChecker = {
  diagnostics: (file: string, text: string) => Promise<TypeError[]>;
  /** None while the Type Checker is unavailable. */
  completions: (file: string, text: string, pos: number) => Promise<Completions | undefined>;
};

let checker: TypeChecker | undefined;
let status: TypeCheckerStatus = "loading";
const listeners = new Set<() => void>();

/** The session's Type Checker status; with `onTypeCheckerStatus`, a store for `useSyncExternalStore`. */
export const typeCheckerStatus = () => status;

export function onTypeCheckerStatus(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setStatus(next: TypeCheckerStatus) {
  status = next;
  for (const listener of listeners) listener();
}

/**
 * The session's Type Checker. `types`: absolute URL of types.json of the
 * Course's Dependency Artifact, none if the Course has none; only the first
 * call's matters.
 */
export function typeChecker(types: string | undefined): TypeChecker {
  checker ??= start(types);
  return checker;
}

function start(types: string | undefined): TypeChecker {
  const worker = new Worker(new URL("./type-checker.worker.ts", import.meta.url), { type: "module" });
  let nextId = 0;
  // The answer of each request; `undefined` once the Worker is unavailable.
  const pending = new Map<number, (answer: TypeError[] | Completions | undefined) => void>();
  let settle!: () => void;
  // Settled once the Worker is ready or unavailable.
  const settled = new Promise<void>((resolve) => (settle = resolve));

  const fail = () => {
    setStatus("unavailable");
    worker.terminate();
    for (const resolve of pending.values()) resolve(undefined);
    pending.clear();
    settle();
  };
  // A script that does not load, and an uncaught error in the Worker later on.
  worker.addEventListener("error", fail);
  worker.addEventListener("message", ({ data }: MessageEvent<TypeCheckerResponse>) => {
    if (data.type === "ready") {
      setStatus("ready");
      settle();
    } else if (data.type === "failed") fail();
    else {
      pending.get(data.id)?.(data.type === "diagnostics" ? data.errors : data.completions);
      pending.delete(data.id);
    }
  });
  const lib = new URL(__CODDA_TS_LIB__, document.baseURI).href;
  worker.postMessage({ type: "init", lib, types } satisfies TypeCheckerRequest);

  /** Sends the request once the Worker is ready; `undefined` if it is or becomes unavailable. */
  async function ask(request: Extract<TypeCheckerRequest, { id: number }>) {
    await settled;
    if (status === "unavailable") return undefined;
    worker.postMessage(request);
    return new Promise<TypeError[] | Completions | undefined>((resolve) => pending.set(request.id, resolve));
  }

  return {
    diagnostics: async (file, text) => ((await ask({ type: "diagnostics", id: nextId++, file, text })) as TypeError[]) ?? [],
    completions: async (file, text, pos) =>
      (await ask({ type: "completions", id: nextId++, file, text, pos })) as Completions | undefined,
  };
}
