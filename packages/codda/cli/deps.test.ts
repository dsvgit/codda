// `codda build` builds the Dependency Artifact of a Course (ADR-0007) from the
// packages its Lessons import. The Course is a fixture the test writes itself,
// with ready node_modules of fake packages: npm is not called, no network.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeEach, describe, expect, test } from "vitest";

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

function codda(args: string[], env: Record<string, string> = {}) {
  const { status, stdout, stderr } = spawnSync("npx", ["codda", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, CODDA_UI_DIR: ui, ...env },
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

/** The hash folder `codda build` put into course.json, and the line it printed about it. */
function depsOf(out: string, stdout: string) {
  const { deps } = readJson(join(out, "course.json"));
  const line = stdout.split("\n").find((l) => l.startsWith("Зависимости:"));
  return { deps, line };
}

/** Every file under `dir` with its bytes, by path relative to `dir`. */
function filesUnder(dir: string): Record<string, string> {
  return Object.fromEntries(
    (readdirSync(dir, { recursive: true }) as string[])
      .filter((path) => statSync(join(dir, path)).isFile())
      .sort()
      .map((path) => [path, readFileSync(join(dir, path)).toString("base64")]),
  );
}

test("a second build of the same Course takes the artifact from .codda/ with the same hash and the same bytes", () => {
  const course = join(tmp, "course");
  writeCourse(course);

  const first = codda(["build", course, "--out", join(tmp, "one")]);
  expect(first.status).toBe(0);
  const one = depsOf(join(tmp, "one"), first.stdout);
  expect(one.line).toMatch(new RegExp(`^Зависимости: ${one.deps.slice(0, -1)} — собраны за \\d+(\\.\\d)? с$`));
  expect(existsSync(join(course, ".codda", one.deps, "importmap.json"))).toBe(true);

  const second = codda(["build", course, "--out", join(tmp, "two")]);
  expect(second.status).toBe(0);
  const two = depsOf(join(tmp, "two"), second.stdout);
  expect(two.deps).toBe(one.deps);
  expect(two.line).toBe(`Зависимости: ${one.deps.slice(0, -1)} — из кэша`);
  expect(filesUnder(join(tmp, "two", "deps"))).toEqual(filesUnder(join(tmp, "one", "deps")));
});

test("a new package import in one Lesson changes the hash and rebuilds; an edit that keeps the imports does not", () => {
  const course = join(tmp, "course");
  writeCourse(course);
  const build = (name: string) => {
    const { status, stdout } = codda(["build", course, "--out", join(tmp, name)]);
    expect(status).toBe(0);
    return depsOf(join(tmp, name), stdout);
  };
  const first = build("one");

  writeFiles(course, {
    "count/main.ts": 'import { start } from "esm-pkg";\n// подсказка: начните с start\nexport const count = start * 1;\n',
    "count/lesson.md": "---\ntitle: Счёт заново\n---\n",
  });
  const edited = build("two");
  expect(edited.deps).toBe(first.deps);
  expect(edited.line).toMatch(/— из кэша$/);

  writeFiles(course, { "greet/main.ts": 'import { greet } from "cjs-pkg";\nimport { start } from "esm-pkg";\nexport const hi = () => greet(String(start));\n' });
  // greet now imports esm-pkg too, but count already did: same entry points.
  expect(build("three").deps).toBe(first.deps);

  writeFiles(course, {
    "node_modules/esm-pkg/package.json": JSON.stringify({ name: "esm-pkg", version: "2.0.0", type: "module", main: "index.js", exports: { ".": "./index.js", "./extra": "./extra.js" } }),
    "node_modules/esm-pkg/extra.js": "export const extra = 1;\n",
    "greet/solution.ts": 'import { greet } from "cjs-pkg";\nimport { extra } from "esm-pkg/extra";\nexport const hi = () => greet(String(extra));\n',
  });
  const added = build("four");
  expect(added.deps).not.toBe(first.deps);
  expect(added.line).toMatch(/— собраны за/);
  expect(Object.keys(readJson(join(tmp, "four", added.deps, "importmap.json")).imports)).toContain("esm-pkg/extra");
});

test("a temporary folder left by an interrupted build is not taken for the artifact", () => {
  const course = join(tmp, "course");
  writeCourse(course);
  const first = codda(["build", course, "--out", join(tmp, "one")]);
  const { deps } = depsOf(join(tmp, "one"), first.stdout);
  // As if the build had stopped before its rename: the folder is still temporary and incomplete.
  renameSync(join(course, ".codda", deps), join(course, ".codda", `${deps.slice(0, -1)}.tmp-abc123`));
  rmSync(join(course, ".codda", `${deps.slice(0, -1)}.tmp-abc123`, "importmap.json"));

  const second = codda(["build", course, "--out", join(tmp, "two")]);
  expect(second.status).toBe(0);
  expect(depsOf(join(tmp, "two"), second.stdout).line).toMatch(/— собраны за/);
  expect(existsSync(join(tmp, "two", deps, "importmap.json"))).toBe(true);
});

/**
 * A stand-in for npm first on PATH: it logs its arguments, prints what a
 * successful `npm ci` prints and changes nothing. npx is not affected.
 */
function fakeNpm() {
  const bin = join(tmp, "bin");
  const log = join(tmp, "npm.log");
  writeFiles(bin, { npm: `#!/bin/sh\necho "$@" >> "${log}"\necho "added 2 packages in 1s"\n` });
  chmodSync(join(bin, "npm"), 0o755);
  return { env: { PATH: `${bin}${delimiter}${process.env.PATH}` }, calls: () => (existsSync(log) ? readFileSync(log, "utf8") : "") };
}

for (const ci of [undefined, "true"]) {
  describe(`CI=${ci ?? "unset"}`, () => {
    const ciEnv = (): Record<string, string> => (ci ? { CI: ci } : {});

    test("npm is not called when node_modules/.package-lock.json has the versions of package-lock.json", () => {
      const course = join(tmp, "course");
      writeCourse(course);
      const npm = fakeNpm();

      const { status } = codda(["build", course, "--out", join(tmp, "site")], { ...npm.env, ...ciEnv() });

      expect(status).toBe(0);
      expect(npm.calls()).toBe("");
    });

    test("npm ci runs, silently, when node_modules differ from package-lock.json", () => {
      const course = join(tmp, "course");
      writeCourse(course);
      const stale = { ...lockPackages, "node_modules/esm-pkg": { version: "1.9.0" } };
      writeFiles(course, { "node_modules/.package-lock.json": JSON.stringify({ name: "demo", lockfileVersion: 3, requires: true, packages: stale }) });
      const npm = fakeNpm();

      const { status, stdout, stderr } = codda(["build", course, "--out", join(tmp, "site")], { ...npm.env, ...ciEnv() });

      expect(status).toBe(0);
      expect(npm.calls()).toBe("ci\n");
      expect(stdout + stderr).not.toContain("added");
    });
  });
}

test("an npm ci failure shows npm's lines with the npm ci: prefix, then one hint; no artifact", () => {
  const course = join(tmp, "course");
  writeCourse(course);
  rmSync(join(course, "node_modules"), { recursive: true });
  // package.json asks for a version package-lock.json does not have. npm then
  // looks the package up in the registry; offline mode (standard npm config)
  // makes that fail at once, without network.
  writeFiles(course, { "package.json": JSON.stringify({ name: "demo", dependencies: { "cjs-pkg": "1.0.1", "esm-pkg": "2.0.0" } }) });
  const out = join(tmp, "site");

  const { status, stderr } = codda(["build", course, "--out", out], { npm_config_offline: "true" });

  expect(status).toBe(1);
  const lines = stderr.trimEnd().split("\n");
  expect(lines.length).toBeGreaterThan(1);
  expect(lines.slice(0, -1).every((line) => line.startsWith("npm ci: "))).toBe(true);
  expect(stderr).toContain("npm ci: npm error");
  expect(lines.at(-1)).toBe("запустите `npm install` локально и закоммитьте `package-lock.json`");
  expect(existsSync(join(out, "deps"))).toBe(false);
  expect(existsSync(join(course, ".codda", "deps")) && readdirSync(join(course, ".codda", "deps")).length).toBeFalsy();
});

test("a version range in dependencies is an error per package, all at once; a prerelease is exact, devDependencies are not read", () => {
  const course = join(tmp, "course");
  writeCourse(course);
  writeFiles(course, {
    "package.json": JSON.stringify({
      name: "demo",
      dependencies: { "cjs-pkg": "^19.3.0", "esm-pkg": "~1.0.0", "any-pkg": "*", "new-pkg": "latest", "beta-pkg": "1.0.0-beta.1" },
      devDependencies: { "dev-tool": "^3.0.0" },
    }),
  });
  const out = join(tmp, "site");

  const { status, stderr } = codda(["build", course, "--out", out]);

  expect(status).toBe(1);
  const lines = stderr.trimEnd().split("\n");
  expect(lines).toHaveLength(4);
  for (const [name, version] of [["cjs-pkg", "^19.3.0"], ["esm-pkg", "~1.0.0"], ["any-pkg", "*"], ["new-pkg", "latest"]]) {
    expect(lines.some((line) => line.includes(`\`${name}\``) && line.includes(version))).toBe(true);
  }
  expect(stderr).not.toContain("beta-pkg");
  expect(stderr).not.toContain("dev-tool");
  expect(existsSync(join(out, "course.json"))).toBe(false);
});

test("a range in devDependencies is not an error, and a devDependencies package does not get into the artifact", () => {
  const course = join(tmp, "course");
  writeCourse(course);
  writeFiles(course, {
    "package.json": JSON.stringify({ name: "demo", dependencies: { "cjs-pkg": "1.0.0", "esm-pkg": "2.0.0" }, devDependencies: { "dev-tool": "^3.0.0" } }),
    "node_modules/dev-tool/package.json": JSON.stringify({ name: "dev-tool", version: "3.1.0", main: "index.js" }),
    "node_modules/dev-tool/index.js": "exports.tool = 1;\n",
  });
  const out = join(tmp, "site");

  const { status, stdout } = codda(["build", course, "--out", out]);

  expect(status).toBe(0);
  const { deps } = depsOf(out, stdout);
  const files = readdirSync(join(out, deps)).map((name) => readFileSync(join(out, deps, name), "utf8"));
  expect(files.some((content) => content.includes("dev-tool"))).toBe(false);
});

for (const missing of ["package.json", "package-lock.json"]) {
  test(`no ${missing} in a Course that imports packages is an error with the npm install hint`, () => {
    const course = join(tmp, "course");
    writeCourse(course);
    rmSync(join(course, missing));

    const { status, stderr } = codda(["build", course, "--out", join(tmp, "site")]);

    expect(status).toBe(1);
    expect(stderr).toContain(missing);
    expect(stderr).toContain("запустите `npm install`");
  });
}

test("a Course without package imports builds without npm, package.json and deps/: \"deps\": null", () => {
  const course = join(tmp, "course");
  writeFiles(course, {
    "course.yaml": "id: plain\ntitle: Без пакетов\nmodules:\n  - title: Первый\n    lessons: [sum]\n",
    "sum/lesson.md": "---\ntitle: Сумма\n---\n",
    "sum/main.ts": "export const sum = (a: number, b: number) => 0;\n",
    "sum/solution.ts": "export const sum = (a: number, b: number) => a + b;\n",
    "sum/lesson.test.ts": 'import { test } from "@codda/test";\nimport { sum } from "./main";\ntest("sum", () => sum(1, 2));\n',
  });
  const npm = fakeNpm();
  const out = join(tmp, "site");

  const { status, stdout } = codda(["build", course, "--out", out], npm.env);

  expect(status).toBe(0);
  expect(npm.calls()).toBe("");
  expect(readJson(join(out, "course.json")).deps).toBeNull();
  expect(existsSync(join(out, "deps"))).toBe(false);
  expect(stdout).not.toContain("Зависимости:");
});

/** No artifact anywhere: neither in the build output nor in the cache of the Course. */
function expectNoArtifact(course: string, out: string) {
  expect(existsSync(join(out, "deps"))).toBe(false);
  expect(existsSync(join(course, ".codda", "deps")) && readdirSync(join(course, ".codda", "deps")).length).toBeFalsy();
}

test("an import of a package missing from dependencies names the Lesson, the file and the specifier", () => {
  const course = join(tmp, "course");
  writeCourse(course);
  writeFiles(course, {
    "greet/main.ts": 'import { greet } from "cjs-pkg";\nimport pad from "left-pad";\nexport const hi = () => greet(pad("мир"));\n',
    "greet/solution.ts": 'import { greet } from "cjs-pkg";\nimport { readFileSync } from "node:fs";\nexport const hi = () => greet(String(readFileSync));\n',
    "greet/lesson.test.ts": 'import { test } from "@codda/test";\nimport { trim } from "@acme/strings/trim";\nimport { hi } from "./main";\ntest("hi", () => trim(hi()));\n',
  });
  const out = join(tmp, "site");

  const { status, stderr } = codda(["build", course, "--out", out]);

  expect(status).toBe(1);
  const lines = stderr.trimEnd().split("\n");
  expect(lines).toEqual([
    'greet/lesson.test.ts: импорт "@acme/strings/trim": пакет не объявлен в dependencies package.json Course',
    'greet/main.ts: импорт "left-pad": пакет не объявлен в dependencies package.json Course',
    'greet/solution.ts: импорт "node:fs": пакет не объявлен в dependencies package.json Course',
  ]);
  expectNoArtifact(course, out);
});

test("undeclared imports in two Lessons are both reported at once", () => {
  const course = join(tmp, "course");
  writeCourse(course);
  writeFiles(course, {
    "greet/main.ts": 'import pad from "left-pad";\nexport const hi = () => pad("мир");\n',
    "count/main.ts": 'import { chunk } from "lodash";\nexport const count = chunk([], 1).length;\n',
  });
  const out = join(tmp, "site");

  const { status, stderr } = codda(["build", course, "--out", out]);

  expect(status).toBe(1);
  expect(stderr.trimEnd().split("\n")).toEqual([
    'count/main.ts: импорт "lodash": пакет не объявлен в dependencies package.json Course',
    'greet/main.ts: импорт "left-pad": пакет не объявлен в dependencies package.json Course',
  ]);
  expectNoArtifact(course, out);
});

/** Adds packages to dependencies, package-lock.json and node_modules, as `npm install` would. */
function addPackages(course: string, packages: Record<string, { files: Record<string, string>; declared?: boolean }>) {
  const pkg = readJson(join(course, "package.json"));
  const lock = readJson(join(course, "package-lock.json"));
  const files: Record<string, string> = {};
  for (const [name, { files: pkgFiles, declared = true }] of Object.entries(packages)) {
    const path = `node_modules/${name}`;
    if (declared) pkg.dependencies[name] = "1.0.0";
    lock.packages[path] = { version: "1.0.0" };
    for (const [file, content] of Object.entries(pkgFiles)) files[`${path}/${file}`] = content;
  }
  lock.packages[""].dependencies = pkg.dependencies;
  writeFiles(course, {
    ...files,
    "package.json": JSON.stringify(pkg),
    "package-lock.json": JSON.stringify(lock),
    "node_modules/.package-lock.json": JSON.stringify(lock),
  });
}

test("a package that imports a Node built-in, even a transitive or scoped one, is an error naming that package", () => {
  const course = join(tmp, "course");
  writeCourse(course);
  addPackages(course, {
    "wrap-pkg": {
      files: {
        "package.json": JSON.stringify({ name: "wrap-pkg", version: "1.0.0", type: "module", main: "index.js" }),
        "index.js": 'import inner from "inner-pkg";\nexport const wrap = inner;\n',
      },
    },
    "inner-pkg": {
      declared: false,
      files: {
        "package.json": JSON.stringify({ name: "inner-pkg", version: "1.0.0", main: "index.js" }),
        "index.js": 'const fs = require("fs");\nmodule.exports = fs.readFileSync;\n',
      },
    },
    "@acme/paths": {
      files: {
        "package.json": JSON.stringify({ name: "@acme/paths", version: "1.0.0", type: "module", main: "index.js" }),
        "index.js": 'import { join } from "node:path";\nexport const paths = join;\n',
      },
    },
  });
  writeFiles(course, {
    "greet/main.ts": 'import { greet } from "cjs-pkg";\nimport { wrap } from "wrap-pkg";\nimport { paths } from "@acme/paths";\nexport const hi = () => greet(String([wrap, paths]));\n',
  });
  const out = join(tmp, "site");

  const { status, stderr } = codda(["build", course, "--out", out]);

  expect(status).toBe(1);
  expect(stderr.trimEnd().split("\n").sort()).toEqual([
    "пакет `@acme/paths` импортирует встроенный модуль Node `node:path` и не работает в браузере",
    "пакет `inner-pkg` импортирует встроенный модуль Node `fs` и не работает в браузере",
  ]);
  expectNoArtifact(course, out);
});

test("a CommonJS package that throws on require() in Node is an error naming the package and the message", () => {
  const course = join(tmp, "course");
  writeCourse(course);
  addPackages(course, {
    "browser-only": {
      files: {
        "package.json": JSON.stringify({ name: "browser-only", version: "1.0.0", main: "index.js" }),
        "index.js": "exports.width = window.innerWidth;\n",
      },
    },
  });
  writeFiles(course, { "greet/main.ts": 'import { greet } from "cjs-pkg";\nimport { width } from "browser-only";\nexport const hi = () => greet(String(width));\n' });
  const out = join(tmp, "site");

  const { status, stderr } = codda(["build", course, "--out", out]);

  expect(status).toBe(1);
  expect(stderr.trimEnd().split("\n")).toEqual([
    "пакет `browser-only` падает при загрузке в Node (`require`): window is not defined; `codda` берёт из него имена экспортов",
  ]);
  expectNoArtifact(course, out);
});

test("a subpath missing from the package's exports is esbuild's error with the Lesson file and the specifier", () => {
  const course = join(tmp, "course");
  writeCourse(course);
  writeFiles(course, {
    "node_modules/esm-pkg/package.json": JSON.stringify({ name: "esm-pkg", version: "2.0.0", type: "module", exports: { ".": "./index.js" } }),
    "count/solution.ts": 'import { start } from "esm-pkg";\nimport { extra } from "esm-pkg/extra";\nexport const count = start + extra;\n',
  });
  const out = join(tmp, "site");

  const { status, stderr } = codda(["build", course, "--out", out]);

  expect(status).toBe(1);
  const lines = stderr.trimEnd().split("\n");
  expect(lines).toHaveLength(1);
  expect(lines[0]).toBe('count/solution.ts: импорт "esm-pkg/extra": Could not resolve "esm-pkg/extra"');
  expectNoArtifact(course, out);
});
