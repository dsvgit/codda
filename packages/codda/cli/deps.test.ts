// `codda build` builds the Dependency Artifact of a Course (ADR-0007) from the
// packages its Lessons import. The Course is a fixture the test writes itself,
// with ready node_modules of fake packages: npm is not called, no network.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeEach, expect, test } from "vitest";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

let tmp: string;
let ui: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "codda-deps-"));
  ui = join(tmp, "ui");
  writeFiles(ui, { "index.html": "<!doctype html><title>codda</title>" });
});

function writeFiles(root: string, files: Record<string, string>) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
}

function codda(args: string[]) {
  const { status, stdout, stderr } = spawnSync("npx", ["codda", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, CODDA_UI_DIR: ui },
  });
  return { status, stdout, stderr };
}

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const sha384 = (path: string) => `sha384-${createHash("sha384").update(readFileSync(path)).digest("base64")}`;

const lockPackages = {
  "": { name: "demo", dependencies: { "cjs-pkg": "1.0.0", "esm-pkg": "2.0.0" } },
  "node_modules/cjs-pkg": { version: "1.0.0" },
  "node_modules/esm-pkg": { version: "2.0.0" },
};

/**
 * A Course of two Lessons: one imports a CommonJS package (named exports and
 * the default one), the other an ES module package; both import "./main".
 * node_modules match package-lock.json, as after `npm ci`.
 */
function writeCourse(dir: string) {
  writeFiles(dir, {
    "course.yaml": "id: demo\ntitle: Демо\nmodules:\n  - title: Первый\n    lessons: [greet, count]\n",
    "greet/lesson.md": "---\ntitle: Привет\n---\n",
    "greet/main.ts": 'import { greet } from "cjs-pkg";\nexport const hi = () => greet("мир");\n',
    "greet/solution.ts": 'import pkg, { greet } from "cjs-pkg";\nexport const hi = () => greet(String(pkg.answer));\n',
    "greet/lesson.test.ts": 'import { test } from "@codda/test";\nimport { hi } from "./main";\ntest("hi", () => hi());\n',
    "count/lesson.md": "---\ntitle: Счёт\n---\n",
    "count/main.ts": 'import { start } from "esm-pkg";\nexport const count = start;\n',
    "count/solution.ts": 'import { start } from "esm-pkg";\nexport const count = start + 1;\n',
    "count/lesson.test.ts": 'import type { Shape } from "types-only";\nimport { count } from "./main";\nexport const c: Shape = count;\n',
    "package.json": JSON.stringify({ name: "demo", dependencies: { "cjs-pkg": "1.0.0", "esm-pkg": "2.0.0" } }),
    "package-lock.json": JSON.stringify({ name: "demo", lockfileVersion: 3, requires: true, packages: lockPackages }),
    "node_modules/.package-lock.json": JSON.stringify({ name: "demo", lockfileVersion: 3, requires: true, packages: lockPackages }),
    "node_modules/cjs-pkg/package.json": JSON.stringify({ name: "cjs-pkg", version: "1.0.0", main: "index.js" }),
    "node_modules/cjs-pkg/index.js": 'exports.greet = (name) => `привет, ${name}`;\nexports.answer = 42;\n',
    "node_modules/esm-pkg/package.json": JSON.stringify({ name: "esm-pkg", version: "2.0.0", type: "module", main: "index.js" }),
    "node_modules/esm-pkg/index.js": "export const start = 10;\n",
  });
}

test("builds deps/<hash>/ with an import map of the packages the Lessons import, and points course.json at it", async () => {
  const course = join(tmp, "course");
  writeCourse(course);
  const out = join(tmp, "site");

  const { status, stderr } = codda(["build", course, "--out", out]);

  expect(stderr).toBe("");
  expect(status).toBe(0);
  const { deps } = readJson(join(out, "course.json"));
  expect(deps).toMatch(/^deps\/[0-9a-f]{16}\/$/);
  const dir = join(out, deps);
  const importMap = readJson(join(dir, "importmap.json"));

  // Bare specifiers only: not "./main", "@codda/test" or a type-only import.
  expect(Object.keys(importMap.imports)).toEqual(["cjs-pkg", "esm-pkg"]);
  const jsFiles = readdirSync(dir).filter((name) => name.endsWith(".js"));
  expect(Object.keys(importMap.integrity).sort()).toEqual(jsFiles.map((name) => `./${deps}${name}`).sort());
  for (const [address, integrity] of Object.entries(importMap.integrity)) {
    expect(integrity).toBe(sha384(join(out, address as string)));
  }

  // The files are ES modules: Node imports them as the browser would.
  const load = (specifier: string) => import(pathToFileURL(join(out, importMap.imports[specifier])).href);
  const cjs = await load("cjs-pkg");
  expect(cjs.greet("мир")).toBe("привет, мир");
  expect(cjs.answer).toBe(42);
  expect(cjs.default).toEqual({ greet: cjs.greet, answer: 42 });
  const esm = await load("esm-pkg");
  expect(esm.start).toBe(10);
});
