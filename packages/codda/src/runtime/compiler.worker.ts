// Compiler: bundles the student's source, the Lesson Tests, the Test Harness
// and the files of the Dependency Artifact they import into one IIFE with
// esbuild-wasm. Everything is resolved from memory; the artifact's files are
// fetched from our own origin (deps/<hash>/, built by `codda build`, ADR-0007)
// and inlined into the bundle, because the opaque-origin Sandbox could not
// fetch them itself (ADR-0003).
import * as esbuild from "esbuild-wasm";
import wasmURL from "esbuild-wasm/esbuild.wasm?url";
import harnessSource from "./harness.ts?raw";
import type { CompileInput, CompileResult } from "./types";

const ready = esbuild.initialize({ wasmURL, worker: false });

const ENTRY = `import { runAll } from "@codda/test";
import "./tests";
runAll();
`;

/** A loaded artifact: specifier → absolute URL of its file, absolute URL → file text. */
type Artifact = { imports: Record<string, string>; files: Record<string, string> };

// One artifact per Course; kept while the Worker lives, keyed by its importmap.json.
let artifact: { url: string; loaded: Promise<Artifact> } | undefined;

/**
 * The artifact of `importMap`: importmap.json, then every file it lists in
 * `integrity`, fetched once with that integrity (the browser checks it).
 * Its addresses are relative to the build root, two levels above
 * deps/<hash>/importmap.json.
 */
function loadArtifact(importMap: string): Promise<Artifact> {
  if (artifact?.url === importMap) return artifact.loaded;
  const loaded = (async () => {
    const map: { imports: Record<string, string>; integrity: Record<string, string> } = await fetchOk(
      importMap,
    ).then((r) => r.json());
    const root = new URL("../../", importMap);
    const files = await Promise.all(
      Object.entries(map.integrity).map(async ([address, integrity]) => {
        const url = new URL(address, root).href;
        return [url, await fetchOk(url, integrity).then((r) => r.text())] as const;
      }),
    );
    const imports = Object.entries(map.imports).map(([specifier, address]) => [specifier, new URL(address, root).href]);
    return { imports: Object.fromEntries(imports), files: Object.fromEntries(files) };
  })();
  artifact = { url: importMap, loaded };
  // A failed load is retried on the next Run instead of being cached.
  loaded.catch(() => {
    if (artifact?.loaded === loaded) artifact = undefined;
  });
  return loaded;
}

/** A file of the artifact is gone: a new deployment replaced deps/<hash>/. */
const COURSE_UPDATED = "Курс обновился, перезагрузите страницу";

/** Fetches `url`; fails with the text the student sees in the Test Report. */
async function fetchOk(url: string, integrity?: string): Promise<Response> {
  const path = new URL(url).pathname;
  let response: Response;
  try {
    response = await fetch(url, { integrity });
  } catch (err) {
    // The network failed or the file does not match its integrity. Chrome
    // rejects a 404 with `integrity` the same way (its body does not match),
    // so a second request without it tells a gone file apart.
    const gone = await fetch(url, { method: "HEAD", cache: "no-store" }).then(
      (r) => r.status === 404,
      () => false,
    );
    if (gone) throw new Error(COURSE_UPDATED);
    throw new Error(`Не удалось загрузить зависимости курса: ${path}: ${(err as Error).message}`);
  }
  if (response.status === 404) throw new Error(COURSE_UPDATED);
  if (!response.ok) throw new Error(`Не удалось загрузить зависимости курса: ${path}: HTTP ${response.status}`);
  return response;
}

// The Workspace, imported by the Lesson Tests as "./main" whatever its
// extension, is a "file" outside any directory: esbuild then names it plain
// "main" in its messages and locations, not "codda:./main".
const WORKSPACE_PATH = "/main";
const WORKSPACE_FILE = "main";

async function compile({ source, tests, importMap }: CompileInput): Promise<CompileResult> {
  // Import specifier → virtual file contents.
  const files: Record<string, string> = {
    "codda:entry": ENTRY,
    "@codda/test": harnessSource,
    "./tests": tests,
  };

  // A failed load of the artifact: the only error of the Run, without a line.
  let loadError: string | undefined;
  /** The artifact's address of `specifier`; none if the task does not provide it. */
  const resolveDependency = async (specifier: string) => {
    if (!importMap) return undefined;
    try {
      return (await loadArtifact(importMap)).imports[specifier];
    } catch (err) {
      loadError = (err as Error).message;
      return undefined;
    }
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
              // A chunk imported by a file of the artifact: a file of the same folder.
              if (args.namespace === "dependency") {
                return { path: new URL(args.path, args.importer).href, namespace: "dependency" };
              }
              const url = await resolveDependency(args.path);
              if (url) return { path: url, namespace: "dependency" };
              return { errors: [{ text: loadError ?? `Импорт "${args.path}" не предусмотрен заданием` }] };
            });
            build.onLoad({ filter: /.*/, namespace: "file" }, () => {
              return { contents: source, loader: "tsx" };
            });
            build.onLoad({ filter: /.*/, namespace: "codda" }, (args) => {
              return { contents: files[args.path], loader: "tsx" };
            });
            build.onLoad({ filter: /.*/, namespace: "dependency" }, async (args) => {
              return { contents: (await loadArtifact(importMap!)).files[args.path], loader: "js" };
            });
          },
        },
      ],
    });
    return { ok: true, code: result.outputFiles[0].text };
  } catch (err) {
    // The student's code is not run either way.
    if (loadError) return { ok: false, errors: [{ message: loadError }] };
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

self.onmessage = async (event: MessageEvent<{ id: number; input: CompileInput }>) => {
  const { id, input } = event.data;
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
