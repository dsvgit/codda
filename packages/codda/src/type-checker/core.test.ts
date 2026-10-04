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

/** Completions where `|` stands in `text` (the marker is taken out). */
function completionsAt(file: string, text: string, env = createTypeEnvironment(ts, { ...lib, ...types })) {
  const pos = text.indexOf("|");
  env.setFile(file, text.replace("|", ""));
  return env.completions(file, pos);
}

const typeOf = (items: { label: string; type?: string }[], label: string) => {
  const found = items.filter((item) => item.label === label);
  expect(found, label).toHaveLength(1);
  return found[0].type;
};

const DECLARATIONS = `const values = [1];
let count = 0;
function add() {}
class Box {}
interface Shape {}
type Id = string;
namespace Space { export const x = 1; }
`;

test("completions: the TS kind becomes the CodeMirror type — function, variable, keyword, class; an unknown kind (a namespace) gives none", () => {
  const { items } = completionsAt("main.ts", `${DECLARATIONS}|`);

  expect(typeOf(items, "add")).toBe("function");
  expect(typeOf(items, "values")).toBe("variable");
  expect(typeOf(items, "count")).toBe("variable");
  expect(typeOf(items, "if")).toBe("keyword");
  expect(typeOf(items, "Box")).toBe("class");
  expect(typeOf(items, "Space")).toBeUndefined();
});

test("completions: an interface and a type alias are types", () => {
  const { items } = completionsAt("main.ts", `${DECLARATIONS}let x: |`);

  expect(typeOf(items, "Shape")).toBe("interface");
  expect(typeOf(items, "Id")).toBe("type");
});

test("completions after `.`: members of the object — method and property with a short signature; ESNext's toSorted", () => {
  const text = `const items = [3, 1];\nitems.|`;
  const { from, to, items } = completionsAt("main.ts", text);

  expect(typeOf(items, "map")).toBe("method");
  expect(typeOf(items, "length")).toBe("property");
  expect(typeOf(items, "toSorted")).toBe("method");
  expect(items.find((item) => item.label === "length")?.detail).toBe("Array<number>.length: number");
  expect([from, to]).toEqual([text.indexOf("|"), text.indexOf("|")]);
});

test("completions: the range is the typed prefix; the detail is the signature's first line, without the kind in parentheses", () => {
  const text = `function addNumbers(a: number, b: number) {\n  return a + b;\n}\nexport const sum = addNu|;`;
  const { from, to, items } = completionsAt("main.ts", text);

  expect([from, to]).toEqual([text.indexOf("addNu|"), text.indexOf("|")]);
  expect(items.find((item) => item.label === "addNumbers")).toEqual({
    label: "addNumbers",
    type: "function",
    detail: "function addNumbers(a: number, b: number): number",
  });
});

test("completions: an imported name has the type of what it names, not «alias»", () => {
  const env = createTypeEnvironment(ts, { ...lib, "/lib.ts": "export function add(a: number) { return a; }\n" });
  const { items } = completionsAt("main.ts", `import { add } from "./lib";\nadd|`, env);

  expect(items.find((item) => item.label === "add")).toMatchObject({ type: "function", detail: "function add(a: number): number" });
});

test("completions: no auto-import — exports of a module not imported are not offered", () => {
  const env = createTypeEnvironment(ts, { ...lib, "/lib.ts": "export function addNumbers(a: number) { return a; }\n" });
  const { items } = completionsAt("main.ts", `export const f = addNu|`, env);

  expect(items.map((item) => item.label)).not.toContain("addNumbers");
});

test("completions: none inside a string, a template's text or a comment", () => {
  // A string TS would complete: the tag names of querySelector.
  expect(completionsAt("main.ts", `document.querySelector("di|");`).items).toEqual([]);
  expect(completionsAt("main.ts", `const tag = "di|";`).items).toEqual([]);
  expect(completionsAt("main.ts", "const t = `con|`;").items).toEqual([]);
  expect(completionsAt("main.ts", `// con|\n`).items).toEqual([]);
  expect(completionsAt("main.ts", `/* con| */\n`).items).toEqual([]);
  expect(completionsAt("main.ts", `/** @par| */\nfunction f(a: number) {}\n`).items).toEqual([]);
  // A template's substitution is code.
  expect(completionsAt("main.ts", "const t = `${docu|}`;").items.map((item) => item.label)).toContain("document");
});
