export const lesson = {
  title: "TypeScript: add",
  instructions:
    "Реализуйте функцию add(a, b), которая возвращает сумму двух чисел.",
  starter: `export function add(a: number, b: number) {
  return a - b;
}
`,
  tests: `import { test, expect } from "@codda/test";
import { add } from "./App";

test("adds two positive numbers", () => {
  expect(add(2, 3)).toBe(5);
});

test("adds a negative number", () => {
  expect(add(-1, 1)).toBe(0);
});
`,
};
