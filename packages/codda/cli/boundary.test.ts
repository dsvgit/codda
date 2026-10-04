// ADR-0006 boundary: the tool's code (this package: UI, Runtime, CLI) imports
// nothing from outside the package except packages in node_modules, above all
// nothing from courses/. rootDir in the tsconfigs catches plain imports; this
// test also sees what tsc does not, Vite's `?raw` and `?url` imports.
import { mkdirSync, mkdtempSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { expect, test } from "vitest";

/**
 * Not sources: dependencies, the built UI, static files served as is,
 * Vitest's attachments in .vitest/ (folders named after test files), the
 * Course the browser tests build a Dependency Artifact of and the templates of
 * `codda init`/`lesson` (Course files).
 */
const NOT_SOURCES = new Set(["node_modules", "dist-tool", "public", ".vitest", "fixtures", "templates"]);

/**
 * Every import of the package's sources that leads outside it, one line each.
 * esbuild parses each source (strings and comments are not imports) and
 * resolves every import the way a bundler does, `?raw`/`?url` included.
 */
async function boundaryViolations(dir: string): Promise<string[]> {
  // esbuild reports real paths (on macOS the temp folder is a symlink).
  const packageDir = realpathSync(dir);
  const sources = readdirSync(packageDir, { recursive: true, withFileTypes: true })
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => /\.(ts|tsx|mts|js|mjs)$/.test(path) && !NOT_SOURCES.has(relative(packageDir, path).split(sep)[0]));
  const violations: string[] = [];
  const own = Symbol("boundary");

  await esbuild.build({
    entryPoints: sources,
    bundle: true,
    write: false,
    outdir: join(packageDir, "out"),
    platform: "node",
    format: "esm",
    logLevel: "silent",
    plugins: [
      {
        name: "boundary",
        setup(build) {
          build.onResolve({ filter: /.*/ }, async (args) => {
            if (args.kind === "entry-point" || args.pluginData === own) return;
            const resolved = await build.resolve(args.path, {
              kind: args.kind,
              importer: args.importer,
              resolveDir: args.resolveDir,
              pluginData: own,
            });
            const file = relative(packageDir, args.importer).split(sep).join("/");
            if (resolved.errors.length > 0) {
              violations.push(`${file}: "${args.path}" не разрешается`);
              return { path: args.path, external: true };
            }
            const target = relative(packageDir, resolved.path).split(sep).join("/");
            if (!resolved.external && target.startsWith("../") && !target.split("/").includes("node_modules")) {
              violations.push(`${file}: "${args.path}" → ${target} вне пакета`);
            }
            return { path: args.path, external: true };
          });
        },
      },
    ],
  });
  return violations.sort();
}

/** A repository in a temp folder (`files`: path from its root → contents); returns its packages/codda. */
function fixture(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "codda-boundary-"));
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  return join(root, "packages/codda");
}

test("a static import from courses/ is a violation naming the file and the import", async () => {
  const packageDir = fixture({
    "courses/demo/lesson.ts": "export const lesson = 1;\n",
    "packages/codda/src/App.ts": 'import { lesson } from "../../../courses/demo/lesson.ts";\nexport const x = lesson;\n',
  });

  expect(await boundaryViolations(packageDir)).toEqual([
    'src/App.ts: "../../../courses/demo/lesson.ts" → ../../courses/demo/lesson.ts вне пакета',
  ]);
});

test.each([
  ["a dynamic import()", 'export const load = () => import("../../../../courses/demo/lesson.ts");\n', "../../../../courses/demo/lesson.ts", "lesson.ts"],
  ["export … from", 'export { lesson } from "../../../../courses/demo/lesson.ts";\n', "../../../../courses/demo/lesson.ts", "lesson.ts"],
  ["an import with ?raw", 'import text from "../../../../courses/demo/lesson.md?raw";\nexport { text };\n', "../../../../courses/demo/lesson.md?raw", "lesson.md"],
  ["an import with ?url", 'import url from "../../../../courses/demo/lesson.md?url";\nexport { url };\n', "../../../../courses/demo/lesson.md?url", "lesson.md"],
])("%s from courses/ is a violation", async (_, source, specifier, file) => {
  const packageDir = fixture({
    "courses/demo/lesson.ts": "export const lesson = 1;\n",
    "courses/demo/lesson.md": "# Lesson\n",
    "packages/codda/src/runtime/loader.ts": source,
  });

  expect(await boundaryViolations(packageDir)).toEqual([
    `src/runtime/loader.ts: "${specifier}" → ../../courses/demo/${file} вне пакета`,
  ]);
});

test("an import that does not resolve is a violation: where it leads is unknown", async () => {
  const packageDir = fixture({
    "packages/codda/src/App.ts": 'import { lesson } from "../../../courses/gone/lesson.ts";\nexport const x = lesson;\n',
  });

  expect(await boundaryViolations(packageDir)).toEqual([
    'src/App.ts: "../../../courses/gone/lesson.ts" не разрешается',
  ]);
});

test("a package from node_modules, an import inside the package and import text in a string are not violations", async () => {
  const packageDir = fixture({
    "node_modules/dep/package.json": '{ "name": "dep", "main": "index.js" }\n',
    "node_modules/dep/index.js": "export const dep = 1;\n",
    "courses/demo/lesson.ts": "export const lesson = 1;\n",
    "packages/codda/src/util.ts": "export const util = 1;\n",
    "packages/codda/src/App.ts": [
      'import { dep } from "dep";',
      'import { util } from "./util";',
      'import harness from "./util.ts?raw";',
      'import { readFileSync } from "node:fs";',
      'export const fixture = `import { lesson } from "../../../courses/demo/lesson.ts";`;',
      "export const all = [dep, util, harness, readFileSync];",
      "",
    ].join("\n"),
    // Static files served as is (the PoC Dependency Artifact), not sources.
    "packages/codda/public/deps/react.js": 'export * from "../../../../courses/demo/lesson.ts";\n',
  });

  expect(await boundaryViolations(packageDir)).toEqual([]);
});

test("the tool's code has no imports from outside the package", async () => {
  expect(await boundaryViolations(fileURLToPath(new URL("..", import.meta.url)))).toEqual([]);
});
