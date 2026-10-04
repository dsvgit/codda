#!/usr/bin/env node
// codda CLI. Runs as TypeScript directly in Node 24, without a build step
// (.scratch/mvp/issues/05-codda-cli-commands.md): `build`, `test`, `dev`,
// `init` and `lesson`.
//
// Exit codes: 0 — success, 1 — errors in the Course (and of `lesson`), 2 —
// environment or invocation (unknown command or flag, no course.yaml, the UI
// build failed, --out that is not a codda build, a busy port, a non-empty
// folder for `init`).
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, watch, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import pkg from "../package.json" with { type: "json" };
import type { CourseData, LessonData } from "../src/course-data.ts";
import type { TestReport } from "../src/runtime/types.ts";
import { buildDependencyArtifact } from "./dependency-artifact.ts";
import { findCourse } from "./find-course.ts";
import { KEBAB_CASE, readCourse } from "./read-course.ts";
import { formatLesson, formatSummary, type LessonResult } from "./report.ts";
import { serveFolder } from "./static-server.ts";
import { lessonTypeChecker } from "./type-check.ts";
import { isMap, isScalar, isSeq, parseDocument } from "yaml";
import { buildUi, UI_HASH_FILE, uiIsFresh } from "./ui-build.ts";
import { verdict } from "./verdict.ts";

const HELP = `Использование: codda [флаги]
       codda build [путь] [--out <папка>]
       codda test [путь]
       codda dev [путь] [--port <n>]
       codda init [путь] [--ci github|gitlab]
       codda lesson <id> [--module <название>] [--tsx]

Инструмент автора курсов codda.

Команды:
  build          собрать курс в папку статических файлов (по умолчанию <курс>/dist);
                 курс — путь или папка с course.yaml выше текущей
  test           проверить курс в Chromium: Solution каждого урока проходит
                 его тесты, а Starter — нет; запросы на чужие адреса — ошибка
                 урока; ошибка типов в Solution или тестах — ошибка урока, в
                 Starter — предупреждение. Путь — папка курса или папка урока
                 (тогда, как и при запуске из неё, проверяется только этот
                 урок). Коды выхода:
                 0 — всё прошло, 1 — ошибки курса, 2 — окружение или вызов
                 (например, не установлен Chromium)
  dev            локальный сервер курса на 127.0.0.1 (порт 4173, --port 0 —
                 любой свободный); после правки файла курса страница
                 перезагружается, ошибки курса видны в браузере и в терминале.
                 Ctrl+C — остановить
  init           создать новый курс в пустой папке (по умолчанию текущей; .git
                 можно): id и название курса — имя папки в kebab-case, урок
                 hello, package.json с codda, затем npm install. --ci github —
                 ещё .github/workflows/codda.yml (проверка и GitHub Pages),
                 --ci gitlab — .gitlab-ci.yml (проверка и выкладка в S3)
  lesson         добавить урок <id> (kebab-case) из шаблона: папка урока и строка
                 в course.yaml (в последний модуль или в модуль --module с этим
                 названием; комментарии course.yaml сохраняются). --tsx — урок
                 с компонентом React (нужны react и react-dom в dependencies)

Флаги:
  -h, --help     показать эту справку
  -v, --version  показать версию
`;

const options = {
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
  out: { type: "string" },
  port: { type: "string" },
  module: { type: "string" },
  tsx: { type: "boolean" },
  ci: { type: "string" },
} as const;

/** Flags that belong to one command only. */
const COMMAND_OF: Record<string, string> = { out: "build", port: "dev", module: "lesson", tsx: "lesson", ci: "init" };

/** The templates of a Course and of a Lesson (`ts`, `tsx`), next to the CLI. */
const templatesDir = fileURLToPath(new URL("../templates", import.meta.url));

// The tool's built UI (`npm run build`, ADR-0008). CODDA_UI_DIR replaces it in
// the CLI's own tests, which run before the UI is built.
const uiDir = process.env.CODDA_UI_DIR ?? fileURLToPath(new URL("../dist-tool", import.meta.url));

/** `codda init --ci <kind>`: the template in templates/ci/ and where it goes in the Course. */
const CI_FILES: Record<string, string> = { github: ".github/workflows/codda.yml", gitlab: ".gitlab-ci.yml" };

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

if (command !== undefined && !["build", "test", "dev", "init", "lesson"].includes(command)) fail(`неизвестная команда ${command}`);
for (const token of tokens) {
  if (token.kind !== "option") continue;
  if (!(token.name in options) || (token.name in COMMAND_OF && COMMAND_OF[token.name] !== command)) fail(`неизвестный флаг ${token.rawName}`);
  const takesValue = options[token.name as keyof typeof options].type === "string";
  if (takesValue && token.value === undefined) fail(`флагу ${token.rawName} нужно значение`);
  if (!takesValue && token.value !== undefined) fail(`флаг ${token.rawName} не принимает значение`);
}

if (values.help) process.stdout.write(HELP);
else if (command === "build") process.exitCode = await build();
else if (command === "test") process.exitCode = await test();
else if (command === "dev") await dev();
else if (command === "init") process.exitCode = init();
else if (command === "lesson") process.exitCode = lesson();
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
  const lessonIds = course.modules.flatMap((module) => module.lessons.filter((lesson) => !("errors" in lesson)).map((lesson) => lesson.id));
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
 * is aborted and becomes an error of the Run it happened in. Then the types of
 * each Lesson that has no manifest errors are checked (cli/type-check.ts),
 * whatever its Runs gave: errors of Solution and Lesson Tests, warnings of Starter.
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
  // Only the Lessons to check go into the build, and so into the Dependency
  // Artifact; never a Lesson with errors (BrokenLesson is for `codda dev`).
  const course = {
    ...wholeCourse,
    modules: wholeCourse.modules.map((module) => ({
      ...module,
      lessons: module.lessons.filter((lesson) => ids.includes(lesson.id) && !("errors" in lesson)),
    })),
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
  // Types are checked after the artifact is built, against its types.json; never in `dev` or `build`.
  const typeCheck = lessonTypeChecker(artifact.deps === null ? {} : JSON.parse(readFileSync(join(built, artifact.deps, "types.json"), "utf8")));

  // Imported only now: without node_modules, the npm step above installs it.
  const { chromium } = await import("playwright");
  const server = await serveFolder(built, `/${course.id}/`);
  let browser;
  try {
    browser = await chromium.launch({ channel: "chromium" });
    const context = await browser.newContext();
    // Every request of the page, its Worker and Sandbox included (as in
    // e2e/offline.ts); WebSockets are not routed. A request the Run awaited is
    // always caught: the route handler runs before the fetch rejects. One left
    // in flight when the Run ends may be cancelled with the Sandbox unseen.
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
      let warnings: string[] = [];
      if (lesson && !("errors" in lesson) && errors.length === 0) {
        const solution = await runIn(lesson, "solution");
        errors = [...verdict(lesson, solution.report), ...solution.foreign];
        if (errors.length === 0) {
          const starter = await runIn(lesson, "starter");
          errors = [...verdict(lesson, solution.report, starter.report), ...starter.foreign];
        }
        // Whatever the Runs gave: type errors go with the Run errors of the Lesson.
        const types = typeCheck(lesson);
        errors = [...errors, ...types.errors];
        warnings = types.warnings;
      }
      results.push({ id, errors, warnings });
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

/**
 * `codda dev`: the Course is built into `.codda/dev/` and served at `/` on
 * 127.0.0.1 with the reload script (static-server.ts). `fs.watch` over the
 * Course root (without node_modules/, .codda/, dist/): the events of ~100 ms
 * make one rebuild, then one `reload`. Every rebuild goes through the
 * Dependency Artifact: its cache makes an edit to a Lesson cheap, an edit to
 * package*.json misses the cache and runs its npm step before the reload.
 * Manifest errors do not stop it: they go into course.json (`errors`) and to
 * the terminal in the format of `codda test`. Runs until SIGINT, code 0.
 */
async function dev(): Promise<void> {
  if (args.length > 1) fail(`лишний аргумент ${args[1]}`);
  const port = typeof values.port === "string" ? Number(values.port) : 4173;
  if (!Number.isInteger(port) || port < 0 || port > 65535) fail(`неверный порт ${values.port}`);
  const found = findCourse(args[0] ?? ".");
  if (found === null) fail(`здесь нет курса: ${resolve(args[0] ?? ".")}`);
  const { root } = found;
  ensureUi();

  const served = join(root, ".codda", "dev");
  mkdirSync(served, { recursive: true });
  let server;
  try {
    server = await serveFolder(served, "/", { port, live: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
    fail(`порт ${port} занят: укажите другой, например --port 0`);
  }

  await devBuild(root, served);

  // One rebuild at a time; events during it make one more after it.
  let timer: NodeJS.Timeout | undefined;
  let building: Promise<void> | undefined;
  let again = false;
  const rebuild = async () => {
    if (building) {
      again = true;
      return;
    }
    building = devBuild(root, served).then(() => server.reload());
    await building;
    building = undefined;
    if (again) {
      again = false;
      await rebuild();
    }
  };
  const ignored = new Set(["node_modules", ".codda", "dist"]);
  const watcher = watch(root, { recursive: true }, (_, file) => {
    if (file !== null && ignored.has(file.split(/[\\/]/)[0])) return;
    clearTimeout(timer);
    timer = setTimeout(rebuild, 100);
  });

  process.once("SIGINT", async () => {
    watcher.close();
    clearTimeout(timer);
    await server.close();
    process.exit(0);
  });
  // Last: a test starts working with the server as soon as it sees the URL.
  process.stdout.write(`Курс: ${server.url}\nCtrl+C — остановить\n`);
}

/**
 * Builds the Course into `served` for `codda dev`, whatever its errors: a
 * Lesson with manifest errors is a BrokenLesson in course.json, errors of
 * course.yaml or of the whole Course (and of the Dependency Artifact) are its
 * top-level `errors`. The errors are printed as `codda test` prints them.
 */
async function devBuild(root: string, served: string): Promise<void> {
  const result = readCourse(root);
  let course: Omit<CourseData, "deps">;
  if ("course" in result) {
    course = result.course;
  } else if (result.partial) {
    const { course: partial, lessonErrors, courseErrors } = result.partial;
    process.stdout.write(courseErrors.map((line) => `${line}\n`).join(""));
    for (const [id, errors] of lessonErrors) {
      if (errors.length > 0) process.stdout.write(formatLesson({ id, errors, warnings: [] }));
    }
    course = courseErrors.length > 0 ? { ...partial, errors: result.errors } : partial;
  } else {
    process.stderr.write(result.errors.map((line) => `${line}\n`).join(""));
    course = { id: "", title: "", modules: [], errors: result.errors };
  }

  mkdirSync(join(root, ".codda"), { recursive: true });
  const staging = mkdtempSync(join(root, ".codda", "dev-"));
  try {
    const artifact = await assemble(root, course, staging);
    // No Lessons, so no artifact: the page shows its errors full-screen.
    if ("errors" in artifact) await assemble(root, { ...course, modules: [], errors: [...(course.errors ?? []), ...artifact.errors] }, staging);
    replaceFolder(served, staging);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
  if (!("errors" in result)) process.stdout.write("Курс собран без ошибок\n");
}

/**
 * Copies the template folder `name` into `dest`, `{{id}}` and `{{title}}`
 * replaced. `npmrc` and `gitignore` become dotfiles: npm never publishes a
 * package's own `.npmrc` and `.gitignore`. Returns the files written, relative
 * to `dest`.
 */
function copyTemplate(name: string, dest: string, vars: { id: string; title: string }): string[] {
  mkdirSync(dest, { recursive: true });
  return readdirSync(join(templatesDir, name)).map((file) => {
    const text = readFileSync(join(templatesDir, name, file), "utf8").replaceAll("{{id}}", vars.id).replaceAll("{{title}}", vars.title);
    const target = ["npmrc", "gitignore"].includes(file) ? `.${file}` : file;
    writeFileSync(join(dest, target), text);
    return target;
  });
}

/**
 * `codda init [путь]`: a new Course in an empty folder (`.git` allowed),
 * created when missing. Its id and title are the folder name. `codda` goes
 * into devDependencies — `file:` to this package when it does not run from
 * node_modules (this repository), its version otherwise — and `npm install`
 * installs it, so `npx codda test` works right away.
 */
function init(): number {
  if (args.length > 1) fail(`лишний аргумент ${args[1]}`);
  const ci = values.ci as string | undefined;
  if (ci !== undefined && !Object.hasOwn(CI_FILES, ci)) fail(`--ci: github или gitlab, а не ${ci}`);
  const dir = resolve(args[0] ?? ".");
  if (existsSync(dir)) {
    if (!statSync(dir).isDirectory()) fail(`${dir} — не папка`);
    if (readdirSync(dir).some((name) => name !== ".git")) fail(`папка ${dir} не пуста: курс создаётся только в пустой папке (можно с .git)`);
  }
  const id = basename(dir);
  if (!KEBAB_CASE.test(id)) {
    const hint = id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "my-course";
    fail(`имя папки «${id}» станет id курса и должно быть в kebab-case: переименуйте папку, например в ${hint}`);
  }

  mkdirSync(dir, { recursive: true });
  const files = copyTemplate("course", dir, { id, title: id });
  const packageDir = fileURLToPath(new URL("..", import.meta.url));
  const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  manifest.devDependencies = {
    codda: packageDir.split(sep).includes("node_modules") ? pkg.version : `file:${relative(realpathSync(dir), packageDir).split(sep).join("/")}`,
  };
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  files.push(...copyTemplate("lesson-ts", join(dir, "hello"), { id: "hello", title: "hello" }).map((file) => `hello/${file}`));
  if (ci !== undefined) {
    // The image of the template must ship Chromium for exactly this Playwright.
    const text = readFileSync(join(templatesDir, "ci", `${ci}.yml`), "utf8").replaceAll("{{playwright}}", pkg.dependencies.playwright);
    mkdirSync(dirname(join(dir, CI_FILES[ci])), { recursive: true });
    writeFileSync(join(dir, CI_FILES[ci]), text);
    files.push(CI_FILES[ci]);
  }
  process.stdout.write(`Курс ${id} создан в ${dir}:\n${files.map((file) => `  ${file}\n`).join("")}`);

  process.stdout.write("npm install…\n");
  const npm = spawnSync("npm", ["install", "--no-audit", "--no-fund"], { cwd: dir, encoding: "utf8" });
  if (npm.status !== 0) {
    process.stderr.write(`npm install: ${npm.stderr || npm.error?.message || ""}\n`);
    process.stderr.write("codda: не удалось установить codda в курс: файлы курса созданы, повторите npm install в его папке\n");
    return 2;
  }

  const cd = args[0] === undefined ? "" : `  cd ${args[0]}\n`;
  process.stdout.write(
    `Дальше:\n${cd}  npx codda test                       проверить курс\n` +
      "  npx codda lesson <id>                добавить урок\n" +
      "Для уроков на React: npm install react react-dom @types/react @types/react-dom, затем npx codda lesson <id> --tsx\n",
  );
  return 0;
}

/**
 * `codda lesson <id> [--module <название>] [--tsx]`: a new Lesson folder from
 * a template in the Course root, its id appended to `lessons` of the last
 * Module or of the Module titled exactly `--module`. course.yaml is edited as
 * a YAML document, so its comments and key order stay.
 */
function lesson(): number {
  if (args.length === 0) fail("укажите id урока: codda lesson <id>");
  if (args.length > 1) fail(`лишний аргумент ${args[1]}`);
  const [id] = args;
  const found = findCourse(".");
  if (found === null) fail(`здесь нет курса: ${resolve(".")}`);
  const { root } = found;
  const error = (message: string) => {
    process.stderr.write(`codda: ${message}\n`);
    return 1;
  };

  if (!KEBAB_CASE.test(id)) return error(`id урока «${id}» должен быть в kebab-case, например use-state`);

  const yamlPath = join(root, "course.yaml");
  const doc = parseDocument(readFileSync(yamlPath, "utf8"));
  if (doc.errors.length > 0) return error("course.yaml не читается как YAML: исправьте его (npx codda test покажет ошибки)");
  const modules = doc.get("modules");
  const items = isSeq(modules) ? modules.items.filter(isMap) : [];
  const listed = items.flatMap((item) => {
    const lessons = item.get("lessons");
    return isSeq(lessons) ? lessons.items.map((lesson) => (isScalar(lesson) ? lesson.value : lesson)) : [];
  });
  if (listed.includes(id)) return error(`урок ${id} уже указан в course.yaml`);
  if (existsSync(join(root, id))) return error(`папка ${id}/ уже есть`);
  const moduleTitle = typeof values.module === "string" ? values.module : undefined;
  const module = moduleTitle === undefined ? items.at(-1) : items.find((item) => item.get("title") === moduleTitle);
  if (module === undefined) {
    const titles = items.map((item) => `«${item.get("title")}»`).join(", ");
    return error(moduleTitle === undefined ? "в course.yaml нет ни одного модуля" : `в course.yaml нет модуля «${moduleTitle}»; модули: ${titles}`);
  }
  const lessons = module.get("lessons");
  if (!isSeq(lessons)) return error(`у модуля «${module.get("title")}» в course.yaml нет списка lessons`);

  if (values.tsx) {
    const manifest = join(root, "package.json");
    const dependencies = existsSync(manifest) ? (JSON.parse(readFileSync(manifest, "utf8")).dependencies ?? {}) : {};
    if (!("react" in dependencies && "react-dom" in dependencies)) {
      return error("для урока --tsx нужны react и react-dom в dependencies package.json курса: npm install react react-dom @types/react @types/react-dom");
    }
  }

  lessons.add(doc.createNode(id));
  const files = copyTemplate(values.tsx ? "lesson-tsx" : "lesson-ts", join(root, id), { id, title: id });
  writeFileSync(yamlPath, doc.toString({ flowCollectionPadding: false }));
  process.stdout.write(
    `Урок ${id} создан в модуле «${module.get("title")}»:\n${files.map((file) => `  ${id}/${file}\n`).join("")}` +
      `Проверить: npx codda test ${id}\n`,
  );
  return 0;
}
