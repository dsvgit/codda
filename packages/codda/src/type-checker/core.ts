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

/** One completion as CodeMirror shows it: `type` picks its icon, `detail` is a short signature. */
export type CompletionItem = { label: string; type?: string; detail?: string };

/** What the completions replace — `from`…`to`, the prefix typed so far — and the items. */
export type Completions = { from: number; to: number; items: CompletionItem[] };

export type TypeEnvironment = {
  /**
   * Creates the file `name` (e.g. "main.tsx") or replaces its text. It is the
   * student's one file: another name (another Lesson's Starter) drops the old one.
   */
  setFile: (name: string, text: string) => void;
  /**
   * The files are exactly `files` (name → text), e.g. a Solution as "main.ts"
   * with its Lesson Tests for `codda test`: files of the previous set are dropped.
   */
  setFiles: (files: Record<string, string>) => void;
  /** Syntactic and semantic errors of the file; warnings and suggestions are left out. */
  errors: (name: string) => TypeError[];
  /** Completions at offset `pos` of the file: none inside a string or a comment, no auto-import. */
  completions: (name: string, pos: number) => Completions;
};

/** TS's kind of a completion (ScriptElementKind) → CodeMirror's type; another kind gets none. */
const TYPES: Record<string, string> = {
  function: "function",
  "local function": "function",
  var: "variable",
  "local var": "variable",
  let: "variable",
  const: "variable",
  parameter: "variable",
  property: "property",
  getter: "property",
  setter: "property",
  method: "method",
  keyword: "keyword",
  class: "class",
  "local class": "class",
  interface: "interface",
  type: "type",
  "type parameter": "type",
  "primitive type": "type",
};

/** An imported name is «alias»: the first keyword of its signature says what it names. */
const ALIASED: Record<string, string> = {
  function: "function",
  var: "variable",
  let: "variable",
  const: "variable",
  class: "class",
  interface: "interface",
  type: "type",
};

/** Signatures are asked for one by one; this many per list keeps a list of every global fast. */
const DETAILS_LIMIT = 50;

/** Not in TS's public typings, but in its module: where TS's own completions look. */
type Internals = {
  isInString: (file: TS.SourceFile, pos: number) => boolean;
  isInComment: (file: TS.SourceFile, pos: number) => unknown;
};

/** `files`: virtual path → text, the lib files (`/lib.*.d.ts`) and types.json as is. */
export function createTypeEnvironment(ts: typeof TS, files: Record<string, string>): TypeEnvironment {
  const { options } = ts.convertCompilerOptionsFromJson(TS_COMPILER_OPTIONS, "/");
  const fsMap = new Map(Object.entries(files));
  // The environment needs its root files at creation: it is made with the first ones.
  let env: VirtualTypeScriptEnvironment | undefined;
  let current: string[] = [];

  const setFiles = (files: Record<string, string>) => {
    const paths = Object.keys(files).map((name) => `/${name}`);
    if (!env) {
      for (const name in files) fsMap.set(`/${name}`, files[name]);
      // vfs is typed against the bare "typescript" (TS 7 types); it gets TS 6.
      env = createVirtualTypeScriptEnvironment(createSystem(fsMap), paths, ts as never, options as never);
    } else {
      for (const path of current) if (!paths.includes(path)) env.deleteFile(path);
      for (const name in files) {
        const path = `/${name}`;
        if (current.includes(path)) env.updateFile(path, files[name]);
        else env.createFile(path, files[name]);
      }
    }
    current = paths;
  };

  return {
    setFile: (name, text) => setFiles({ [name]: text }),
    setFiles,
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
    completions(name, pos) {
      const path = `/${name}`;
      // vfs gives the TS 7 types, which have no language service: these are TS 6's.
      const service = env!.languageService as unknown as TS.LanguageService;
      const file = env!.getSourceFile(path) as unknown as TS.SourceFile;
      const internals = ts as unknown as Internals;
      if (internals.isInString(file, pos) || internals.isInComment(file, pos)) return { from: pos, to: pos, items: [] };
      const result = service.getCompletionsAtPosition(path, pos, { includeCompletionsForModuleExports: false });
      const span = result?.optionalReplacementSpan;
      const from = span ? span.start : pos;
      const prefix = file.text.slice(from, pos).toLowerCase();
      let detailed = 0;
      const items = (result?.entries ?? []).map(({ name: label, kind, source, data }): CompletionItem => {
        if (detailed >= DETAILS_LIMIT || !label.toLowerCase().startsWith(prefix)) return { label, type: TYPES[kind] };
        detailed++;
        const parts = service.getCompletionEntryDetails(path, pos, label, {}, source, {}, data)?.displayParts ?? [];
        const type = kind === "alias" ? ALIASED[parts.find((part) => part.kind === "keyword")?.text ?? ""] : TYPES[kind];
        // "(method) Array<number>.map<U>(…)…": the kind is the icon already; one line is enough.
        const detail = ts.displayPartsToString(parts).replace(/^\([^)]*\) /, "").split("\n")[0];
        return detail ? { label, type, detail } : { label, type };
      });
      return { from, to: pos, items };
    },
  };
}
