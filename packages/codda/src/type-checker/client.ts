// The page's side of the Type Checker (ADR-0009): one Worker per session,
// started by the first check, so after the Lesson screen is drawn and outside
// the editor's component: a new EditorView does not restart it. Requests sent
// before it is ready wait for it; once it is unavailable (did not load or
// failed later) every request gets no errors, and there are no retries.
import type { TypeError } from "./core.ts";

export type { TypeError } from "./core.ts";

export type TypeCheckerRequest =
  | { type: "init"; lib: string; types?: string }
  | { type: "diagnostics"; id: number; file: string; text: string };

export type TypeCheckerResponse =
  | { type: "failed"; message: string }
  | { type: "diagnostics"; id: number; errors: TypeError[] };

type TypeChecker = { diagnostics: (file: string, text: string) => Promise<TypeError[]> };

let checker: TypeChecker | undefined;

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
  let unavailable = false;
  let nextId = 0;
  const pending = new Map<number, (errors: TypeError[]) => void>();

  const fail = () => {
    unavailable = true;
    worker.terminate();
    for (const resolve of pending.values()) resolve([]);
    pending.clear();
  };
  worker.addEventListener("error", fail);
  worker.addEventListener("message", ({ data }: MessageEvent<TypeCheckerResponse>) => {
    if (data.type === "failed") fail();
    else {
      pending.get(data.id)?.(data.errors);
      pending.delete(data.id);
    }
  });
  const lib = new URL(__CODDA_TS_LIB__, document.baseURI).href;
  worker.postMessage({ type: "init", lib, types } satisfies TypeCheckerRequest);

  return {
    diagnostics(file, text) {
      if (unavailable) return Promise.resolve([]);
      const id = nextId++;
      worker.postMessage({ type: "diagnostics", id, file, text } satisfies TypeCheckerRequest);
      return new Promise((resolve) => pending.set(id, resolve));
    },
  };
}
