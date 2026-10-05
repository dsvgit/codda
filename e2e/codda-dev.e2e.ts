// `codda dev` in a browser: the page of a Lesson with manifest errors, and the
// page reloading itself after the file is fixed. The test starts the CLI as a
// process on a `.ts` Course it writes itself, on a free port.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "./offline";

const cli = fileURLToPath(new URL("../packages/codda/cli/codda.ts", import.meta.url));

function writeFiles(root: string, files: Record<string, string>) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
}

test("a Lesson with manifest errors shows its errors; after the fix the page reloads into the Lesson", async ({ page }) => {
  const course = join(mkdtempSync(join(tmpdir(), "codda-e2e-")), "course");
  writeFiles(course, {
    "course.yaml": "id: demo\ntitle: Демо\nmodules:\n  - title: Основы\n    lessons: [sum]\n",
    "sum/lesson.md": "Нет frontmatter.\n",
    "sum/main.ts": "export function sum(a: number, b: number): number {\n  return 0;\n}\n",
    "sum/solution.ts": "export function sum(a: number, b: number): number {\n  return a + b;\n}\n",
    "sum/lesson.test.ts":
      'import { test, expect } from "@codda/test";\nimport { sum } from "./main";\n\ntest("складывает", () => {\n  expect(sum(1, 2)).toBe(3);\n});\n',
  });
  const dev = spawn(process.execPath, [cli, "dev", "--port", "0"], { cwd: course });
  try {
    const url = await new Promise<string>((resolve, reject) => {
      let out = "";
      dev.stdout.setEncoding("utf8").on("data", (chunk) => {
        out += chunk;
        const found = /http:\/\/127\.0\.0\.1:\d+\//.exec(out)?.[0];
        if (found) resolve(found);
      });
      dev.on("exit", (code) => reject(new Error(`codda dev exited with ${code}: ${out}`)));
    });

    await page.goto(`${url}#/sum`);
    await expect(page.getByRole("heading", { name: "Ошибки в Lesson sum" })).toBeVisible();
    await expect(page.getByText("sum/lesson.md: нет frontmatter между строками ---")).toBeVisible();

    writeFiles(course, { "sum/lesson.md": "---\ntitle: Сумма\n---\nНапишите `sum(a, b)`.\n" });

    await expect(page.getByRole("heading", { name: "Демо · Сумма" })).toBeVisible();
  } finally {
    dev.kill("SIGINT");
  }
});
