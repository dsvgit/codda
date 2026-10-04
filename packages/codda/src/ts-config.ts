// The one TypeScript config of the tool (ADR-0009): the Compiler (esbuild),
// the Type Checker in the browser and the type check of `codda test` read it.
// tsconfig JSON, not the programmatic form: esbuild takes it as tsconfigRaw,
// TS 6 converts it with convertCompilerOptionsFromJson (`lib` becomes file
// names). No imports: the Worker and Node (without a build step) import it.

export const TS_COMPILER_OPTIONS = {
  target: "ESNext",
  lib: ["ESNext", "DOM", "DOM.Iterable"],
  module: "ESNext",
  moduleResolution: "bundler",
  jsx: "react-jsx",
  strict: true,
  isolatedModules: true,
  skipLibCheck: true,
  noEmit: true,
  types: [],
} as const;
