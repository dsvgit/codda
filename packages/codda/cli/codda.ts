#!/usr/bin/env node
// codda CLI. Runs as TypeScript directly in Node 24, without a build step
// (.scratch/mvp/issues/05-codda-cli-commands.md). So far `build`; the commands
// init/lesson/test/dev come with the rest of the author-cli feature.
//
// Exit codes: 0 — success, 1 — errors in the Course, 2 — environment or
// invocation (unknown command or flag, no course.yaml, the UI build failed,
// --out that is not a codda build).
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import pkg from "../package.json" with { type: "json" };
import { buildDependencyArtifact } from "./dependency-artifact.ts";
import { findCourse } from "./find-course.ts";
import { readCourse } from "./read-course.ts";
import { buildUi, UI_HASH_FILE, uiIsFresh } from "./ui-build.ts";

const HELP = `Использование: codda [флаги]
       codda build [путь] [--out <папка>]

Инструмент автора курсов codda.

Команды:
  build          собрать курс в папку статических файлов (по умолчанию <курс>/dist);
                 курс — путь или папка с course.yaml выше текущей

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

if (command !== undefined && command !== "build") fail(`неизвестная команда ${command}`);
for (const token of tokens) {
  if (token.kind !== "option") continue;
  if (!(token.name in options) || (token.name === "out" && command !== "build")) fail(`неизвестный флаг ${token.rawName}`);
  const takesValue = options[token.name as keyof typeof options].type === "string";
  if (takesValue && token.value === undefined) fail(`флагу ${token.rawName} нужно значение`);
  if (!takesValue && token.value !== undefined) fail(`флаг ${token.rawName} не принимает значение`);
}

if (command === "build") process.exitCode = await build();
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

  if (!uiIsFresh(uiDir)) {
    process.stdout.write("Собираю UI codda…\n");
    const failure = buildUi(uiDir);
    if (failure !== null) {
      process.stderr.write(failure);
      fail(`не удалось собрать UI codda в ${uiDir}`);
    }
  }

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
    const lessonIds = result.course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id));
    const artifact = await buildDependencyArtifact(root, lessonIds, staging);
    if ("errors" in artifact) {
      process.stderr.write(artifact.errors.map((line) => `${line}\n`).join(""));
      return 1;
    }
    if (artifact.deps !== null) {
      process.stdout.write(`${artifact.log}\n`);
      process.stderr.write(artifact.warnings.map((line) => `${line}\n`).join(""));
    }
    cpSync(uiDir, staging, { recursive: true, filter: (path) => basename(path) !== UI_HASH_FILE });
    writeFileSync(join(staging, "course.json"), JSON.stringify({ ...result.course, deps: artifact.deps }));
    writeFileSync(join(staging, MARKER), "Сборка курса codda: `codda build` заменяет эту папку целиком.\n");
    const files = readdirSync(staging, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => relative(staging, join(entry.parentPath, entry.name)))
      .sort();

    rmSync(out, { recursive: true, force: true });
    mkdirSync(dirname(out), { recursive: true });
    try {
      renameSync(staging, out);
    } catch (error) {
      // --out on another disk than the Course: rename cannot move across them.
      if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
      cpSync(staging, out, { recursive: true });
    }
    process.stdout.write(files.map((file) => `${file}\n`).join(""));
    process.stdout.write(`Курс собран в ${out}, файлов: ${files.length}\n`);
    return 0;
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}
