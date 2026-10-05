// `codda test` as an Author calls it: a process on a `.ts` Course the test
// writes itself, Runs in full Chromium. The CLI uses the tool's real built UI
// (dist-tool/) and builds it first if it is missing or stale. Each process
// checks many Lessons at once: every Chromium start costs seconds.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { runCodda, tsCourse, writeFiles } from "./test-helpers.ts";

const LONG = { timeout: 240_000 };

/** stdout without the UI build line, which shows only when dist-tool/ is stale. */
const report = (stdout: string) => stdout.replace("Собираю UI codda…\n", "");

test("every Lesson passes: ✓ per Lesson in course.yaml order, summary, code 0", LONG, () => {
  const course = tsCourse();

  const { status, stdout, stderr } = runCodda(course, ["test"]);

  expect(stderr).toBe("");
  expect(report(stdout)).toBe("Зависимости: нет\n✓ sum\n✓ greet\n2 из 2 Lesson прошли\n");
  expect(status).toBe(0);
});

test("broken Lessons: ✗ with the errors under it, the rest are still checked, code 1", LONG, () => {
  const course = tsCourse();
  const lesson = (title: string) => `---\ntitle: ${title}\n---\nЗадание.\n`;
  const sumTest = 'import { test, expect } from "@codda/test";\nimport { sum } from "./main";\n\ntest("складывает", () => {\n  expect(sum(1, 2)).toBe(3);\n});\n';
  const good = "export function sum(a: number, b: number): number {\n  return a + b;\n}\n";
  const bad = "export function sum(a: number, b: number): number {\n  return 0;\n}\n";
  writeFiles(course, {
    // The infinite loop goes last: the Run after one is flaky (README, «Отложенные проблемы»).
    "course.yaml":
      "id: demo\ntitle: Демо\nmodules:\n  - title: Основы\n    lessons: [sum, failing, no-tests, solved, throws]\n" +
      "  - title: Ещё\n    lessons: [broken, bad-md, greet, loop]\n",
    ...Object.fromEntries(
      ["failing", "no-tests", "solved", "throws", "broken", "bad-md", "loop"].map((id) => [`${id}/lesson.md`, lesson(id)]),
    ),
    "failing/main.ts": bad,
    "failing/solution.ts": bad,
    "failing/lesson.test.ts": sumTest,
    "no-tests/main.ts": bad,
    "no-tests/solution.ts": good,
    "no-tests/lesson.test.ts": 'import { sum } from "./main";\n',
    "solved/main.ts": good,
    "solved/solution.ts": good,
    "solved/lesson.test.ts": sumTest,
    "throws/main.ts": 'throw new Error("boom");\n',
    "throws/solution.ts": good,
    "throws/lesson.test.ts": sumTest,
    "broken/main.ts": "export function sum(a: number, b: number): number {\n  return a +;\n}\n",
    "broken/solution.ts": good,
    "broken/lesson.test.ts": sumTest,
    "bad-md/lesson.md": "Нет frontmatter.\n",
    "bad-md/main.ts": bad,
    "bad-md/solution.ts": good,
    "bad-md/lesson.test.ts": sumTest,
    "loop/main.ts": bad,
    "loop/solution.ts": "export function sum(a: number, b: number): number {\n  while (true) {}\n}\n",
    "loop/lesson.test.ts": sumTest,
  });

  const started = Date.now();
  const { status, stdout, stderr } = runCodda(course, ["test"]);

  expect(stderr).toBe("");
  const lines = report(stdout).split("\n");
  expect(lines.slice(0, 11)).toEqual([
    "Зависимости: нет",
    "✓ sum",
    "✗ failing",
    "  failing/solution.ts: тест «складывает» не прошёл: expected 3, got 0",
    "✗ no-tests",
    "  no-tests/solution.ts: в Lesson Tests нет ни одного теста",
    "✗ solved",
    "  solved/main.ts: Starter уже проходит все тесты",
    "✗ throws",
    "  throws/main.ts: ошибка при выполнении: boom",
    "✗ broken",
  ]);
  expect(lines[11]).toMatch(/^ {2}broken\/main\.ts: строка 2: ошибка компиляции: .+/);
  expect(lines.slice(12)).toEqual([
    // The Starter's syntax error is also a type error: a warning under the Run's error.
    "  broken/main.ts:2:13 — Expression expected. (TS1109)",
    "✗ bad-md",
    "  bad-md/lesson.md: нет frontmatter между строками ---",
    "✓ greet",
    "✗ loop",
    "  loop/solution.ts: тесты не завершились за 5 с",
    "2 из 9 Lesson прошли, 1 предупреждение",
    "",
  ]);
  expect(status).toBe(1);
  // The loop costs the Run's 5 s and nothing more.
  expect(Date.now() - started).toBeLessThan(60_000);
});

const SUM_TEST = 'import { test, expect } from "@codda/test";\nimport { sum } from "./main";\n\ntest("складывает", () => {\n  expect(sum(1, 2)).toBe(3);\n});\n';
const GOOD_SUM = "export function sum(a: number, b: number): number {\n  return a + b;\n}\n";
const BAD_SUM = "export function sum(a: number, b: number): number {\n  return 0;\n}\n";
const STRING_SUM = 'export function sum(a: number, b: number): number {\n  return "0";\n}\n';
const lessonMd = (title: string) => `---\ntitle: ${title}\n---\nЗадание.\n`;

test("type errors in Solution or Lesson Tests are errors (✗), in Starter warnings; Run errors and type errors at once; code 1", LONG, () => {
  const course = tsCourse();
  writeFiles(course, {
    "course.yaml": "id: demo\ntitle: Демо\nmodules:\n  - title: Основы\n    lessons: [sum, greet, sol-type, tests-type, both, bad-md]\n",
    ...Object.fromEntries(["sol-type", "tests-type", "both"].map((id) => [`${id}/lesson.md`, lessonMd(id)])),
    // Passes its tests, but is not well typed.
    "sol-type/main.ts": BAD_SUM,
    "sol-type/solution.ts": "export function sum(a: number, b: number): number {\n  const total: string = a + b;\n  return a + b;\n}\n",
    "sol-type/lesson.test.ts": SUM_TEST,
    "tests-type/main.ts": BAD_SUM,
    "tests-type/solution.ts": GOOD_SUM,
    "tests-type/lesson.test.ts":
      'import { test, expect } from "@codda/test";\nimport { sum } from "./main";\n\ntest("складывает", () => {\n  const three: string = sum(1, 2);\n  expect(Number(three)).toBe(3);\n});\n',
    // The Solution fails its tests (no Starter Run), and all three kinds of lines show.
    "both/main.ts": STRING_SUM,
    "both/solution.ts": "export function sum(a: number, b: number): number {\n  return a - b + c;\n}\n",
    "both/lesson.test.ts": SUM_TEST,
    // A manifest error: no type check of its files.
    "bad-md/lesson.md": "Нет frontmatter.\n",
    "bad-md/main.ts": STRING_SUM,
    "bad-md/solution.ts": STRING_SUM,
    "bad-md/lesson.test.ts": SUM_TEST,
  });

  const { status, stdout, stderr } = runCodda(course, ["test"]);

  expect(stderr).toBe("");
  expect(report(stdout)).toBe(
    [
      "Зависимости: нет",
      "✓ sum",
      "✓ greet",
      "✗ sol-type",
      "  sol-type/solution.ts:2:9 — Type 'number' is not assignable to type 'string'. (TS2322)",
      "✗ tests-type",
      "  tests-type/lesson.test.ts:5:9 — Type 'number' is not assignable to type 'string'. (TS2322)",
      "✗ both",
      "  both/solution.ts: тест «складывает» не прошёл: c is not defined",
      "  both/solution.ts:2:18 — Cannot find name 'c'. (TS2304)",
      "  both/main.ts:2:3 — Type 'string' is not assignable to type 'number'. (TS2322)",
      "✗ bad-md",
      "  bad-md/lesson.md: нет frontmatter между строками ---",
      "2 из 6 Lesson прошли, 1 предупреждение",
      "",
    ].join("\n"),
  );
  expect(status).toBe(1);
});

test("a type error only in Starter: ⚠ with its line, code 0; an unused variable is no warning", LONG, () => {
  const course = tsCourse();
  writeFiles(course, {
    "course.yaml": "id: demo\ntitle: Демо\nmodules:\n  - title: Основы\n    lessons: [sum, greet, starter-type, unused]\n",
    "starter-type/lesson.md": lessonMd("Starter"),
    "starter-type/main.ts": STRING_SUM,
    "starter-type/solution.ts": GOOD_SUM,
    "starter-type/lesson.test.ts": SUM_TEST,
    "unused/lesson.md": lessonMd("Unused"),
    "unused/main.ts": "export function sum(a: number, b: number): number {\n  const unused = 1;\n  return 0;\n}\n",
    "unused/solution.ts": GOOD_SUM,
    "unused/lesson.test.ts": SUM_TEST,
  });

  const { status, stdout, stderr } = runCodda(course, ["test"]);

  expect(stderr).toBe("");
  expect(report(stdout)).toBe(
    "Зависимости: нет\n✓ sum\n✓ greet\n⚠ starter-type\n" +
      "  starter-type/main.ts:2:3 — Type 'string' is not assignable to type 'number'. (TS2322)\n" +
      "✓ unused\n4 из 4 Lesson прошли, 1 предупреждение\n",
  );
  expect(status).toBe(0);
});

test("a package without types is `any` in the type check, not a type error", LONG, () => {
  const course = tsCourse();
  const lock = {
    name: "demo",
    lockfileVersion: 3,
    requires: true,
    packages: { "": { name: "demo", dependencies: { "plain-pkg": "1.0.0" } }, "node_modules/plain-pkg": { version: "1.0.0" } },
  };
  writeFiles(course, {
    "package.json": JSON.stringify({ name: "demo", dependencies: { "plain-pkg": "1.0.0" } }),
    "package-lock.json": JSON.stringify(lock),
    "node_modules/.package-lock.json": JSON.stringify(lock),
    "node_modules/plain-pkg/package.json": JSON.stringify({ name: "plain-pkg", version: "1.0.0", main: "index.js" }),
    "node_modules/plain-pkg/index.js": "exports.zero = 0;\n",
    "sum/main.ts": 'import { zero } from "plain-pkg";\nexport function sum(a: number, b: number): number {\n  return zero.whatever ?? 0;\n}\n',
    "sum/solution.ts": 'import { zero } from "plain-pkg";\nexport function sum(a: number, b: number): number {\n  return a + b + zero;\n}\n',
  });

  const { status, stdout, stderr } = runCodda(course, ["test"]);

  expect(stderr).toMatch(/^у пакета `plain-pkg` нет типов/);
  expect(report(stdout)).toMatch(/^Зависимости: deps\/\S+ — .+\n✓ sum\n✓ greet\n2 из 2 Lesson прошли, 1 предупреждение\n$/);
  expect(status).toBe(0);
});

test("the Dependency Artifact fails: its errors, no Lesson lines, code 1", () => {
  const course = tsCourse();
  writeFiles(course, {
    "sum/solution.ts": 'import pad from "left-pad";\nexport const sum = (a: number, b: number) => pad(a + b);\n',
    "greet/solution.ts": "export const greet = (name: string): number => name;\n",
  });

  const { status, stdout, stderr } = runCodda(course, ["test"]);

  // No type check without the artifact: no TS errors anywhere.
  expect(report(stdout)).toBe("");
  expect(stderr).toMatch(/package\.json/);
  expect(stderr).not.toMatch(/TS\d+/);
  expect(status).toBe(1);
});

test("course.yaml itself is invalid: all its errors, no Lesson lines, code 1", () => {
  const course = tsCourse();
  writeFiles(course, { "course.yaml": "id: Demo\nmodules: []\n" });

  const { status, stdout, stderr } = runCodda(course, ["test"]);

  expect(report(stdout)).toBe("");
  expect(stderr).toBe(
    "course.yaml: id: ожидается kebab-case, например use-state\ncourse.yaml: title: обязательное поле\ncourse.yaml: modules: список не может быть пустым\n",
  );
  expect(status).toBe(1);
});

test("a Lesson path checks only that Lesson; errors of other Lessons are not printed; no colour off a TTY", LONG, () => {
  const course = tsCourse();
  writeFiles(course, {
    "course.yaml": "id: demo\ntitle: Демо\nmodules:\n  - title: Основы\n    lessons: [sum, greet, bad-md]\n",
    "bad-md/lesson.md": "Нет frontmatter.\n",
    // Another Lesson's type error is not checked either.
    "greet/solution.ts": "export function greet(name: string): number {\n  return name;\n}\n",
  });

  const { status, stdout, stderr } = runCodda(course, ["test", "sum"]);

  expect(stderr).toBe("");
  expect(report(stdout)).toBe("Зависимости: нет\n✓ sum\n1 из 1 Lesson прошли\n");
  expect(stdout).not.toContain("\x1b[");
  expect(status).toBe(0);
});

test("from a Lesson folder: only that Lesson, course.yaml errors printed, a foreign request is its error", LONG, () => {
  const course = tsCourse();
  writeFiles(course, {
    "course.yaml": "id: demo\ntitle: Демо\nmodules:\n  - title: Основы\n    lessons: [sum, fetches, bad-md, bad-md]\n",
    "bad-md/lesson.md": "Нет frontmatter.\n",
    "fetches/lesson.md": "---\ntitle: Сеть\n---\nЗадание.\n",
    "fetches/main.ts": "export async function sum(a: number, b: number): Promise<number> {\n  return 0;\n}\n",
    "fetches/solution.ts":
      // Awaited: a request still in flight when the Run ends may go unseen
      // (.scratch/mvp-autorun/README.md, «Отложенные проблемы»).
      'export async function sum(a: number, b: number): Promise<number> {\n  await fetch("https://example.com/").catch(() => {});\n  return a + b;\n}\n',
    "fetches/lesson.test.ts":
      'import { test, expect } from "@codda/test";\nimport { sum } from "./main";\n\ntest("складывает", async () => {\n  expect(await sum(1, 2)).toBe(3);\n});\n',
  });

  const { status, stdout, stderr } = runCodda(join(course, "fetches"), ["test"]);

  expect(stderr).toBe("");
  expect(report(stdout)).toBe(
    "course.yaml: modules[0].lessons[3]: урок bad-md уже указан в modules[0].lessons[2]\n" +
      "Зависимости: нет\n" +
      "✗ fetches\n" +
      "  fetches/solution.ts: запрос на чужой адрес: https://example.com/\n" +
      "0 из 1 Lesson прошли\n",
  );
  expect(status).toBe(1);
});

test("a folder inside the Course that course.yaml does not list: a manifest error, code 1", () => {
  const course = tsCourse();
  writeFiles(course, { "extra/main.ts": "export {};\n" });

  const { status, stdout, stderr } = runCodda(course, ["test", "extra"]);

  expect(report(stdout)).toBe("");
  expect(stderr).toBe("extra/: урок extra не указан в course.yaml\n");
  expect(status).toBe(1);
});

test("no Chromium: one line with the install command, code 2, no stack", LONG, () => {
  const course = tsCourse();
  const empty = mkdtempSync(join(tmpdir(), "codda-no-browsers-"));

  const { status, stderr } = runCodda(course, ["test", "sum"], { PLAYWRIGHT_BROWSERS_PATH: empty });

  expect(stderr).toBe(
    "Chromium не найден. Установите: npx playwright install chromium (зеркало — PLAYWRIGHT_DOWNLOAD_HOST)\n",
  );
  expect(status).toBe(2);
});
