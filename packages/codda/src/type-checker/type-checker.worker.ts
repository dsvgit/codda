// Type Checker (ADR-0009): TypeScript 6 in its own Web Worker, apart from the
// Compiler's. The first message names the JSON with TS's lib files and
// types.json of the Course's Dependency Artifact (none for a Course without
// one), both on our own origin (ADR-0002); they are loaded once. Then each
// request — diagnostics or completions — carries the whole text of the file,
// so the Worker keeps no state of the editor.
import ts from "typescript-6";
import { createTypeEnvironment, type TypeEnvironment } from "./core.ts";
import type { TypeCheckerRequest, TypeCheckerResponse } from "./client.ts";

// Set once the lib files and types.json are in; the client sends no request before.
let env: TypeEnvironment;

const post = (message: TypeCheckerResponse) => self.postMessage(message);

async function fetchJson(url: string): Promise<Record<string, string>> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${new URL(url).pathname}: HTTP ${response.status}`);
  return response.json();
}

// Requests are answered synchronously: an exception of TypeScript is the
// Worker's `error` event, and the client gives up on the Type Checker.
self.onmessage = ({ data }: MessageEvent<TypeCheckerRequest>) => {
  if (data.type === "init") {
    const { lib, types } = data;
    Promise.all([fetchJson(lib), types ? fetchJson(types) : {}])
      .then(([libFiles, typeFiles]) => {
        env = createTypeEnvironment(ts, { ...libFiles, ...typeFiles });
        post({ type: "ready" });
      })
      .catch((err: Error) => post({ type: "failed", message: err.message }));
    return;
  }
  env.setFile(data.file, data.text);
  if (data.type === "diagnostics") post({ type: "diagnostics", id: data.id, errors: env.errors(data.file) });
  else post({ type: "completions", id: data.id, completions: env.completions(data.file, data.pos) });
};
