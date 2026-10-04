import { test, expect } from "@codda/test";
import { sum } from "./main";

test("складывает два числа", () => {
  expect(sum(2, 3)).toBe(5);
});

test("ноль плюс ноль — ноль", () => {
  expect(sum(0, 0)).toBe(0);
});
