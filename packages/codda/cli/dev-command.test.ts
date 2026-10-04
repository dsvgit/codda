// `codda dev` as an Author runs it: a process on a `.ts` Course the test
// writes itself, `--port 0`, a stand-in for the built UI. The test reads the
// server's answers and its SSE stream with fetch, edits files of the Course
// and waits for the rebuild.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";
import type { CourseData } from "../src/course-data.ts";
import { fakeUi, tsCourse, writeFiles } from "./test-helpers.ts";

const cli = fileURLToPath(new URL("codda.ts", import.meta.url));

type Dev = {
  process: ChildProcess;
  url: string;
  stdout: () => string;
  stderr: () => string;
  exited: Promise<number | null>;
};

const started: Dev[] = [];

afterEach(() => {
  for (const dev of started.splice(0)) dev.process.kill("SIGKILL");
});

/** Starts `codda dev <args>` in `cwd` and waits for the printed URL. */
function startDev(cwd: string, args: string[] = ["--port", "0"], env: Record<string, string> = {}): Promise<Dev> {
  const ui = join(mkdtempSync(join(tmpdir(), "codda-ui-")), "ui");
  fakeUi(ui);
  const child = spawn(process.execPath, [cli, "dev", ...args], { cwd, env: { ...process.env, CODDA_UI_DIR: ui, ...env } });
  let out = "";
  let err = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => (out += chunk));
  child.stderr.setEncoding("utf8").on("data", (chunk) => (err += chunk));
  const exited = new Promise<number | null>((done) => child.on("exit", (code) => done(code)));
  return new Promise((resolve, reject) => {
    const check = () => {
      const url = /http:\/\/127\.0\.0\.1:\d+\//.exec(out)?.[0];
      if (url) {
        child.stdout.off("data", check);
        const dev = { process: child, url, stdout: () => out, stderr: () => err, exited };
        started.push(dev);
        resolve(dev);
      }
    };
    child.stdout.on("data", check);
    exited.then((code) => reject(new Error(`codda dev exited with ${code}:\n${out}${err}`)));
  });
}

/** The events of the SSE stream at `url`, as they come. */
async function events(url: string) {
  const response = await fetch(new URL("__codda/events", url));
  expect(response.headers.get("content-type")).toMatch(/^text\/event-stream/);
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  const seen: string[] = [];
  let buffer = "";
  const pump = (async () => {
    for (;;) {
      const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
      if (done) return;
      buffer += value;
      for (const match of buffer.matchAll(/^event: (\S+)$/gm)) seen.push(match[1]);
      buffer = buffer.slice(buffer.lastIndexOf("\n\n") + 2);
    }
  })();
  return {
    seen,
    /** Waits until `count` events have come. */
    async waitFor(count: number) {
      for (let i = 0; i < 200 && seen.length < count; i++) await new Promise((r) => setTimeout(r, 50));
      expect(seen.length).toBeGreaterThanOrEqual(count);
    },
    close: () => reader.cancel().then(() => pump),
  };
}

const courseJson = async (dev: Dev) => (await (await fetch(new URL("course.json", dev.url))).json()) as CourseData;

test("an edit to lesson.md rebuilds course.json and sends one `reload`", async () => {
  const course = tsCourse();
  const dev = await startDev(course);
  expect(dev.url).not.toContain(":0/");
  expect((await courseJson(dev)).modules[0].lessons[0].title).toBe("Сумма");
  const stream = await events(dev.url);

  writeFiles(course, { "sum/lesson.md": "---\ntitle: Сложение\n---\nНапишите `sum(a, b)`.\n" });

  await stream.waitFor(1);
  expect(stream.seen).toEqual(["reload"]);
  expect((await courseJson(dev)).modules[0].lessons[0].title).toBe("Сложение");
  await stream.close();
});

test("several quick edits make one rebuild and one `reload`", async () => {
  const course = tsCourse();
  const dev = await startDev(course);
  const stream = await events(dev.url);

  writeFiles(course, { "sum/lesson.md": "---\ntitle: Раз\n---\n" });
  writeFiles(course, { "greet/lesson.md": "---\ntitle: Два\n---\n" });
  writeFiles(course, { "sum/main.ts": "export function sum(a: number, b: number): number {\n  return 1;\n}\n" });

  await stream.waitFor(1);
  await new Promise((r) => setTimeout(r, 1000));
  expect(stream.seen).toEqual(["reload"]);
  const lessons = (await courseJson(dev)).modules[0].lessons;
  expect(lessons.map((lesson) => lesson.title)).toEqual(["Раз", "Два"]);
  await stream.close();
});

test("index.html gets the reload script from the server, the build in .codda/dev/ has none", async () => {
  const course = tsCourse();
  const dev = await startDev(course);

  const html = await (await fetch(dev.url)).text();
  expect(html).toContain('new EventSource("/__codda/events")');
  expect(readFileSync(join(course, ".codda", "dev", "index.html"), "utf8")).not.toContain("EventSource");
});

test("an invalid lesson.md: that Lesson gets `errors`, the others stay, the terminal shows them; a fix recovers", async () => {
  const course = tsCourse();
  const dev = await startDev(course);
  const stream = await events(dev.url);
  const before = await courseJson(dev);

  writeFiles(course, { "sum/lesson.md": "Нет frontmatter.\n" });
  await stream.waitFor(1);

  const broken = await courseJson(dev);
  expect(broken.errors).toBeUndefined();
  expect(broken.modules[0].lessons).toEqual([
    { id: "sum", title: "sum", errors: ["sum/lesson.md: нет frontmatter между строками ---"] },
    before.modules[0].lessons[1],
  ]);
  expect(dev.stdout()).toContain("✗ sum\n  sum/lesson.md: нет frontmatter между строками ---\n");
  expect(dev.process.exitCode).toBeNull();

  writeFiles(course, { "sum/lesson.md": "---\ntitle: Сумма\n---\nНапишите `sum(a, b)`.\n" });
  await stream.waitFor(2);
  expect(await courseJson(dev)).toEqual(before);
  await stream.close();
});

test("manifest errors are printed at start too", async () => {
  const course = tsCourse();
  writeFiles(course, { "greet/lesson.md": "---\ntitle: [\n---\n" });

  const dev = await startDev(course);

  expect(dev.stdout()).toMatch(/✗ greet\n {2}greet\/lesson\.md: строка 2: /);
  expect((await courseJson(dev)).modules[0].lessons.map((lesson) => "errors" in lesson)).toEqual([false, true]);
});

test("a broken course.yaml: top-level `errors` and no Lessons, the errors in the terminal", async () => {
  const course = tsCourse();
  const dev = await startDev(course);
  const stream = await events(dev.url);

  writeFiles(course, { "course.yaml": "id: demo\nmodules:\n  - title: Основы\n    lessons: [sum, greet]\n" });
  await stream.waitFor(1);

  expect(await courseJson(dev)).toMatchObject({ modules: [], errors: ["course.yaml: title: обязательное поле"] });
  expect(dev.stderr()).toContain("course.yaml: title: обязательное поле\n");
  expect(dev.process.exitCode).toBeNull();
  await stream.close();
});

test("a busy port: an error and code 2", async () => {
  const course = tsCourse();
  const first = await startDev(course);
  const port = new URL(first.url).port;

  const second = spawnSync(process.execPath, [cli, "dev", "--port", port], {
    cwd: course,
    encoding: "utf8",
    env: { ...process.env, CODDA_UI_DIR: join(course, ".codda", "dev") },
  });

  expect(second.stderr).toContain(`порт ${port} занят`);
  expect(second.status).toBe(2);
});

test("Ctrl+C (SIGINT) stops the server, code 0", async () => {
  const course = tsCourse();
  const dev = await startDev(course);

  dev.process.kill("SIGINT");

  expect(await dev.exited).toBe(0);
  await expect(fetch(dev.url)).rejects.toThrow();
});

/**
 * A `.ts` Course whose Lesson imports the package `esm-pkg` at `version`,
 * installed as after `npm ci`; and a stand-in for npm first on PATH that logs
 * its calls and "installs" package-lock.json as is.
 */
function packageCourse() {
  const dir = join(mkdtempSync(join(tmpdir(), "codda-course-")), "course");
  const lock = (version: string) =>
    JSON.stringify({ name: "demo", lockfileVersion: 3, requires: true, packages: { "": { dependencies: { "esm-pkg": version } }, "node_modules/esm-pkg": { version } } });
  writeFiles(dir, {
    "course.yaml": "id: demo\ntitle: Демо\nmodules:\n  - title: Основы\n    lessons: [count]\n",
    "count/lesson.md": "---\ntitle: Счёт\n---\n",
    "count/main.ts": 'import { start } from "esm-pkg";\nexport const count = start;\n',
    "count/solution.ts": 'import { start } from "esm-pkg";\nexport const count = start + 1;\n',
    "count/lesson.test.ts": 'import { test } from "@codda/test";\nimport { count } from "./main";\ntest("count", () => count);\n',
    "package.json": JSON.stringify({ name: "demo", dependencies: { "esm-pkg": "2.0.0" } }),
    "package-lock.json": lock("2.0.0"),
    "node_modules/.package-lock.json": lock("2.0.0"),
    "node_modules/esm-pkg/package.json": JSON.stringify({ name: "esm-pkg", version: "2.0.0", type: "module", main: "index.js" }),
    "node_modules/esm-pkg/index.js": "export const start = 10;\n",
    "node_modules/esm-pkg/index.d.ts": "export declare const start: number;\n",
  });
  const bin = join(dir, "..", "bin");
  const log = join(dir, "..", "npm.log");
  writeFiles(bin, { npm: `#!/bin/sh\necho "$@" >> "${log}"\ncp package-lock.json node_modules/.package-lock.json\n` });
  chmodSync(join(bin, "npm"), 0o755);
  return {
    dir,
    lock,
    env: { PATH: `${bin}${delimiter}${process.env.PATH}` },
    npmCalls: () => (existsSync(log) ? readFileSync(log, "utf8") : ""),
  };
}

test("an edit to package*.json rebuilds the Dependency Artifact with its npm step, then `reload`", async () => {
  const course = packageCourse();
  const dev = await startDev(course.dir, ["--port", "0"], course.env);
  const before = (await courseJson(dev)).deps;
  expect(before).toMatch(/^deps\/[0-9a-f]+\/$/);
  const stream = await events(dev.url);

  writeFiles(course.dir, {
    "package.json": JSON.stringify({ name: "demo", dependencies: { "esm-pkg": "2.0.1" } }),
    "package-lock.json": course.lock("2.0.1"),
  });
  await stream.waitFor(1);

  expect(course.npmCalls()).toBe("ci\n");
  const after = (await courseJson(dev)).deps;
  expect(after).toMatch(/^deps\/[0-9a-f]+\/$/);
  expect(after).not.toBe(before);
  expect((await fetch(new URL(`${after}importmap.json`, dev.url))).status).toBe(200);
  expect(stream.seen).toEqual(["reload"]);
  await stream.close();
});

test("an error of the Dependency Artifact is printed, the page gets it full-screen, the server keeps running", async () => {
  const course = packageCourse();
  const dev = await startDev(course.dir, ["--port", "0"], course.env);
  const stream = await events(dev.url);

  writeFiles(course.dir, { "package.json": JSON.stringify({ name: "demo", dependencies: { "esm-pkg": "^2.0.0" } }) });
  await stream.waitFor(1);

  const error = "package.json: у пакета `esm-pkg` версия `^2.0.0`, нужна точная (X.Y.Z)";
  expect(dev.stderr()).toContain(error);
  const broken = await courseJson(dev);
  expect(broken.modules).toEqual([]);
  expect(broken.errors?.[0]).toContain(error);
  expect(dev.process.exitCode).toBeNull();

  writeFiles(course.dir, { "package.json": JSON.stringify({ name: "demo", dependencies: { "esm-pkg": "2.0.0" } }) });
  await stream.waitFor(2);
  expect((await courseJson(dev)).errors).toBeUndefined();
  await stream.close();
});
