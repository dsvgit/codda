// The tool's built UI (`dist-tool/`, ADR-0008) and whether it is fresh. Every
// UI build writes the hash of the UI's sources into it (the plugin in
// vite.config.ts); `codda` compares it with the sources before a build and
// rebuilds the UI when they differ. A hash and not mtime: `git checkout`
// changes mtime.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** The file in `dist-tool/` with the hash of the sources it was built from. */
export const UI_HASH_FILE = ".codda-ui-hash";

const packageDir = fileURLToPath(new URL("..", import.meta.url));

/** The UI's sources, their static files, index.html, the Vite config and the repository's lockfile. */
const SOURCES = ["src", "public", "index.html", "vite.config.ts", "../../package-lock.json"];

export function uiSourceHash(): string {
  const hash = createHash("sha256");
  const add = (path: string) => {
    if (!existsSync(path)) return;
    if (statSync(path).isDirectory()) {
      for (const name of readdirSync(path).sort()) add(join(path, name));
      return;
    }
    hash.update(`${relative(packageDir, path)}\0`).update(readFileSync(path)).update("\0");
  };
  for (const source of SOURCES) add(join(packageDir, source));
  return hash.digest("hex").slice(0, 16);
}

/** Whether `uiDir` holds a UI built from the current sources. */
export function uiIsFresh(uiDir: string): boolean {
  const recorded = join(uiDir, UI_HASH_FILE);
  return existsSync(recorded) && readFileSync(recorded, "utf8") === uiSourceHash();
}

/** Builds the UI into `uiDir` with Vite. Returns Vite's output on failure, otherwise null. */
export function buildUi(uiDir: string): string | null {
  const vite = spawnSync("npx", ["vite", "build", "--outDir", uiDir, "--emptyOutDir"], { cwd: packageDir, encoding: "utf8" });
  if (vite.status === 0) return null;
  return `${vite.stdout ?? ""}${vite.stderr ?? ""}${vite.error ? String(vite.error) : ""}`;
}
