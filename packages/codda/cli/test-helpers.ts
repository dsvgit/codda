// Shared by the CLI's own tests: a small `.ts` Course without dependencies in
// a temporary folder, a stand-in for the built UI, and the CLI run as a
// process the way an Author runs it.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { UI_HASH_FILE, uiSourceHash } from "./ui-build.ts";

const cli = fileURLToPath(new URL("codda.ts", import.meta.url));

export function writeFiles(root: string, files: Record<string, string>) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
}

/**
 * A stand-in for the tool's built UI (`dist-tool/`) in `dir`, marked as built
 * from the current sources, so `codda` does not rebuild it. `npm test` runs
 * before `npm run build` in CI.
 */
export function fakeUi(dir: string, hash = uiSourceHash()) {
  writeFiles(dir, { "index.html": "<!doctype html><title>codda</title>", "assets/app.js": "app", [UI_HASH_FILE]: hash });
}

/**
 * Copies the fixture Course into a new temporary folder and returns its path:
 * Lessons `sum` and `greet` on plain `.ts`, no package.json, no dependencies.
 * Each Solution passes its Lesson Tests, each Starter fails one.
 */
export function tsCourse(): string {
  const dir = join(mkdtempSync(join(tmpdir(), "codda-course-")), "course");
  writeFiles(dir, {
    "course.yaml": "id: demo\ntitle: Демо\nmodules:\n  - title: Основы\n    lessons: [sum, greet]\n",
    "sum/lesson.md": "---\ntitle: Сумма\n---\nНапишите `sum(a, b)`.\n",
    "sum/main.ts": "export function sum(a: number, b: number): number {\n  return 0;\n}\n",
    "sum/solution.ts": "export function sum(a: number, b: number): number {\n  return a + b;\n}\n",
    "sum/lesson.test.ts":
      'import { test, expect } from "@codda/test";\nimport { sum } from "./main";\n\ntest("складывает", () => {\n  expect(sum(1, 2)).toBe(3);\n});\n',
    "greet/lesson.md": "---\ntitle: Приветствие\n---\nНапишите `greet(name)`.\n",
    "greet/main.ts": 'export function greet(name: string): string {\n  return "";\n}\n',
    "greet/solution.ts": "export function greet(name: string): string {\n  return `Привет, ${name}!`;\n}\n",
    "greet/lesson.test.ts":
      'import { test, expect } from "@codda/test";\nimport { greet } from "./main";\n\ntest("здоровается", () => {\n  expect(greet("Аня")).toBe("Привет, Аня!");\n});\n',
  });
  return dir;
}

/** Runs `codda <args>` in `cwd` as a process. */
export function runCodda(cwd: string, args: string[], env: Record<string, string> = {}) {
  const { status, stdout, stderr } = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { status, stdout, stderr };
}
