// Compiler: bundles the student's source, the Lesson Tests and the Test Harness
// into one IIFE with esbuild-wasm. Everything is resolved from memory.
import * as esbuild from "esbuild-wasm";
import wasmURL from "esbuild-wasm/esbuild.wasm?url";
import harnessSource from "./harness.ts?raw";
import type { CompileInput, CompileResult } from "./types";

const ready = esbuild.initialize({ wasmURL, worker: false });

const ENTRY = `import { runAll } from "@codda/test";
import "./tests";
runAll();
`;

async function compile({ source, tests }: CompileInput): Promise<CompileResult> {
  // Import specifier → virtual file contents.
  const files: Record<string, string> = {
    "codda:entry": ENTRY,
    "@codda/test": harnessSource,
    "./tests": tests,
    "./App": source,
  };

  await ready;
  try {
    const result = await esbuild.build({
      entryPoints: ["codda:entry"],
      bundle: true,
      write: false,
      format: "iife",
      logLevel: "silent",
      plugins: [
        {
          name: "codda-virtual",
          setup(build) {
            build.onResolve({ filter: /.*/ }, (args) => {
              if (!(args.path in files)) {
                return { errors: [{ text: `Cannot resolve "${args.path}"` }] };
              }
              return { path: args.path, namespace: "codda" };
            });
            build.onLoad({ filter: /.*/, namespace: "codda" }, (args) => {
              return { contents: files[args.path], loader: "tsx" };
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
      errors: errors.map((e) => ({
        message: e.text,
        line: e.location?.line,
        column: e.location?.column,
      })),
    };
  }
}

self.onmessage = async (event: MessageEvent<{ id: number; input: CompileInput }>) => {
  const { id, input } = event.data;
  self.postMessage({ id, result: await compile(input) });
};
