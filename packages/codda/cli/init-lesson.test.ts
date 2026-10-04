// `codda init` and `codda lesson` as an Author calls them: processes on a
// temporary folder, then `codda test` on the result. A fresh Course and a fresh
// Lesson pass `codda test` right away.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { runCodda, tsCourse, writeFiles } from "./test-helpers.ts";

const LONG = { timeout: 240_000 };

/** stdout without the UI build line, which shows only when dist-tool/ is stale. */
const report = (stdout: string) => stdout.replace("Собираю UI codda…\n", "");

/** A path to a new folder `name` (not created) in a fresh temporary folder; real, as `codda` prints it. */
const newFolder = (name: string) => join(realpathSync(mkdtempSync(join(tmpdir(), "codda-init-"))), name);

test("init in an empty folder (`.git` allowed): a Course with `hello` that passes `npx codda test`", LONG, () => {
  const course = newFolder("my-course");
  mkdirSync(join(course, ".git"), { recursive: true });

  const init = runCodda(course, ["init"]);

  expect(init.stderr).toBe("");
  expect(init.status).toBe(0);
  expect(readFileSync(join(course, "course.yaml"), "utf8")).toBe(
    "id: my-course\ntitle: my-course\nmodules:\n  - title: Основы\n    lessons:\n      - hello\n",
  );
  const pkg = JSON.parse(readFileSync(join(course, "package.json"), "utf8"));
  expect(pkg).toMatchObject({ private: true, dependencies: {} });
  expect(pkg.devDependencies.codda).toMatch(/^file:(\.\.\/)+.*packages\/codda$/);
  expect(readFileSync(join(course, ".npmrc"), "utf8")).toBe("save-exact=true\n");
  expect(readFileSync(join(course, ".gitignore"), "utf8")).toBe("node_modules/\n.codda/\ndist/\n");
  expect(readdirSync(join(course, "hello")).sort()).toEqual(["lesson.md", "lesson.test.ts", "main.ts", "solution.ts"]);
  expect(readFileSync(join(course, "hello/lesson.md"), "utf8")).toMatch(/^---\ntitle: hello\n---\n/);
  expect(existsSync(join(course, "node_modules/.bin/codda"))).toBe(true);
  expect(init.stdout).toContain("course.yaml\n");
  expect(init.stdout).toContain("hello/main.ts\n");
  expect(init.stdout).toContain("npm install react react-dom @types/react @types/react-dom");
  expect(init.stdout).toContain("npx codda test");

  const checked = spawnSync("npx", ["codda", "test"], { cwd: course, encoding: "utf8" });

  expect(checked.stderr).toBe("");
  expect(report(checked.stdout)).toBe("Зависимости: нет\n✓ hello\n1 из 1 Lesson прошли\n");
  expect(checked.status).toBe(0);
});

test("init in a non-empty folder: an error, code 2, nothing changed", () => {
  const course = newFolder("my-course");
  writeFiles(course, { "notes.txt": "мои заметки\n" });

  const { status, stdout, stderr } = runCodda(course, ["init"]);

  expect(stdout).toBe("");
  expect(stderr).toBe(`codda: папка ${course} не пуста: курс создаётся только в пустой папке (можно с .git) (справка: codda --help)\n`);
  expect(status).toBe(2);
  expect(readdirSync(course)).toEqual(["notes.txt"]);
});

test("init into a folder that is not kebab-case: a hint, code 2, nothing created", () => {
  const parent = newFolder("parent");
  mkdirSync(parent);

  const { status, stderr } = runCodda(parent, ["init", "My Course"]);

  expect(stderr).toBe(
    "codda: имя папки «My Course» станет id курса и должно быть в kebab-case: переименуйте папку, например в my-course (справка: codda --help)\n",
  );
  expect(status).toBe(2);
  expect(readdirSync(parent)).toEqual([]);
});

test("lesson appends to the last Module or to --module, keeps course.yaml comments in place; the Course still passes", LONG, () => {
  const course = tsCourse();
  writeFiles(course, {
    "course.yaml":
      "# Курс-демо\nid: demo\ntitle: Демо\nmodules:\n  - title: Основы # первый модуль\n    lessons: [sum]\n" +
      "  # второй модуль\n  - title: Ещё\n    lessons:\n      - greet # приветствие\n",
  });

  const last = runCodda(course, ["lesson", "last-one"]);
  const chosen = runCodda(join(course, "sum"), ["lesson", "first-two", "--module", "Основы"]);

  expect([last.stderr, chosen.stderr]).toEqual(["", ""]);
  expect([last.status, chosen.status]).toEqual([0, 0]);
  expect(last.stdout).toContain("last-one/lesson.md\n");
  expect(readFileSync(join(course, "course.yaml"), "utf8")).toBe(
    "# Курс-демо\nid: demo\ntitle: Демо\nmodules:\n  - title: Основы # первый модуль\n    lessons: [sum, first-two]\n" +
      "  # второй модуль\n  - title: Ещё\n    lessons:\n      - greet # приветствие\n      - last-one\n",
  );
  expect(readdirSync(join(course, "last-one")).sort()).toEqual(["lesson.md", "lesson.test.ts", "main.ts", "solution.ts"]);
  expect(readFileSync(join(course, "first-two/lesson.md"), "utf8")).toMatch(/^---\ntitle: first-two\n---\n\n\S/);

  const checked = runCodda(course, ["test"]);

  expect(checked.stderr).toBe("");
  expect(report(checked.stdout)).toBe("Зависимости: нет\n✓ sum\n✓ first-two\n✓ greet\n✓ last-one\n4 из 4 Lesson прошли\n");
  expect(checked.status).toBe(0);
});

test.each([
  ["a folder that exists", ["lesson", "stray"], "codda: папка stray/ уже есть\n"],
  ["an id already in course.yaml", ["lesson", "greet"], "codda: урок greet уже указан в course.yaml\n"],
  ["an id not in kebab-case", ["lesson", "Bad_Id"], "codda: id урока «Bad_Id» должен быть в kebab-case, например use-state\n"],
  ["an unknown Module", ["lesson", "new-one", "--module", "Нет такого"], "codda: в course.yaml нет модуля «Нет такого»; модули: «Основы»\n"],
  [
    "--tsx without react and react-dom",
    ["lesson", "new-one", "--tsx"],
    "codda: для урока --tsx нужны react и react-dom в dependencies package.json курса: npm install react react-dom @types/react @types/react-dom\n",
  ],
])("lesson with %s: the error, code 1, nothing created or changed", (_, args, error) => {
  const course = tsCourse();
  writeFiles(course, { "stray/notes.txt": "не урок\n" });
  const yaml = readFileSync(join(course, "course.yaml"), "utf8");
  const before = readdirSync(course, { recursive: true }).sort();

  const { status, stdout, stderr } = runCodda(course, args);

  expect(stdout).toBe("");
  expect(stderr).toBe(error);
  expect(status).toBe(1);
  expect(readFileSync(join(course, "course.yaml"), "utf8")).toBe(yaml);
  expect(readdirSync(course, { recursive: true }).sort()).toEqual(before);
});

test("lesson outside a Course: code 2", () => {
  const { status, stderr } = runCodda(newFolder(""), ["lesson", "new-one"]);

  expect(stderr).toMatch(/^codda: здесь нет курса: /);
  expect(status).toBe(2);
});

test("lesson --tsx in a copy of React Hooks: the component template passes `codda test` of that Lesson", LONG, () => {
  const reactHooks = fileURLToPath(new URL("../../../courses/react-hooks", import.meta.url));
  const course = newFolder("react-hooks");
  // node_modules too, so the npm step is skipped; its relative `codda` link becomes absolute.
  cpSync(reactHooks, course, { recursive: true, filter: (path) => ![".codda", "dist"].includes(relative(reactHooks, path)) });

  const created = runCodda(course, ["lesson", "spoiler", "--tsx"]);

  expect(created.stderr).toBe("");
  expect(created.status).toBe(0);
  expect(readdirSync(join(course, "spoiler")).sort()).toEqual(["lesson.md", "lesson.test.tsx", "main.tsx", "solution.tsx"]);

  const checked = runCodda(course, ["test", "spoiler"]);

  expect(checked.stderr).toBe("");
  expect(report(checked.stdout)).toMatch(/\n✓ spoiler\n1 из 1 Lesson прошли\n$/);
  expect(checked.status).toBe(0);
});
