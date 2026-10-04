// Compiler: bundles the student's source, the Lesson Tests, the Test Harness
// and the Dependency Artifacts they import into one IIFE with esbuild-wasm.
// Everything is resolved from memory; artifacts are fetched from our own origin
// (public/deps/, built by scripts/build-deps.mjs) and inlined into the bundle,
// because the opaque-origin Sandbox could not fetch them itself (ADR-0003).
import * as esbuild from "esbuild-wasm";
import wasmURL from "esbuild-wasm/esbuild.wasm?url";
import harnessSource from "./harness.ts?raw";
import type { CompileInput, CompileResult } from "./types";

const ready = esbuild.initialize({ wasmURL, worker: false });

const ENTRY = `import { runAll } from "@codda/test";
import "./tests";
runAll();
`;

// Absolute URL of public/deps/, ending with "/". Sent by the page with every
// compile (compiler.ts): only the page knows where it is served from.
let depsURL: string;
let dependencies: Promise<Record<string, string>> | undefined;

/** Import specifier → artifact text. Fetched once, then kept while the Worker lives. */
function loadDependencies(): Promise<Record<string, string>> {
  dependencies ??= (async () => {
    const manifest: Record<string, string> = await fetchOk(new URL("manifest.json", depsURL)).then(
      (r) => r.json(),
    );
    const entries = await Promise.all(
      Object.entries(manifest).map(async ([specifier, file]) => {
        const text = await fetchOk(new URL(file, depsURL)).then((r) => r.text());
        return [specifier, text] as const;
      }),
    );
    return Object.fromEntries(entries);
  })();
  // A failed load is retried on the next Run instead of being cached.
  dependencies.catch(() => (dependencies = undefined));
  return dependencies;
}

async function fetchOk(url: URL): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url.pathname}: HTTP ${response.status}`);
  return response;
}

// The Workspace, imported by the Lesson Tests as "./main" whatever its
// extension, is a "file" outside any directory: esbuild then names it plain
// "main" in its messages and locations, not "codda:./main".
const WORKSPACE_PATH = "/main";
const WORKSPACE_FILE = "main";

async function compile({ source, tests }: CompileInput): Promise<CompileResult> {
  // Import specifier → virtual file contents.
  const files: Record<string, string> = {
    "codda:entry": ENTRY,
    "@codda/test": harnessSource,
    "./tests": tests,
  };

  await ready;
  try {
    const result = await esbuild.build({
      entryPoints: ["codda:entry"],
      bundle: true,
      write: false,
      format: "iife",
      jsx: "automatic",
      logLevel: "silent",
      absWorkingDir: "/",
      plugins: [
        {
          name: "codda-virtual",
          setup(build) {
            build.onResolve({ filter: /.*/ }, async (args) => {
              if (args.path === "./main") return { path: WORKSPACE_PATH, namespace: "file" };
              if (args.path in files) return { path: args.path, namespace: "codda" };
              if (args.path in (await loadDependencies())) {
                return { path: args.path, namespace: "dependency" };
              }
              return { errors: [{ text: `Cannot resolve "${args.path}"` }] };
            });
            build.onLoad({ filter: /.*/, namespace: "file" }, () => {
              return { contents: source, loader: "tsx" };
            });
            build.onLoad({ filter: /.*/, namespace: "codda" }, (args) => {
              return { contents: files[args.path], loader: "tsx" };
            });
            build.onLoad({ filter: /.*/, namespace: "dependency" }, async (args) => {
              return { contents: (await loadDependencies())[args.path], loader: "js" };
            });
          },
        },
      ],
    });
    return { ok: true, code: result.outputFiles[0].text };
  } catch (err) {
    const { errors } = err as esbuild.BuildFailure;
    return {
      ok: false,
      // Only a line of the Workspace is shown: the student does not see the
      // Lesson Tests, so their error (e.g. a renamed export) comes without one.
      errors: errors.map(({ text, location }) =>
        location?.file === WORKSPACE_FILE
          ? // esbuild columns are 0-based UTF-8 bytes; editors show 1-based characters.
            { message: text, line: location.line, column: charColumn(location.lineText, location.column) + 1 }
          : { message: text },
      ),
    };
  }
}

self.onmessage = async (
  event: MessageEvent<{ id: number; input: CompileInput; depsURL: string }>,
) => {
  const { id, input } = event.data;
  depsURL = event.data.depsURL;
  try {
    self.postMessage({ id, result: await compile(input) });
  } catch (err) {
    // Not a build failure: esbuild.wasm did not load or initialize failed.
    // The page terminates this Worker, so `ready` need not be retried here.
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};

/** The number of UTF-16 characters in the first `bytes` UTF-8 bytes of `text`. */
function charColumn(text: string, bytes: number): number {
  return new TextDecoder().decode(new TextEncoder().encode(text).slice(0, bytes)).length;
}
