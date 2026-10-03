// Builds the Dependency Artifacts (ADR-0005) for the PoC: react,
// react/jsx-runtime and react-dom/client as browser-ready ESM text in
// public/deps/, plus manifest.json mapping each import specifier to its file.
// The Compiler fetches them from our origin and bundles them into every Run.
//
//   node scripts/build-deps.mjs
//
// React ships CommonJS, so each artifact gets a generated ESM entry that
// re-exports the package's names explicitly. Inside react-dom and the JSX
// runtime, `require("react")` is redirected to a shim that imports "react" as
// ESM: in the bundle it then resolves to the one react artifact, so all three
// share a single React instance.
import * as esbuild from "esbuild";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = new URL("../public/deps/", import.meta.url);
const version = require("react/package.json").version;
if (require("react-dom/package.json").version !== version) {
  throw new Error("react and react-dom versions differ");
}

const artifacts = [
  { specifier: "react", file: `react@${version}.js` },
  { specifier: "react/jsx-runtime", file: `react-jsx-runtime@${version}.js` },
  { specifier: "react-dom/client", file: `react-dom-client@${version}.js` },
];

/** `export { a, b } from "<specifier>"` for every named export of a CJS module. */
function esmEntry(specifier) {
  const names = Object.keys(require(specifier)).filter((n) => n !== "default");
  return `export { ${names.join(", ")} } from "${specifier}";\n`;
}

const reactAsEsm = {
  name: "react-as-esm",
  setup(build) {
    build.onResolve({ filter: /^react$/ }, (args) =>
      args.kind === "require-call" ? { path: "react", namespace: "react-shim" } : undefined,
    );
    build.onResolve({ filter: /^react$/, namespace: "react-shim" }, () => ({
      path: "react",
      external: true,
    }));
    build.onLoad({ filter: /.*/, namespace: "react-shim" }, () => ({
      contents: `export * from "react";`,
      loader: "js",
    }));
  },
};

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const { specifier, file } of artifacts) {
  await esbuild.build({
    stdin: { contents: esmEntry(specifier), resolveDir: root, loader: "js" },
    outfile: fileURLToPath(new URL(file, outDir)),
    bundle: true,
    format: "esm",
    platform: "browser",
    // Development builds: `act`, which the Lesson Tests use, is not supported
    // in production builds of React.
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: specifier === "react" ? [] : [reactAsEsm],
    logLevel: "warning",
  });
}

const manifest = Object.fromEntries(artifacts.map((a) => [a.specifier, a.file]));
await writeFile(new URL("manifest.json", outDir), JSON.stringify(manifest, null, 2) + "\n");
console.log(manifest);
