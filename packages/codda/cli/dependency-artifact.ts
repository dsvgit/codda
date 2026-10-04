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
import { createRequire, isBuiltin } from "node:module";
import { basename, dirname, extname, join, relative, sep } from "node:path";
import * as esbuild from "esbuild";

/** Raised by hand on any change of what the artifact contains or how it is laid out. */
const PIPELINE_VERSION = 2; // 2: types.json

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

type Result = { deps: null } | { deps: string; log: string; warnings: string[] } | { errors: string[] };

/**
 * Builds the artifact of the Course at `courseRoot` with Lessons `lessonIds` into
 * `<out>/deps/<hash>/`. `deps` is that folder relative to `out`, or null if
 * no Lesson imports a package; `log` is the one line about it for the Author,
 * `warnings` are about packages without types.
 *
 * The artifact is cached in `.codda/deps/<hash>/` of the Course: a hit runs
 * neither npm nor esbuild. A build goes into a temporary folder next to it and
 * is renamed to `<hash>/` only when complete.
 */
export async function buildDependencyArtifact(courseRoot: string, lessonIds: string[], out: string): Promise<Result> {
  // esbuild reports real paths (on macOS the temp folder is a symlink).
  const root = realpathSync(courseRoot);
  const importers = await entryPoints(root, lessonIds);
  const entries = [...importers.keys()].sort();
  if (entries.length === 0) return { deps: null };
  const problems = checkPackageJson(root, importers);
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
    try {
      const failed = await bundle(root, entries, importers, deps, tmp);
      if (failed) return failed;
      writeFileSync(join(tmp, "types.json"), JSON.stringify(types(root, entries)) + "\n");
      renameSync(tmp, cached);
    } finally {
      // After the rename there is nothing left at `tmp`.
      rmSync(tmp, { recursive: true, force: true });
    }
    log = `Зависимости: deps/${hash} — собраны за ${((performance.now() - started) / 1000).toFixed(1)} с`;
  }
  cpSync(cached, join(out, deps), { recursive: true });
  return { deps, log, warnings: untypedWarnings(join(cached, "types.json")) };
}

/** What `types.json` has for a package without types: the module is `any`. */
const ANY_STUB = "declare const m: any;\nexport = m;\n";

/**
 * types.json: the slice of node_modules with types the Type Checker needs, as
 * `/node_modules/<package>/<file>` → text. `package.json` and the declaration
 * files of each package of `dependencies` and of their `dependencies` and
 * `peerDependencies`, transitively, that have any. A declared package without
 * types and without a declared `@types` package gets an `any` stub in
 * `@types/<name>` for each of its entry points, where TS looks it up.
 */
function types(root: string, entries: string[]): Record<string, string> {
  const { dependencies = {} } = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { dependencies?: Record<string, string> };
  const files: Record<string, string> = {};
  const seen = new Set<string>();
  const visit = (dir: string) => {
    if (seen.has(dir) || !existsSync(join(dir, "package.json"))) return;
    seen.add(dir);
    const declarations = (readdirSync(dir, { recursive: true }) as string[])
      .map((path) => path.split(sep).join("/"))
      .filter((path) => /\.d\.[mc]?ts$/.test(path) && !path.split("/").includes("node_modules"));
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { dependencies?: object; peerDependencies?: object };
    if (declarations.length > 0) {
      const at = `/${relative(root, dir).split(sep).join("/")}/`;
      for (const path of ["package.json", ...declarations]) files[at + path] = readFileSync(join(dir, path), "utf8");
    }
    for (const name of Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies })) {
      // Node's lookup: node_modules of the package first, then up to the Course's.
      const nested = join(dir, "node_modules", name);
      visit(existsSync(nested) ? nested : join(root, "node_modules", name));
    }
  };
  for (const name of Object.keys(dependencies)) visit(join(root, "node_modules", name));

  for (const name of Object.keys(dependencies)) {
    const typesName = `@types/${name.replace(/^@/, "").replace("/", "__")}`;
    const own = Object.keys(files).some((path) => path.startsWith(`/node_modules/${name}/`));
    if (name.startsWith("@types/") || own || Object.hasOwn(dependencies, typesName)) continue;
    for (const entry of entries.filter((specifier) => packageName(specifier) === name)) {
      const subpath = entry.slice(name.length + 1) || "index";
      files[`/node_modules/${typesName}/${subpath}.d.ts`] = ANY_STUB;
    }
  }
  return sortKeys(files);
}

/** The warnings for the packages types.json has `any` stubs of: told on a cache hit too. */
function untypedWarnings(typesJson: string): string[] {
  const stubbed = Object.entries(JSON.parse(readFileSync(typesJson, "utf8")) as Record<string, string>)
    .filter(([, text]) => text === ANY_STUB)
    .map(([path]) => /^\/node_modules\/@types\/([^/]+)\//.exec(path)![1]);
  return [...new Set(stubbed)].map((typesName) => {
    const name = typesName.includes("__") ? `@${typesName.replace("__", "/")}` : typesName;
    return `у пакета \`${name}\` нет типов: объявите \`@types/${typesName}\` в dependencies, если он есть, иначе в редакторе он будет \`any\``;
  });
}

/** An exact semver version, a prerelease allowed: what `save-exact` writes. */
const EXACT_VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

/**
 * package.json and package-lock.json are there, every package in
 * `dependencies` has an exact version, and every entry point is a package
 * declared there. `devDependencies` are not read.
 */
function checkPackageJson(root: string, importers: Map<string, string[]>): string[] {
  const missing = ["package.json", "package-lock.json"].filter((name) => !existsSync(join(root, name)));
  if (missing.length > 0) return missing.map((name) => `нет ${name} в корне курса: запустите \`npm install\``);
  const { dependencies = {} } = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { dependencies?: Record<string, string> };
  const ranges = Object.entries(dependencies)
    .filter(([, version]) => !EXACT_VERSION.test(version))
    .map(([name, version]) => `package.json: у пакета \`${name}\` версия \`${version}\`, нужна точная (X.Y.Z): запустите \`npm install ${name}@<версия> --save-exact\``);
  const undeclared = [...importers]
    .filter(([specifier]) => !Object.hasOwn(dependencies, packageName(specifier)))
    .flatMap(([specifier, files]) => files.map((file) => `${file}: импорт "${specifier}": пакет не объявлен в dependencies package.json Course`))
    .sort();
  return [...ranges, ...undeclared];
}

/** The package of a bare specifier: `react-dom/client` → `react-dom`, `@scope/pkg/sub` → `@scope/pkg`. */
function packageName(specifier: string): string {
  return specifier.split("/").slice(0, specifier.startsWith("@") ? 2 : 1).join("/");
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
async function bundle(root: string, entries: string[], importers: Map<string, string[]>, deps: string, dir: string): Promise<{ errors: string[] } | undefined> {
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
              if (resolved.errors.length > 0) {
                // Told at the Lesson files that import the specifier, not at the Course root.
                // The notes are left out: here they only suggest marking the path external.
                const why = resolved.errors.map(({ text }) => text).join("; ");
                const files = importers.get(args.path) ?? [];
                return { errors: files.map((file) => ({ text: `${file}: импорт "${args.path}": ${why}`, location: null })) };
              }
              // An ES module is its own entry point; a CommonJS one gets a wrapper.
              if (isEsModule(resolved.path)) {
                specifierOf.set(relative(root, resolved.path).split(sep).join("/"), args.path);
                return { path: resolved.path };
              }
              specifierOf.set(`codda-cjs:${args.path}`, args.path);
              return { path: args.path, namespace: "codda-cjs" };
            });
            build.onLoad({ filter: /.*/, namespace: "codda-cjs" }, (args) => {
              let exports: object;
              try {
                exports = require(args.path);
              } catch (err) {
                const text = `пакет \`${packageName(args.path)}\` падает при загрузке в Node (\`require\`): ${err instanceof Error ? err.message : String(err)}; \`codda\` берёт из него имена экспортов`;
                // An error without a location: esbuild would take one from the stack, inside esbuild.
                return { errors: [{ text, location: null }] };
              }
              return { contents: cjsWrapper(args.path, exports), resolveDir: root, loader: "js" };
            });
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

/**
 * The bare specifiers imported by the Lessons' sources, each with the files
 * (`<lesson>/<file>`, relative to the Course) that import it.
 */
async function entryPoints(root: string, lessonIds: string[]): Promise<Map<string, string[]>> {
  const sources = lessonIds.flatMap((id) =>
    readdirSync(join(root, id))
      .filter((name) => /^(main|solution|lesson\.test)\.tsx?$/.test(name))
      .map((name) => join(root, id, name)),
  );
  const found = new Map<string, string[]>();
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
            if (!args.path.startsWith(".") && args.path !== "@codda/test") {
              const file = relative(root, args.importer).split(sep).join("/");
              const files = found.get(args.path) ?? [];
              if (!files.includes(file)) found.set(args.path, [...files, file]);
            }
            return { path: args.path, external: true };
          });
        },
      },
    ],
  });
  return found;
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
 * `module.exports`, the named exports are the keys of `exports`, what
 * `require()` in Node from the Course folder returned.
 */
function cjsWrapper(specifier: string, exports: object): string {
  const names = Object.keys(exports).filter((name) => name !== "default" && name !== "__esModule");
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

/**
 * An esbuild error for the Author. A package importing a Node built-in is told
 * by name: the package of the importing file, the last `node_modules/<name>`
 * of its path, so a transitive dependency is named, not the entry point.
 */
function formatMessage({ text, location }: esbuild.Message): string {
  const builtin = /^Could not resolve "(.+)"$/.exec(text)?.[1];
  const inPackage = location && /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)\/(?!.*\/node_modules\/)/.exec(location.file)?.[1];
  if (builtin && isBuiltin(builtin) && inPackage) {
    return `пакет \`${inPackage}\` импортирует встроенный модуль Node \`${builtin}\` и не работает в браузере`;
  }
  return location ? `${location.file}:${location.line}: ${text}` : text;
}
