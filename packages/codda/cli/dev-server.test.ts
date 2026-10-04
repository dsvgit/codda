// `npm run dev`: the tool's Vite server answers /course.json from the Course
// in CODDA_COURSE, read anew on every request by the same module as
// `codda build`. The test starts the real server on a Course it writes itself.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, expect, test } from "vitest";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
let server: ViteDevServer;
let courseJson: string;

function writeFiles(root: string, files: Record<string, string>) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
}

function writeCourse(dir: string, title: string) {
  writeFiles(dir, {
    "course.yaml": `id: demo\ntitle: ${title}\nmodules:\n  - title: Первый\n    lessons: [first]\n`,
    "first/lesson.md": "---\ntitle: Первый урок\n---\nСложите числа.\n",
    "first/main.ts": "export const sum = 0;\n",
    "first/solution.ts": "export const sum = 3;\n",
    "first/lesson.test.ts": 'import { sum } from "./main";\n',
  });
}

beforeAll(async () => {
  server = await createServer({
    root: packageDir,
    configFile: join(packageDir, "vite.config.ts"),
    server: { port: 0, strictPort: false },
    logLevel: "silent",
  });
  await server.listen();
  courseJson = new URL("course.json", server.resolvedUrls!.local[0]).href;
});

afterAll(async () => {
  await server.close();
  delete process.env.CODDA_COURSE;
});

test("serves course.json of the Course and picks up edits without a restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "codda-dev-"));
  writeCourse(dir, "Демо");
  process.env.CODDA_COURSE = dir;

  const response = await fetch(courseJson);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    id: "demo",
    title: "Демо",
    modules: [{ title: "Первый", lessons: [{ id: "first", title: "Первый урок" }] }],
  });

  writeCourse(dir, "Демо 2");
  expect(await (await fetch(courseJson)).json()).toMatchObject({ title: "Демо 2" });
});

test("Course errors are a 500 with the same lines as codda build", async () => {
  const dir = mkdtempSync(join(tmpdir(), "codda-dev-"));
  writeFiles(dir, { "course.yaml": "id: demo\nmodules:\n  - title: Первый\n    lessons: [first]\n" });
  process.env.CODDA_COURSE = dir;

  const response = await fetch(courseJson);
  expect(response.status).toBe(500);
  expect(await response.text()).toMatch(/^course\.yaml: title: .+\n$/);
});

test("no course.yaml at CODDA_COURSE is a 500 that names the path", async () => {
  const dir = mkdtempSync(join(tmpdir(), "codda-dev-"));
  process.env.CODDA_COURSE = dir;

  const response = await fetch(courseJson);
  expect(response.status).toBe(500);
  expect(await response.text()).toContain(`нет course.yaml в ${dir}`);
});

test("without CODDA_COURSE the 500 says which variable to set", async () => {
  delete process.env.CODDA_COURSE;

  const response = await fetch(courseJson);
  expect(response.status).toBe(500);
  expect(await response.text()).toContain("CODDA_COURSE");
});
