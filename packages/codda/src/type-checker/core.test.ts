import { beforeAll, expect, inject, test } from "vitest";
import ts from "typescript-6";
import { createTypeEnvironment, type TypeEnvironment } from "./core";

// The lib files as the page gets them (vite.config.ts) and types.json of the
// fixture Course's Dependency Artifact (react without @types: stubs `any`).
let lib: Record<string, string>;
let types: Record<string, string>;

beforeAll(async () => {
  lib = await fetch(new URL(__CODDA_TS_LIB__, document.baseURI)).then((r) => r.json());
  types = await fetch(new URL(inject("importMap").replace("importmap.json", "types.json"), location.href)).then((r) =>
    r.json(),
  );
});

const errorsOf = (file: string, text: string, env: TypeEnvironment = createTypeEnvironment(ts, { ...lib, ...types })) => {
  env.setFile(file, text);
  return env.errors(file);
};

test("an error has its 1-based line and column, its code and its range in the text", () => {
  const text = `const a = 1;
const b: string =
  a;
`;
  expect(errorsOf("main.ts", text)).toEqual([
    {
      from: text.indexOf("b:"),
      to: text.indexOf("b:") + 1,
      line: 2,
      column: 7,
      message: "Type 'number' is not assignable to type 'string'.",
      code: 2322,
    },
  ]);
});

test("the message is the whole chain of messageText, one line each", () => {
  const [error] = errorsOf("main.ts", `export const f: (a: string) => void = (a: number) => {};\n`);

  expect(error.message).toBe(
    [
      "Type '(a: number) => void' is not assignable to type '(a: string) => void'.",
      "  Types of parameters 'a' and 'a' are incompatible.",
      "    Type 'string' is not assignable to type 'number'.",
    ].join("\n"),
  );
});

test("a Starter main.ts without JSX checks: generic arrows and type assertions are TS, not JSX", () => {
  const text = `export const id = <T>(x: T) => x;
const value: unknown = 1;
export const n = <number>value;
`;
  expect(errorsOf("main.ts", text)).toEqual([]);
});

test("only errors: an unused variable, import or parameter is not one", () => {
  const text = `import { useState } from "react";
export function f(unused: number) {
  const nobody = 1;
}
`;
  expect(errorsOf("main.tsx", text)).toEqual([]);
});

test("a syntax error is an error with its TS code", () => {
  const [error] = errorsOf("main.ts", `export function add(a: number) {\n  return a +;\n}\n`);

  expect(error).toMatchObject({ line: 2, code: 1109, message: "Expression expected." });
});

test("a package without types gets `any` from its stub in types.json: default, named and namespace imports", () => {
  const text = `import React, { useState } from "react";
import * as ReactAll from "react";
import { createRoot } from "react-dom/client";
export const same = React.useState === useState && ReactAll.anything;
createRoot(document.body).render(null);
`;
  expect(errorsOf("main.tsx", text)).toEqual([]);
});

test("ESNext and the DOM: toSorted and Object.groupBy are known", () => {
  const text = `export const sorted = [3, 1, 2].toSorted();
export const groups = Object.groupBy([1, 2], (n) => (n % 2 ? "odd" : "even"));
export const title = document.title;
`;
  expect(errorsOf("main.ts", text)).toEqual([]);
});

test("without types.json, lib files only: an error in the code is still found", () => {
  const env = createTypeEnvironment(ts, lib);

  expect(errorsOf("main.ts", `export const n: number = "1";\n`, env)).toMatchObject([{ code: 2322 }]);
});

test("the file is replaced on each call: a fix removes the error", () => {
  const env = createTypeEnvironment(ts, { ...lib, ...types });
  errorsOf("main.ts", `export const n: number = "1";\n`, env);

  expect(errorsOf("main.ts", `export const n: number = 1;\n`, env)).toEqual([]);
});

test("another Starter's extension drops the old file: its globals do not clash with the new one's", () => {
  const env = createTypeEnvironment(ts, lib);
  // Scripts, not modules: their top-level names are global to the program.
  errorsOf("main.tsx", `const count = 1;\n`, env);

  expect(errorsOf("main.ts", `const count = 2;\n`, env)).toEqual([]);
  // And back: the first name is a new file again.
  expect(errorsOf("main.tsx", `const count = 3;\nexport const n: number = "";\n`, env)).toMatchObject([{ code: 2322 }]);
});
