// Dependency Artifact of a Course (ADR-0007): the packages its Lessons import,
// bundled for the browser into `deps/<hash>/` with a standard import map.
// Used by `codda build` and the tool's dev server (vite.config.ts).
//
// Entry points are the bare specifiers that Starter, Solution and Lesson Tests
// import, parsed by esbuild the way the Compiler parses them (TSX with the
// automatic JSX runtime). All of them go into one esbuild call with splitting,
// so a module shared by several entry points (react inside react-dom) is one
// chunk and has one instance.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, extname, join, relative, sep } from "node:path";
import * as esbuild from "esbuild";

/** Raised by hand on any change of what the artifact contains or how it is laid out. */
const PIPELINE_VERSION = 1;

const BUILD_OPTIONS = {
  bundle: true,
  format: "esm",
  splitting: true,
  platform: "browser",
  // Development builds: `act`, which the Lesson Tests use, is not supported in
  // production builds of React (R5).
  conditions: ["development"],
  define: { "process.env.NODE_ENV": '"development"' },
  entryNames: "[name]-[hash]",
  chunkNames: "chunk-[hash]",
} satisfies esbuild.BuildOptions;

type Result = { deps: null } | { deps: string; log: string } | { errors: string[] };

/**
 * Builds the artifact of the Course at `courseRoot` with Lessons `lessonIds` into
 * `<out>/deps/<hash>/`. `deps` is that folder relative to `out`, or null if
 * no Lesson imports a package; `log` is the one line about it for the Author.
 *
 * The artifact is cached in `.codda/deps/<hash>/` of the Course: a hit runs
 * neither npm nor esbuild. A build goes into a temporary folder next to it and
 * is renamed to `<hash>/` only when complete.
 */
export async function buildDependencyArtifact(courseRoot: string, lessonIds: string[], out: string): Promise<Result> {
  // esbuild reports real paths (on macOS the temp folder is a symlink).
  const root = realpathSync(courseRoot);
  const entries = await entryPoints(root, lessonIds);
  if (entries.length === 0) return { deps: null };
  const problems = checkPackageJson(root);
  if (problems.length > 0) return { errors: problems };

  const hash = createHash("sha256")
    .update(JSON.stringify([readFileSync(join(root, "package-lock.json"), "utf8"), entries, esbuild.version, BUILD_OPTIONS, PIPELINE_VERSION]))
    .digest("hex")
    .slice(0, 16);
  const deps = `deps/${hash}/`;
  const cached = join(root, ".codda", deps);

  let log = `Зависимости: deps/${hash} — из кэша`;
  if (!existsSync(cached)) {
    const started = performance.now();
    if (!installed(root)) {
      const npm = spawnSync("npm", ["ci"], { cwd: root, encoding: "utf8" });
      if (npm.status !== 0) {
        const output = `${npm.stdout ?? ""}${npm.stderr ?? ""}${npm.error ? String(npm.error) : ""}`;
        return {
          errors: [
            ...output.split("\n").filter((line) => line.trim() !== "").map((line) => `npm ci: ${line}`),
            "запустите `npm install` локально и закоммитьте `package-lock.json`",
          ],
        };
      }
    }
    mkdirSync(join(root, ".codda", "deps"), { recursive: true });
    const tmp = mkdtempSync(join(root, ".codda", "deps", `${hash}.tmp-`));
    const built = await bundle(root, entries, deps, tmp);
    if (built) {
      rmSync(tmp, { recursive: true, force: true });
      return built;
    }
    renameSync(tmp, cached);
    log = `Зависимости: deps/${hash} — собраны за ${((performance.now() - started) / 1000).toFixed(1)} с`;
  }
  cpSync(cached, join(out, deps), { recursive: true });
  return { deps, log };
}

/** An exact semver version, a prerelease allowed: what `save-exact` writes. */
const EXACT_VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

/**
 * package.json and package-lock.json are there, and every package in
 * `dependencies` has an exact version. `devDependencies` are not read.
 */
function checkPackageJson(root: string): string[] {
  const missing = ["package.json", "package-lock.json"].filter((name) => !existsSync(join(root, name)));
  if (missing.length > 0) return missing.map((name) => `нет ${name} в корне курса: запустите \`npm install\``);
  const { dependencies = {} } = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { dependencies?: Record<string, string> };
  return Object.entries(dependencies)
    .filter(([, version]) => !EXACT_VERSION.test(version))
    .map(([name, version]) => `package.json: у пакета \`${name}\` версия \`${version}\`, нужна точная (X.Y.Z): запустите \`npm install ${name}@<версия> --save-exact\``);
}

/**
 * Whether node_modules are what `npm ci` would make of package-lock.json: npm's
 * own record of them, node_modules/.package-lock.json, has the same packages at
 * the same versions. The same rule in CI and locally: in CI the workflow's own
 * `npm ci` has installed them already.
 */
function installed(root: string): boolean {
  const record = join(root, "node_modules", ".package-lock.json");
  if (!existsSync(record)) return false;
  const versions = (path: string) => {
    const { packages = {} } = JSON.parse(readFileSync(path, "utf8")) as { packages?: Record<string, { version?: string }> };
    return Object.entries(packages)
      .filter(([key]) => key !== "")
      .map(([key, { version }]) => `${key}@${version}`)
      .sort();
  };
  return JSON.stringify(versions(record)) === JSON.stringify(versions(join(root, "package-lock.json")));
}

/**
 * One esbuild call on all entry points into `dir`; the import map gives the
 * files at their addresses under `deps` in the build root. Errors, if any.
 */
async function bundle(root: string, entries: string[], deps: string, dir: string): Promise<{ errors: string[] } | undefined> {
  const require = createRequire(join(root, "package.json"));
  // Entry point in the metafile → specifier; esbuild names an ES module entry by its file.
  const specifierOf = new Map<string, string>();
  let result;
  try {
    result = await esbuild.build({
      ...BUILD_OPTIONS,
      // The output name of each entry point: its specifier with "/" → "__".
      entryPoints: Object.fromEntries(entries.map((specifier) => [specifier.replaceAll("/", "__"), specifier])),
      outdir: dir,
      absWorkingDir: root,
      write: false,
      metafile: true,
      logLevel: "silent",
      plugins: [
        {
          name: "codda-entry-points",
          setup(build) {
            build.onResolve({ filter: /.*/ }, async (args) => {
              if (args.kind !== "entry-point") return;
              const resolved = await build.resolve(args.path, { kind: "import-statement", resolveDir: root });
              if (resolved.errors.length > 0) return { errors: resolved.errors };
              // An ES module is its own entry point; a CommonJS one gets a wrapper.
              if (isEsModule(resolved.path)) {
                specifierOf.set(relative(root, resolved.path).split(sep).join("/"), args.path);
                return { path: resolved.path };
              }
              specifierOf.set(`codda-cjs:${args.path}`, args.path);
              return { path: args.path, namespace: "codda-cjs" };
            });
            build.onLoad({ filter: /.*/, namespace: "codda-cjs" }, (args) => ({
              contents: cjsWrapper(args.path, require),
              resolveDir: root,
              loader: "js",
            }));
          },
        },
      ],
    });
  } catch (err) {
    return { errors: (err as esbuild.BuildFailure).errors.map(formatMessage) };
  }

  const imports: Record<string, string> = {};
  const integrity: Record<string, string> = {};
  for (const file of result.outputFiles) {
    const address = `./${deps}${basename(file.path)}`;
    writeFileSync(file.path, file.contents);
    integrity[address] = `sha384-${createHash("sha384").update(file.contents).digest("base64")}`;
  }
  for (const [path, output] of Object.entries(result.metafile.outputs)) {
    if (!output.entryPoint) continue;
    imports[specifierOf.get(output.entryPoint)!] = `./${deps}${basename(path)}`;
  }
  writeFileSync(join(dir, "importmap.json"), JSON.stringify({ imports: sortKeys(imports), integrity }, null, 2) + "\n");
}

/** Sorted, unique bare specifiers imported by the Lessons' sources. */
async function entryPoints(root: string, lessonIds: string[]): Promise<string[]> {
  const sources = lessonIds.flatMap((id) =>
    readdirSync(join(root, id))
      .filter((name) => /^(main|solution|lesson\.test)\.tsx?$/.test(name))
      .map((name) => join(root, id, name)),
  );
  const found = new Set<string>();
  await esbuild.build({
    entryPoints: sources,
    bundle: true,
    write: false,
    outdir: join(root, "out"), // required for several entry points; nothing is written
    jsx: "automatic",
    logLevel: "silent",
    // Sources are .ts and .tsx, but the Compiler parses every one as TSX.
    loader: { ".ts": "tsx" },
    plugins: [
      {
        name: "codda-imports",
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            if (args.kind === "entry-point") return;
            if (!args.path.startsWith(".") && args.path !== "@codda/test") found.add(args.path);
            return { path: args.path, external: true };
          });
        },
      },
    ],
  });
  return [...found].sort();
}

/**
 * ES module or CommonJS, by the file Node conventions and, for a plain .js file
 * of a package without "type", by whether it has top-level import/export.
 */
function isEsModule(path: string): boolean {
  const ext = extname(path);
  if (ext === ".mjs") return true;
  if (ext === ".cjs") return false;
  for (let dir = dirname(path); dir !== dirname(dir); dir = dirname(dir)) {
    const pkg = join(dir, "package.json");
    if (!existsSync(pkg)) continue;
    if (JSON.parse(readFileSync(pkg, "utf8")).type === "module") return true;
    break;
  }
  return /^\s*(import\s*[{*"']|import\s+\w|export\s*[{*]|export\s+\w)/m.test(readFileSync(path, "utf8"));
}

/**
 * The ES module entry point of a CommonJS module (R9): `export default` is
 * `module.exports`, the named exports are its keys as `require()` in Node
 * from the Course folder sees them.
 */
function cjsWrapper(specifier: string, require: NodeJS.Require): string {
  const names = Object.keys(require(specifier)).filter((name) => name !== "default" && name !== "__esModule");
  const quoted = names.map((name) => JSON.stringify(name));
  return (
    `const m = require(${JSON.stringify(specifier)});\n` +
    `export default m;\n` +
    `const { ${quoted.map((name, i) => `${name}: _${i}`).join(", ")} } = m;\n` +
    `export { ${quoted.map((name, i) => `_${i} as ${name}`).join(", ")} };\n`
  );
}

function sortKeys(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : 1)));
}

function formatMessage({ text, location }: esbuild.Message): string {
  return location ? `${location.file}:${location.line}: ${text}` : text;
}
