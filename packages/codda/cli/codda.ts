#!/usr/bin/env node
// codda CLI. Runs as TypeScript directly in Node 24, without a build step
// (.scratch/mvp/issues/05-codda-cli-commands.md). So far `build` and `test`;
// the commands init/lesson/dev come with the rest of the author-cli feature.
//
// Exit codes: 0 — success, 1 — errors in the Course, 2 — environment or
// invocation (unknown command or flag, no course.yaml, the UI build failed,
// --out that is not a codda build).
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import pkg from "../package.json" with { type: "json" };
import type { CourseData, LessonData } from "../src/course-data.ts";
import type { TestReport } from "../src/runtime/types.ts";
import { buildDependencyArtifact } from "./dependency-artifact.ts";
import { findCourse } from "./find-course.ts";
import { readCourse } from "./read-course.ts";
import { formatLesson, formatSummary, type LessonResult } from "./report.ts";
import { serveFolder } from "./static-server.ts";
import { buildUi, UI_HASH_FILE, uiIsFresh } from "./ui-build.ts";
import { verdict } from "./verdict.ts";

const HELP = `Использование: codda [флаги]
       codda build [путь] [--out <папка>]
       codda test [путь]

Инструмент автора курсов codda.

Команды:
  build          собрать курс в папку статических файлов (по умолчанию <курс>/dist);
                 курс — путь или папка с course.yaml выше текущей
  test           проверить курс в Chromium: Solution каждого урока проходит
                 его тесты, а Starter — нет; запросы на чужие адреса — ошибка
                 урока. Путь — папка курса или папка урока (тогда, как и при
                 запуске из неё, проверяется только этот урок). Коды выхода:
                 0 — всё прошло, 1 — ошибки курса, 2 — окружение или вызов
                 (например, не установлен Chromium)

Флаги:
  -h, --help     показать эту справку
  -v, --version  показать версию
`;

const options = {
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
  out: { type: "string" },
} as const;

// The tool's built UI (`npm run build`, ADR-0008). CODDA_UI_DIR replaces it in
// the CLI's own tests, which run before the UI is built.
const uiDir = process.env.CODDA_UI_DIR ?? fileURLToPath(new URL("../dist-tool", import.meta.url));

/** The marker of a Course Build: only a folder with it may be cleared by `--out`. */
const MARKER = ".codda-build";

function fail(message: string): never {
  process.stderr.write(`codda: ${message} (справка: codda --help)\n`);
  process.exit(2);
}

// strict: false, so unknown flags and commands get our own message in Russian
// instead of parseArgs' English TypeError.
const { values, positionals, tokens } = parseArgs({ options, strict: false, allowPositionals: true, tokens: true });
const [command, ...args] = positionals;

if (command !== undefined && command !== "build" && command !== "test") fail(`неизвестная команда ${command}`);
for (const token of tokens) {
  if (token.kind !== "option") continue;
  if (!(token.name in options) || (token.name === "out" && command !== "build")) fail(`неизвестный флаг ${token.rawName}`);
  const takesValue = options[token.name as keyof typeof options].type === "string";
  if (takesValue && token.value === undefined) fail(`флагу ${token.rawName} нужно значение`);
  if (!takesValue && token.value !== undefined) fail(`флаг ${token.rawName} не принимает значение`);
}

if (values.help) process.stdout.write(HELP);
else if (command === "build") process.exitCode = await build();
else if (command === "test") process.exitCode = await test();
else if (values.version) process.stdout.write(`${pkg.version}\n`);
else process.stdout.write(HELP);

async function build(): Promise<number> {
  if (args.length > 1) fail(`лишний аргумент ${args[1]}`);
  const found = findCourse(args[0] ?? ".");
  if (found === null) fail(`здесь нет курса: ${resolve(args[0] ?? ".")}`);
  const { root } = found;
  const out = resolve(typeof values.out === "string" ? values.out : join(root, "dist"));
  if (existsSync(out) && !existsSync(join(out, MARKER)) && (!statSync(out).isDirectory() || readdirSync(out).length > 0)) {
    fail(`папка ${out} не пуста и это не сборка codda (нет файла ${MARKER}): укажите пустую папку`);
  }

  ensureUi();

  const result = readCourse(root);
  if ("errors" in result) {
    process.stderr.write(result.errors.map((line) => `${line}\n`).join(""));
    return 1;
  }

  // Everything is written into a temporary folder and replaces `out` only
  // when complete: on any error `out` stays as it was.
  mkdirSync(join(root, ".codda"), { recursive: true });
  const staging = mkdtempSync(join(root, ".codda", "build-"));
  try {
    const artifact = await assemble(root, result.course, staging);
    if ("errors" in artifact) return 1;
    if (artifact.deps !== null) process.stdout.write(`${artifact.log}\n`);
    const files = readdirSync(staging, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => relative(staging, join(entry.parentPath, entry.name)))
      .sort();

    replaceFolder(out, staging);
    process.stdout.write(files.map((file) => `${file}\n`).join(""));
    process.stdout.write(`Курс собран в ${out}, файлов: ${files.length}\n`);
    return 0;
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

function ensureUi() {
  if (uiIsFresh(uiDir)) return;
  process.stdout.write("Собираю UI codda…\n");
  const failure = buildUi(uiDir);
  if (failure !== null) {
    process.stderr.write(failure);
    fail(`не удалось собрать UI codda в ${uiDir}`);
  }
}

/**
 * Course → a Course Build in `staging`, for `build` and `test`: the Dependency
 * Artifact of its Lessons, the built UI, course.json and the marker. Errors and
 * warnings of the artifact go to stderr.
 */
async function assemble(root: string, course: Omit<CourseData, "deps">, staging: string) {
  const lessonIds = course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id));
  const artifact = await buildDependencyArtifact(root, lessonIds, staging);
  if ("errors" in artifact) {
    process.stderr.write(artifact.errors.map((line) => `${line}\n`).join(""));
    return artifact;
  }
  if (artifact.deps !== null) process.stderr.write(artifact.warnings.map((line) => `${line}\n`).join(""));
  cpSync(uiDir, staging, { recursive: true, filter: (path) => basename(path) !== UI_HASH_FILE });
  writeFileSync(join(staging, "course.json"), JSON.stringify({ ...course, deps: artifact.deps }));
  writeFileSync(join(staging, MARKER), "Сборка курса codda: `codda build` заменяет эту папку целиком.\n");
  return artifact;
}

/** Replaces the folder `out` with the complete folder `staging`. */
function replaceFolder(out: string, staging: string) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(dirname(out), { recursive: true });
  try {
    renameSync(staging, out);
  } catch (error) {
    // --out on another disk than the Course: rename cannot move across them.
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
    cpSync(staging, out, { recursive: true });
  }
}

/**
 * `codda test`: the Course is built as by `codda build` into `.codda/test/`,
 * served from `/<course id>/` on 127.0.0.1, and full Chromium Runs the
 * Solution, then the Starter of each Lesson on the service page `#/__codda-test`
 * (src/main.tsx) — the student's Runtime with its 5 s limit. A Lesson with
 * manifest errors gets ✗ and no Run; the others are still checked. A path in a
 * Lesson folder checks only that Lesson: the errors of course.yaml are printed,
 * those of other Lessons are not. A request to another origin than the server
 * is aborted and becomes an error of the Run it happened in.
 */
async function test(): Promise<number> {
  if (args.length > 1) fail(`лишний аргумент ${args[1]}`);
  const found = findCourse(args[0] ?? ".");
  if (found === null) fail(`здесь нет курса: ${resolve(args[0] ?? ".")}`);
  const { root, lessonId } = found;
  ensureUi();
  const color = process.stdout.isTTY === true && !process.env.NO_COLOR;
  const relevant = (line: string) => lessonId === undefined || line.startsWith("course.yaml:") || line.startsWith(`${lessonId}/`);

  const result = readCourse(root);
  if ("errors" in result && !result.partial) {
    process.stderr.write(result.errors.filter(relevant).map((line) => `${line}\n`).join(""));
    return 1;
  }
  const { course: wholeCourse, lessonErrors, courseErrors: allCourseErrors } =
    "course" in result ? { ...result, lessonErrors: new Map<string, string[]>(), courseErrors: [] } : result.partial!;
  const lessons = new Map(wholeCourse.modules.flatMap((module) => module.lessons).map((lesson) => [lesson.id, lesson]));
  // course.yaml order; the Course of `partial` lacks the Lessons with errors.
  const listed = "course" in result ? [...lessons.keys()] : [...lessonErrors.keys()];
  if (lessonId !== undefined && !listed.includes(lessonId)) {
    const errors = [...allCourseErrors.filter((line) => line.startsWith("course.yaml:")), `${lessonId}/: урок ${lessonId} не указан в course.yaml`];
    process.stderr.write(errors.map((line) => `${line}\n`).join(""));
    return 1;
  }
  const ids = lessonId === undefined ? listed : [lessonId];
  const courseErrors = allCourseErrors.filter(relevant);
  // Only the Lessons to check go into the build, and so into the Dependency Artifact.
  const course = {
    ...wholeCourse,
    modules: wholeCourse.modules.map((module) => ({ ...module, lessons: module.lessons.filter((lesson) => ids.includes(lesson.id)) })),
  };
  process.stdout.write(courseErrors.map((line) => `${line}\n`).join(""));

  const built = join(root, ".codda", "test");
  mkdirSync(join(root, ".codda"), { recursive: true });
  const staging = mkdtempSync(join(root, ".codda", "test-"));
  let artifact;
  try {
    artifact = await assemble(root, course, staging);
    if ("errors" in artifact) return 1;
    replaceFolder(built, staging);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
  process.stdout.write(artifact.deps === null ? "Зависимости: нет\n" : `${artifact.log}\n`);

  const results: LessonResult[] = [];

  // Imported only now: without node_modules, the npm step above installs it.
  const { chromium } = await import("playwright");
  const server = await serveFolder(built, `/${course.id}/`);
  let browser;
  try {
    browser = await chromium.launch({ channel: "chromium" });
    const context = await browser.newContext();
    // Every request of the page, its Worker and Sandbox included (as in
    // e2e/offline.ts); WebSockets are not routed.
    const origin = new URL(server.url).origin;
    const foreign: string[] = [];
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (!/^(https?|wss?):$/.test(url.protocol) || url.origin === origin) return route.continue();
      foreign.push(url.href);
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    await page.goto(`${server.url}#/__codda-test`);
    await page.waitForFunction(() => "__codda" in globalThis);
    await page.evaluate(() => (globalThis as any).__codda.warmUp());
    foreign.length = 0;
    /** A Run and the foreign requests made during it, as errors of its file. */
    const runIn = async (lesson: LessonData, which: "solution" | "starter") => {
      const report: TestReport = await page.evaluate(
        ([id, which]) => (globalThis as any).__codda.run(id, which),
        [lesson.id, which] as const,
      );
      const file = `${lesson.id}/${which === "solution" ? lesson.workspace.name.replace("main", "solution") : lesson.workspace.name}`;
      return { report, foreign: foreign.splice(0).map((url) => `${file}: запрос на чужой адрес: ${url}`) };
    };

    for (const id of ids) {
      const lesson = lessons.get(id);
      let errors = lessonErrors.get(id) ?? [];
      if (lesson && errors.length === 0) {
        const solution = await runIn(lesson, "solution");
        errors = [...verdict(lesson, solution.report), ...solution.foreign];
        if (errors.length === 0) {
          const starter = await runIn(lesson, "starter");
          errors = [...verdict(lesson, solution.report, starter.report), ...starter.foreign];
        }
      }
      results.push({ id, errors, warnings: [] });
      process.stdout.write(formatLesson(results.at(-1)!, color));
    }
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("Executable doesn't exist")) {
      process.stderr.write("Chromium не найден. Установите: npx playwright install chromium (зеркало — PLAYWRIGHT_DOWNLOAD_HOST)\n");
    } else {
      process.stderr.write(`codda: не удалось проверить курс в Chromium: ${message}\n`);
    }
    return 2;
  } finally {
    await browser?.close();
    await server.close();
  }

  const warnings = artifact.deps === null ? 0 : artifact.warnings.length;
  process.stdout.write(formatSummary(results, warnings));
  return courseErrors.length > 0 || results.some((r) => r.errors.length > 0) ? 1 : 0;
}
