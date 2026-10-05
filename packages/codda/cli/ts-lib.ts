// The lib files of TypeScript the type check needs: those named by `lib` in
// the TS config (src/ts-config.ts) and every lib they reference, read from the
// `typescript-6` package so that their version matches the checker's. The UI
// gets them as one JSON file (vite.config.ts), `codda test` straight from here.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import ts from "typescript-6";
import { TS_COMPILER_OPTIONS } from "../src/ts-config.ts";

const libDir = dirname(createRequire(import.meta.url).resolve("typescript-6"));

/** Virtual path (`/lib.<name>.d.ts`, where @typescript/vfs looks for them) → text. */
export function tsLibFiles(): Record<string, string> {
  const { options } = ts.convertCompilerOptionsFromJson(TS_COMPILER_OPTIONS, "/");
  const files: Record<string, string> = {};
  const add = (name: string) => {
    if (`/${name}` in files) return;
    const text = readFileSync(join(libDir, name), "utf8");
    files[`/${name}`] = text;
    for (const [, lib] of text.matchAll(/^\/\/\/ <reference lib="([^"]+)" \/>/gm)) add(`lib.${lib.toLowerCase()}.d.ts`);
  };
  for (const name of options.lib!) add(name);
  return files;
}
