// Type Checker (ADR-0009): TypeScript 6 in its own Web Worker, apart from the
// Compiler's. The first message names the JSON with TS's lib files and
// types.json of the Course's Dependency Artifact (none for a Course without
// one), both on our own origin (ADR-0002); they are loaded once. Then each
// request carries the whole text of the file, so the Worker keeps no state of
// the editor.
import ts from "typescript-6";
import { createTypeEnvironment, type TypeEnvironment } from "./core.ts";
import type { TypeCheckerRequest, TypeCheckerResponse } from "./client.ts";

let env: Promise<TypeEnvironment> | undefined;

const post = (message: TypeCheckerResponse) => self.postMessage(message);

async function fetchJson(url: string): Promise<Record<string, string>> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${new URL(url).pathname}: HTTP ${response.status}`);
  return response.json();
}

self.onmessage = async ({ data }: MessageEvent<TypeCheckerRequest>) => {
  if (data.type === "init") {
    const { lib, types } = data;
    env = Promise.all([fetchJson(lib), types ? fetchJson(types) : {}]).then(([libFiles, typeFiles]) =>
      createTypeEnvironment(ts, { ...libFiles, ...typeFiles }),
    );
    env.catch((err: Error) => post({ type: "failed", message: err.message }));
    return;
  }
  const checker = await env!;
  checker.setFile(data.file, data.text);
  post({ type: "diagnostics", id: data.id, errors: checker.errors(data.file) });
};
