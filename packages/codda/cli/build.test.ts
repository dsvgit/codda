// `codda build` as an Author calls it: a process on a Course folder the test
// writes itself. CODDA_UI_DIR points the CLI at a stand-in for the built UI,
// because `npm test` runs before `npm run build` in CI.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, expect, test } from "vitest";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const reactHooks = join(repoRoot, "courses/react-hooks");

let tmp: string;
let ui: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "codda-build-"));
  ui = join(tmp, "ui");
  writeFiles(ui, { "index.html": "<!doctype html><title>codda</title>", "assets/app.js": "app" });
});

function writeFiles(root: string, files: Record<string, string>) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
}

function codda(args: string[], env: Record<string, string> = { CODDA_UI_DIR: ui }) {
  const { status, stdout, stderr } = spawnSync("npx", ["codda", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { status, stdout, stderr };
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** A valid two-Lesson Course: one Lesson on .ts, one on .tsx, listed in non-alphabetical order. */
function writeCourse(dir: string) {
  writeFiles(dir, {
    "course.yaml": `id: demo
title: Демо
modules:
  - title: Первый
    lessons: [zeta]
  - title: Второй
    lessons:
      - alpha
`,
    "zeta/lesson.md": "---\ntitle: Зета\n---\n\nСложите **числа**.\n",
    "zeta/main.ts": "export const sum = 0;\n",
    "zeta/solution.ts": "export const sum = 1 + 2;\n",
    "zeta/lesson.test.ts": 'import { sum } from "./main";\n',
    "alpha/lesson.md": "---\ntitle: Альфа\n---\nКнопка.\n",
    "alpha/main.tsx": "export const App = () => <button />;\n",
    "alpha/solution.tsx": "export const App = () => <button>ok</button>;\n",
    "alpha/lesson.test.tsx": 'import { App } from "./main";\n',
  });
}

test("builds the UI, course.json and deps/ into <path>/dist", () => {
  const course = join(tmp, "course");
  writeCourse(course);

  const { status, stderr } = codda(["build", course]);

  expect(stderr).toBe("");
  expect(status).toBe(0);
  const out = join(course, "dist");
  expect(readFileSync(join(out, "index.html"), "utf8")).toBe("<!doctype html><title>codda</title>");
  expect(readFileSync(join(out, "assets/app.js"), "utf8")).toBe("app");
  expect(existsSync(join(out, "deps/manifest.json"))).toBe(true);
  expect(readJson(join(out, "course.json"))).toEqual({
    id: "demo",
    title: "Демо",
    modules: [
      {
        title: "Первый",
        lessons: [
          {
            id: "zeta",
            title: "Зета",
            instructions: "Сложите **числа**.\n",
            workspace: { name: "main.ts", starter: "export const sum = 0;\n" },
            solution: "export const sum = 1 + 2;\n",
            tests: 'import { sum } from "./main";\n',
          },
        ],
      },
      {
        title: "Второй",
        lessons: [
          {
            id: "alpha",
            title: "Альфа",
            instructions: "Кнопка.\n",
            workspace: { name: "main.tsx", starter: "export const App = () => <button />;\n" },
            solution: "export const App = () => <button>ok</button>;\n",
            tests: 'import { App } from "./main";\n',
          },
        ],
      },
    ],
  });
});

test("--out builds into another folder", () => {
  const course = join(tmp, "course");
  writeCourse(course);
  const out = join(tmp, "site");

  const { status } = codda(["build", course, "--out", out]);

  expect(status).toBe(0);
  expect(existsSync(join(out, "index.html"))).toBe(true);
  expect(readJson(join(out, "course.json")).id).toBe("demo");
  expect(existsSync(join(course, "dist"))).toBe(false);
});

test("without course.yaml at the path: one line, exit 2, nothing created", () => {
  const empty = join(tmp, "empty");
  mkdirSync(empty);

  const { status, stdout, stderr } = codda(["build", empty]);

  expect(status).toBe(2);
  expect(stdout).toBe("");
  expect(stderr).toContain(`нет course.yaml в ${empty}`);
  expect(existsSync(join(empty, "dist"))).toBe(false);
});

test("without a path: exit 2", () => {
  const { status, stderr } = codda(["build"]);

  expect(status).toBe(2);
  expect(stderr).toContain("не указан путь к курсу");
});

test("without the built UI: a hint to run `npm run build`, exit 2, nothing created", () => {
  const course = join(tmp, "course");
  writeCourse(course);

  const { status, stderr } = codda(["build", course], { CODDA_UI_DIR: join(tmp, "missing") });

  expect(status).toBe(2);
  expect(stderr).toContain("npm run build");
  expect(existsSync(join(course, "dist"))).toBe(false);
});

test.each([["--bogus"], ["--out"]])("`build` with bad flags %s exits 2", (...flags) => {
  const course = join(tmp, "course");
  writeCourse(course);

  const { status } = codda(["build", course, ...flags]);

  expect(status).toBe(2);
  expect(existsSync(join(course, "dist"))).toBe(false);
});

test("an invalid Course: `<file>: <path>: <message>` in stderr, exit 1, no --out", () => {
  const course = join(tmp, "course");
  writeCourse(course);
  writeFiles(course, { "course.yaml": "id: demo\nmodules:\n  - title: Первый\n    lessons: [zeta, alpha]\n" });
  const out = join(tmp, "site");

  const { status, stdout, stderr } = codda(["build", course, "--out", out]);

  expect(status).toBe(1);
  expect(stdout).toBe("");
  expect(stderr).toMatch(/^course\.yaml: title: .+\n$/);
  expect(existsSync(out)).toBe(false);
});

test("`codda build courses/react-hooks` takes the five Lessons from the Course files", () => {
  const out = join(tmp, "react-hooks");

  const { status } = codda(["build", "courses/react-hooks", "--out", out]);

  expect(status).toBe(0);
  const course = readJson(join(out, "course.json"));
  expect(course.id).toBe("react-hooks");
  const lessons = course.modules.flatMap((m: { lessons: unknown[] }) => m.lessons);
  expect(lessons.map((l: { id: string }) => l.id)).toEqual([
    "use-state",
    "use-effect",
    "use-ref",
    "use-reducer",
    "use-context",
  ]);
  for (const lesson of lessons) {
    const dir = join(reactHooks, lesson.id);
    expect(lesson.workspace).toEqual({ name: "main.tsx", starter: readFileSync(join(dir, "main.tsx"), "utf8") });
    expect(lesson.solution).toBe(readFileSync(join(dir, "solution.tsx"), "utf8"));
    expect(lesson.tests).toBe(readFileSync(join(dir, "lesson.test.tsx"), "utf8"));
  }
  expect(lessons[0].title).toBe("useState");
});
