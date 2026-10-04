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
    "✗ bad-md",
    "  bad-md/lesson.md: нет frontmatter между строками ---",
    "✓ greet",
    "✗ loop",
    "  loop/solution.ts: тесты не завершились за 5 с",
    "2 из 9 Lesson прошли",
    "",
  ]);
  expect(status).toBe(1);
  // The loop costs the Run's 5 s and nothing more.
  expect(Date.now() - started).toBeLessThan(60_000);
});

test("the Dependency Artifact fails: its errors, no Lesson lines, code 1", () => {
  const course = tsCourse();
  writeFiles(course, { "sum/solution.ts": 'import pad from "left-pad";\nexport const sum = (a: number, b: number) => pad(a + b);\n' });

  const { status, stdout, stderr } = runCodda(course, ["test"]);

  expect(report(stdout)).toBe("");
  expect(stderr).toMatch(/package\.json/);
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
