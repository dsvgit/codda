// The core of the type check (ADR-0009): TypeScript 6 over a virtual file
// system of @typescript/vfs, in the Type Checker's Worker and, later, in
// `codda test` in Node. The `ts` module is always passed in: a bare
// "typescript" import is TS 7, which has no JS API. Nothing is fetched from a
// CDN: lib files and types.json come from the caller (ADR-0002).
import { createSystem, createVirtualTypeScriptEnvironment, type VirtualTypeScriptEnvironment } from "@typescript/vfs";
import type * as TS from "typescript-6";
import { TS_COMPILER_OPTIONS } from "../ts-config.ts";

/** One error of a file. `from`/`to` are offsets in its text; `line`/`column` are 1-based. */
export type TypeError = { from: number; to: number; line: number; column: number; message: string; code: number };

export type TypeEnvironment = {
  /**
   * Creates the file `name` (e.g. "main.tsx") or replaces its text. It is the
   * student's one file: another name (another Lesson's Starter) drops the old one.
   */
  setFile: (name: string, text: string) => void;
  /** Syntactic and semantic errors of the file; warnings and suggestions are left out. */
  errors: (name: string) => TypeError[];
};

/** `files`: virtual path → text, the lib files (`/lib.*.d.ts`) and types.json as is. */
export function createTypeEnvironment(ts: typeof TS, files: Record<string, string>): TypeEnvironment {
  const { options } = ts.convertCompilerOptionsFromJson(TS_COMPILER_OPTIONS, "/");
  const fsMap = new Map(Object.entries(files));
  // The environment needs its root file at creation: it is made with the first file.
  let env: VirtualTypeScriptEnvironment | undefined;
  let current: string | undefined;

  return {
    setFile(name, text) {
      const path = `/${name}`;
      if (!env) {
        fsMap.set(path, text);
        // vfs is typed against the bare "typescript" (TS 7 types); it gets TS 6.
        env = createVirtualTypeScriptEnvironment(createSystem(fsMap), [path], ts as never, options as never);
      } else if (path === current) {
        env.updateFile(path, text);
      } else {
        env.deleteFile(current!);
        env.createFile(path, text);
      }
      current = path;
    },
    errors(name) {
      const path = `/${name}`;
      const service = env!.languageService;
      const file = env!.getSourceFile(path)!;
      return [...service.getSyntacticDiagnostics(path), ...service.getSemanticDiagnostics(path)]
        .filter((d) => d.category === ts.DiagnosticCategory.Error)
        .map((d) => {
          const from = d.start ?? 0;
          const { line, character } = file.getLineAndCharacterOfPosition(from);
          return {
            from,
            to: from + (d.length ?? 0),
            line: line + 1,
            column: character + 1,
            message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
            code: d.code,
          };
        });
    },
  };
}
