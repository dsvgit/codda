// `codda build` as an Author calls it: a process on a Course folder the test
// writes itself. CODDA_UI_DIR points the CLI at a stand-in for the built UI,
// because `npm test` runs before `npm run build` in CI.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, test } from "vitest";
import { fakeUi, runCodda, tsCourse, writeFiles } from "./test-helpers.ts";
import { UI_HASH_FILE } from "./ui-build.ts";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const reactHooks = join(repoRoot, "courses/react-hooks");

let tmp: string;
let ui: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "codda-build-"));
  ui = join(tmp, "ui");
  fakeUi(ui);
});

function codda(args: string[], env: Record<string, string> = { CODDA_UI_DIR: ui }, cwd = repoRoot) {
  return runCodda(cwd, args, env);
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Every file under `dir`, as paths relative to it, sorted. */
function filesOf(dir: string): string[] {
  return (readdirSync(dir, { recursive: true, withFileTypes: true }) as import("node:fs").Dirent[])
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .sort();
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
    "alpha/main.tsx": "export const App = () => null;\n",
    "alpha/solution.tsx": 'export const App = () => "ok";\n',
    "alpha/lesson.test.tsx": 'import { App } from "./main";\n',
  });
}

test("builds the UI and course.json into <path>/dist; no package imports, no deps/", () => {
  const course = join(tmp, "course");
  writeCourse(course);

  const { status, stderr } = codda(["build", course]);

  expect(stderr).toBe("");
  expect(status).toBe(0);
  const out = join(course, "dist");
  expect(readFileSync(join(out, "index.html"), "utf8")).toBe("<!doctype html><title>codda</title>");
  expect(readFileSync(join(out, "assets/app.js"), "utf8")).toBe("app");
  expect(existsSync(join(out, "deps"))).toBe(false);
  expect(readJson(join(out, "course.json"))).toEqual({
    id: "demo",
    title: "Демо",
    deps: null,
    modules: [
      {
        title: "Первый",
        lessons: [
          {
            id: "zeta",
            title: "Зета",
            instructions: "<p>Сложите <strong>числа</strong>.</p>\n",
            workspace: { name: "main.ts", starter: "export const sum = 0;\n" },
            solution: "export const sum = 1 + 2;\n",
            tests: 'import { sum } from "./main";\n',
            testsName: "lesson.test.ts",
          },
        ],
      },
      {
        title: "Второй",
        lessons: [
          {
            id: "alpha",
            title: "Альфа",
            instructions: "<p>Кнопка.</p>\n",
            workspace: { name: "main.tsx", starter: "export const App = () => null;\n" },
            solution: 'export const App = () => "ok";\n',
            tests: 'import { App } from "./main";\n',
            testsName: "lesson.test.tsx",
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

test("without course.yaml at the path or above it: «здесь нет курса», exit 2, nothing created", () => {
  const empty = join(tmp, "empty");
  mkdirSync(empty);

  const withPath = codda(["build", empty]);
  const withoutPath = codda(["build"], { CODDA_UI_DIR: ui }, empty);

  // Without a path the CLI names its current folder, with symlinks resolved (/tmp on macOS).
  for (const [{ status, stdout, stderr }, path] of [[withPath, empty], [withoutPath, realpathSync(empty)]] as const) {
    expect(status).toBe(2);
    expect(stdout).toBe("");
    expect(stderr).toBe(`codda: здесь нет курса: ${path} (справка: codda --help)\n`);
  }
  expect(readdirSync(empty)).toEqual([]);
});

describe("author-cli/01: the whole `codda build`", () => {
  /** The build's file list in stdout: one path per line, then the summary line. */
  function listed(stdout: string) {
    const lines = stdout.split("\n").slice(0, -1);
    return { files: lines.slice(0, -1).sort(), summary: lines.at(-1) };
  }

  test("without a path, from the Course root: <course>/dist with the marker, files listed, a summary", () => {
    const course = tsCourse();

    const { status, stdout, stderr } = codda(["build"], { CODDA_UI_DIR: ui }, course);

    expect(stderr).toBe("");
    expect(status).toBe(0);
    const out = join(realpathSync(course), "dist");
    expect(filesOf(out)).toEqual([".codda-build", "assets/app.js", "course.json", "index.html"]);
    expect(listed(stdout)).toEqual({
      files: [".codda-build", "assets/app.js", "course.json", "index.html"],
      summary: `Курс собран в ${out}, файлов: 4`,
    });
    expect(readJson(join(out, "course.json")).modules[0].lessons.map((l: { id: string }) => l.id)).toEqual(["sum", "greet"]);
    // The temporary build folder inside .codda/ is gone.
    expect(readdirSync(join(course, ".codda"))).toEqual([]);
  });

  test("from a Lesson folder: the same Course, into <course>/dist", () => {
    const course = tsCourse();

    const { status } = codda(["build"], { CODDA_UI_DIR: ui }, join(course, "greet"));

    expect(status).toBe(0);
    expect(filesOf(join(course, "dist"))).toEqual([".codda-build", "assets/app.js", "course.json", "index.html"]);
    expect(existsSync(join(course, "greet", "dist"))).toBe(false);
  });

  test("--out: a new folder, relative to the current one; an existing empty folder", () => {
    const course = tsCourse();

    expect(codda(["build", "--out", "../site"], { CODDA_UI_DIR: ui }, course).status).toBe(0);
    expect(filesOf(join(course, "../site"))).toContain("course.json");

    const empty = join(tmp, "empty");
    mkdirSync(empty);
    expect(codda(["build", course, "--out", empty]).status).toBe(0);
    expect(filesOf(empty)).toContain(".codda-build");
  });

  test("again into the same --out: the folder with the marker is cleared and replaced", () => {
    const course = tsCourse();
    const out = join(tmp, "site");
    expect(codda(["build", course, "--out", out]).status).toBe(0);
    writeFiles(out, { "stale.txt": "from an older build" });

    const { status } = codda(["build", course, "--out", out]);

    expect(status).toBe(0);
    expect(filesOf(out)).toEqual([".codda-build", "assets/app.js", "course.json", "index.html"]);
  });

  test("--out that is not empty and has no marker: an error before the build, exit 2, the folder untouched", () => {
    const course = tsCourse();
    const out = join(tmp, "home");
    writeFiles(out, { "notes.txt": "mine", "photos/cat.jpg": "cat" });

    const { status, stdout, stderr } = codda(["build", course, "--out", out]);

    expect(status).toBe(2);
    expect(stdout).toBe("");
    expect(stderr).toBe(
      `codda: папка ${out} не пуста и это не сборка codda (нет файла .codda-build): укажите пустую папку (справка: codda --help)\n`,
    );
    expect(filesOf(out)).toEqual(["notes.txt", "photos/cat.jpg"]);
    expect(existsSync(join(course, ".codda"))).toBe(false);
  });

  test("an invalid lesson.md: exit 1, no dist/ is created, an old dist/ stays as it was", () => {
    const course = tsCourse();
    writeFiles(course, { "sum/lesson.md": "Без frontmatter.\n" });

    const first = codda(["build", course]);

    expect(first.status).toBe(1);
    expect(first.stdout).toBe("");
    expect(first.stderr).toBe("sum/lesson.md: нет frontmatter между строками ---\n");
    expect(existsSync(join(course, "dist"))).toBe(false);

    writeFiles(course, { "dist/.codda-build": "", "dist/index.html": "old" });

    expect(codda(["build", course]).status).toBe(1);
    expect(filesOf(join(course, "dist"))).toEqual([".codda-build", "index.html"]);
    expect(readFileSync(join(course, "dist/index.html"), "utf8")).toBe("old");
  });

  test("a Dependency Artifact error: exit 1, an old dist/ stays as it was, no temporary folders left", () => {
    const course = tsCourse();
    writeFiles(course, {
      "sum/main.ts": 'import "left-pad";\nexport function sum(a: number, b: number): number {\n  return 0;\n}\n',
      "dist/.codda-build": "",
      "dist/index.html": "old",
    });

    const { status, stderr } = codda(["build", course]);

    expect(status).toBe(1);
    expect(stderr).toContain("нет package.json");
    expect(filesOf(join(course, "dist"))).toEqual([".codda-build", "index.html"]);
    expect(existsSync(join(course, ".codda")) ? readdirSync(join(course, ".codda")) : []).toEqual([]);
  });

  describe("the built UI (dist-tool/) is rebuilt from the tool's sources when needed", { timeout: 180_000 }, () => {
    test("missing: «Собираю UI codda…», the UI is built with its hash, the build has the real UI", () => {
      const course = tsCourse();
      const missing = join(tmp, "dist-tool");

      const { status, stdout } = codda(["build", course], { CODDA_UI_DIR: missing });

      expect(status).toBe(0);
      expect(stdout.split("\n")[0]).toBe("Собираю UI codda…");
      expect(existsSync(join(missing, UI_HASH_FILE))).toBe(true);
      expect(readFileSync(join(course, "dist/index.html"), "utf8")).toContain('<script type="module"');
      expect(existsSync(join(course, "dist", UI_HASH_FILE))).toBe(false);

      // Fresh now: the next build does not rebuild it.
      expect(codda(["build", course], { CODDA_UI_DIR: missing }).stdout).not.toContain("Собираю UI codda");
    });

    test("stale (another sources hash): rebuilt", () => {
      const course = tsCourse();
      const stale = join(tmp, "stale-ui");
      fakeUi(stale, "0000");

      const { status, stdout } = codda(["build", course], { CODDA_UI_DIR: stale });

      expect(status).toBe(0);
      expect(stdout).toContain("Собираю UI codda…");
      expect(readFileSync(join(stale, "index.html"), "utf8")).toContain('<script type="module"');
    });

    test("the UI build fails: exit 2, nothing built", () => {
      const course = tsCourse();
      writeFiles(tmp, { "a-file": "" });

      const { status, stderr } = codda(["build", course], { CODDA_UI_DIR: join(tmp, "a-file", "ui") });

      expect(status).toBe(2);
      expect(stderr).toContain("не удалось собрать UI codda");
      expect(existsSync(join(course, "dist"))).toBe(false);
    });
  });
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

  // The types of the Course's packages for the Type Checker (ts-tooling).
  const types = readJson(join(out, course.deps, "types.json"));
  expect(Object.keys(types)).toEqual(
    expect.arrayContaining(["/node_modules/@types/react/index.d.ts", "/node_modules/@types/react-dom/client.d.ts", "/node_modules/csstype/index.d.ts"]),
  );
});

test("`codda build` from courses/react-hooks and from its Lesson folder gives the same build", () => {
  const fromRoot = join(tmp, "from-root");
  const fromLesson = join(tmp, "from-lesson");

  const a = codda(["build", "--out", fromRoot], { CODDA_UI_DIR: ui }, reactHooks);
  const b = codda(["build", "--out", fromLesson], { CODDA_UI_DIR: ui }, join(reactHooks, "use-state"));

  expect(a.stderr).toBe("");
  expect([a.status, b.status]).toEqual([0, 0]);
  expect(filesOf(fromLesson)).toEqual(filesOf(fromRoot));
  for (const file of filesOf(fromRoot)) {
    expect(readFileSync(join(fromLesson, file)), file).toEqual(readFileSync(join(fromRoot, file)));
  }
  // `codda` is a devDependency of the Course: the Dependency Artifact ignores it.
  const { deps } = readJson(join(fromRoot, "course.json"));
  expect(Object.keys(readJson(join(fromRoot, deps, "importmap.json")).imports).some((s: string) => s.startsWith("codda"))).toBe(false);
  expect(readJson(join(reactHooks, "package.json")).devDependencies).toEqual({ codda: "file:../../packages/codda" });
}, 60_000);

describe("Course errors: one line each, all in one run, exit 1, no build", () => {
  /**
   * Writes the valid two-Lesson Course, applies `changes` (`null` deletes a
   * file) and runs `codda build` on it. Returns the stderr lines.
   */
  function errorsOf(changes: Record<string, string | null>) {
    const course = join(tmp, "course");
    rmSync(course, { recursive: true, force: true });
    writeCourse(course);
    for (const [path, content] of Object.entries(changes)) {
      if (content === null) rmSync(join(course, path));
      else writeFiles(course, { [path]: content });
    }
    const out = join(tmp, "site");

    const { status, stdout, stderr } = codda(["build", course, "--out", out]);

    expect(stdout).toBe("");
    expect(existsSync(out)).toBe(false);
    expect(status).toBe(1);
    return stderr.split("\n").slice(0, -1);
  }

  const modules = "modules:\n  - title: Первый\n    lessons: [zeta]\n  - title: Второй\n    lessons: [alpha]\n";

  test("course.yaml without id, title and modules", () => {
    expect(errorsOf({ "course.yaml": "{}\n" })).toEqual([
      "course.yaml: id: обязательное поле",
      "course.yaml: title: обязательное поле",
      "course.yaml: modules: обязательное поле",
    ]);
  });

  test("empty title and modules", () => {
    expect(errorsOf({ "course.yaml": 'id: demo\ntitle: ""\nmodules: []\n' })).toEqual([
      "course.yaml: title: не может быть пустым",
      "course.yaml: modules: список не может быть пустым",
    ]);
  });

  test("a Module without title or with empty lessons; wrong types", () => {
    expect(
      errorsOf({
        "course.yaml": "id: demo\ntitle: 5\nmodules:\n  - lessons: [zeta]\n  - title: Второй\n    lessons: []\n  - title: Третий\n    lessons: alpha\n",
      }),
    ).toEqual([
      "course.yaml: title: ожидается строка",
      "course.yaml: modules[0].title: обязательное поле",
      "course.yaml: modules[1].lessons: список не может быть пустым",
      "course.yaml: modules[2].lessons: ожидается список",
      "alpha/lesson.md: урок alpha не указан в course.yaml",
    ]);
  });

  test("ids of the Course and of Lessons that are not kebab-case", () => {
    expect(
      errorsOf({
        "course.yaml": "id: React-Hooks\ntitle: Демо\nmodules:\n  - title: Первый\n    lessons: [zeta, use_state, 01-]\n  - title: Второй\n    lessons: [alpha]\n",
      }),
    ).toEqual([
      "course.yaml: id: ожидается kebab-case, например use-state",
      "course.yaml: modules[0].lessons[1]: ожидается kebab-case, например use-state",
      "course.yaml: modules[0].lessons[2]: ожидается kebab-case, например use-state",
    ]);
  });

  test("unknown fields in course.yaml and in the frontmatter", () => {
    expect(
      errorsOf({
        "course.yaml": `id: demo\ntitle: Демо\ndependencies:\n  react: 19.0.0\nmodules:\n  - title: Первый\n    lessons: [zeta]\n    order: 1\n  - title: Второй\n    lessons: [alpha]\n`,
        "zeta/lesson.md": "---\ntitle: Зета\ndependencies: [react]\n---\nТекст.\n",
      }),
    ).toEqual([
      "course.yaml: modules[0].order: неизвестное поле",
      "course.yaml: dependencies: неизвестное поле",
      "zeta/lesson.md: dependencies: неизвестное поле",
    ]);
  });

  test("YAML syntax errors in course.yaml and in the frontmatter: the line number", () => {
    expect(errorsOf({ "course.yaml": `id: demo\ntitle: Демо\nid: other\n${modules}` })).toEqual([
      "course.yaml: строка 3: ключ повторяется",
    ]);
    expect(
      errorsOf({
        "zeta/lesson.md": "---\ntitle: Зета\ntitle: Z\n---\nТекст.\n",
        "alpha/lesson.md": "---\ntitle: 'Альфа\n---\nТекст.\n",
      }),
    ).toEqual(["zeta/lesson.md: строка 3: ключ повторяется", "alpha/lesson.md: строка 2: не закрыта кавычка или скобка"]);
  });

  test("a listed Lesson missing on disk, an unlisted Lesson folder, repeated ids", () => {
    expect(
      errorsOf({
        "course.yaml": "id: demo\ntitle: Демо\nmodules:\n  - title: Первый\n    lessons: [zeta, beta, zeta]\n  - title: Второй\n    lessons: [zeta]\n",
      }),
    ).toEqual([
      "course.yaml: modules[0].lessons[1]: нет папки урока beta",
      "course.yaml: modules[0].lessons[2]: урок zeta уже указан в modules[0].lessons[0]",
      "course.yaml: modules[1].lessons[0]: урок zeta уже указан в modules[0].lessons[0]",
      "alpha/lesson.md: урок alpha не указан в course.yaml",
    ]);
  });

  test("lesson.md: missing, without frontmatter, without title or with an empty one", () => {
    expect(errorsOf({ "zeta/lesson.md": null, "alpha/lesson.md": "Кнопка.\n" })).toEqual([
      "zeta/: нет lesson.md",
      "alpha/lesson.md: нет frontmatter между строками ---",
    ]);
    expect(errorsOf({ "zeta/lesson.md": "---\n---\nТекст.\n", "alpha/lesson.md": '---\ntitle: ""\n---\n' })).toEqual([
      "zeta/lesson.md: title: обязательное поле",
      "alpha/lesson.md: title: не может быть пустым",
    ]);
  });

  test("main.*, solution.* and lesson.test.*: missing, both, or solution with another extension", () => {
    expect(
      errorsOf({
        "zeta/main.ts": null,
        "zeta/lesson.test.ts": null,
        "alpha/solution.tsx": null,
        "alpha/solution.ts": "export {};\n",
      }),
    ).toEqual([
      "zeta/: нет main.ts или main.tsx",
      "zeta/: нет lesson.test.ts или lesson.test.tsx",
      "alpha/: нет solution.tsx — расширение как у main.tsx",
    ]);
    expect(errorsOf({ "zeta/main.tsx": "export {};\n", "alpha/lesson.test.ts": "export {};\n" })).toEqual([
      "zeta/: есть и main.ts, и main.tsx — нужен один",
      "alpha/: есть и lesson.test.ts, и lesson.test.tsx — нужен один",
    ]);
    expect(errorsOf({ "zeta/solution.ts": null })).toEqual(["zeta/: нет solution.ts — расширение как у main.ts"]);
  });

  test("errors in several files and Lessons, all in one run: course.yaml first, then Lessons in its order", () => {
    expect(
      errorsOf({
        "course.yaml": "id: demo\ntitle: Демо\nextra: 1\nmodules:\n  - title: Первый\n    lessons: [zeta]\n  - title: Второй\n    lessons: [alpha, gamma]\n",
        "beta/lesson.md": "---\ntitle: Бета\n---\n",
        "alpha/lesson.md": "---\ntitle: Альфа\nlevel: 2\n---\n",
        "alpha/main.ts": "export {};\n",
        "zeta/lesson.test.ts": null,
      }),
    ).toEqual([
      "course.yaml: extra: неизвестное поле",
      "course.yaml: modules[1].lessons[1]: нет папки урока gamma",
      "beta/lesson.md: урок beta не указан в course.yaml",
      "zeta/: нет lesson.test.ts или lesson.test.tsx",
      "alpha/lesson.md: level: неизвестное поле",
      "alpha/: есть и main.ts, и main.tsx — нужен один",
    ]);
  });
});

test("folders without lesson.md, like node_modules/ and dist/, are not Lessons", () => {
  const course = join(tmp, "course");
  writeCourse(course);
  writeFiles(course, { "node_modules/react/index.js": "", "dist/index.html": "", "notes/todo.txt": "" });

  const { status, stderr } = codda(["build", course, "--out", join(tmp, "site")]);

  expect(stderr).toBe("");
  expect(status).toBe(0);
});

test("on Course errors an existing --out folder stays as it was", () => {
  const course = join(tmp, "course");
  writeCourse(course);
  rmSync(join(course, "zeta/main.ts"));
  const out = join(tmp, "site");
  writeFiles(out, { ".codda-build": "", "index.html": "old", "course.json": "{}" });

  const { status } = codda(["build", course, "--out", out]);

  expect(status).toBe(1);
  expect(readdirSync(out).sort()).toEqual([".codda-build", "course.json", "index.html"]);
  expect(readFileSync(join(out, "index.html"), "utf8")).toBe("old");
  expect(readFileSync(join(out, "course.json"), "utf8")).toBe("{}");
});

describe("Instructions: lesson.md body → HTML in course.json", () => {
  /** Builds the valid Course with `body` as the Instructions of zeta; returns its `instructions`. */
  function instructionsOf(body: string) {
    const course = join(tmp, "course");
    writeCourse(course);
    writeFiles(course, { "zeta/lesson.md": `---\ntitle: Зета\n---\n${body}` });
    const out = join(tmp, "site");

    const { status, stderr } = codda(["build", course, "--out", out]);

    expect(stderr).toBe("");
    expect(status).toBe(0);
    return readJson(join(out, "course.json")).modules[0].lessons[0].instructions as string;
  }

  test("headings, lists, inline code, code blocks, GFM tables and links", () => {
    const html = instructionsOf(
      [
        "## Задание",
        "",
        "- раз",
        "- два",
        "",
        "1. первый",
        "",
        "Вызовите `useState`, см. [доку](#/use-state).",
        "",
        "```tsx",
        "const [open, setOpen] = useState(false);",
        "```",
        "",
        "| Действие | Результат |",
        "| --- | --- |",
        "| `increment` | +1 |",
        "",
      ].join("\n"),
    );

    expect(html).toContain("<h2>Задание</h2>");
    expect(html).toContain("<ul>\n<li>раз</li>\n<li>два</li>\n</ul>");
    expect(html).toContain("<ol>\n<li>первый</li>\n</ol>");
    expect(html).toContain("<code>useState</code>");
    expect(html).toContain('<a href="#/use-state">доку</a>');
    expect(html).toContain('<pre><code class="language-tsx">const [open, setOpen] = useState(false);\n</code></pre>');
    expect(html).toMatch(/<table>[\s\S]*<th>Действие<\/th>[\s\S]*<td><code>increment<\/code><\/td>[\s\S]*<\/table>/);
  });

  test("raw HTML, block and inline, is escaped and shows as text", () => {
    const html = instructionsOf(
      [
        "<script>alert(1)</script>",
        "",
        '<div class="x">',
        "блок",
        "</div>",
        "",
        "Текст <img src=x onerror=alert(2)> и <b>жирный</b>.",
        "",
      ].join("\n"),
    );

    expect(html).not.toMatch(/<(script|div|img|b)[\s>]/);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;div class=&quot;x&quot;&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(2)&gt;");
    expect(html).toContain("&lt;b&gt;жирный&lt;/b&gt;");
  });

  test("external links open in a new tab; links inside the site do not", () => {
    const html = instructionsOf(
      '[React](https://react.dev/reference/react/useState "useState"), http://example.com и [урок](#/use-ref).\n',
    );

    expect(html).toContain(
      '<a href="https://react.dev/reference/react/useState" title="useState" target="_blank" rel="noopener">React</a>',
    );
    expect(html).toContain('<a href="http://example.com" target="_blank" rel="noopener">http://example.com</a>');
    expect(html).toContain('<a href="#/use-ref">урок</a>');
  });

  test("a link with a script scheme becomes plain text: the HTML goes into our own page", () => {
    const html = instructionsOf(
      [
        "[раз](javascript:alert(1)) [два](JavaScript:alert(2)) [три](data:text/html,<b>x</b>) [четыре][ref]",
        "",
        "<javascript:alert(5)> [шесть](<java\tscript:alert(6)>)",
        "",
        "[ref]: javascript:alert(4)",
        "",
      ].join("\n"),
    );

    expect(html).not.toContain("<a");
    expect(html).not.toContain("href");
    expect(html).toContain("<p>раз два три четыре</p>");
    expect(html).toContain("шесть");
  });

  test("a body that starts with `# …` is not an error", () => {
    expect(instructionsOf("# Заголовок\n\nТекст.\n")).toBe("<h1>Заголовок</h1>\n<p>Текст.</p>\n");
  });

  test("an image is a Course error with its line in lesson.md, reported with the other errors", () => {
    const course = join(tmp, "course");
    writeCourse(course);
    writeFiles(course, {
      "zeta/lesson.md": "---\ntitle: Зета\n---\n\nТекст.\n\n![схема](diagram.png)\n\n| a |\n| - |\n| ![x](x.png) |\n\n![схема](diagram.png) и снова.\n",
    });
    rmSync(join(course, "alpha/lesson.test.tsx"));
    const out = join(tmp, "site");

    const { status, stdout, stderr } = codda(["build", course, "--out", out]);

    expect(status).toBe(1);
    expect(stdout).toBe("");
    expect(stderr.split("\n").slice(0, -1)).toEqual([
      "zeta/lesson.md: строка 7: картинки в Instructions не поддерживаются",
      "zeta/lesson.md: строка 11: картинки в Instructions не поддерживаются",
      "zeta/lesson.md: строка 13: картинки в Instructions не поддерживаются",
      "alpha/: нет lesson.test.ts или lesson.test.tsx",
    ]);
    expect(existsSync(out)).toBe(false);
  });
});
