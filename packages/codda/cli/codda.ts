#!/usr/bin/env node
// codda CLI. Runs as TypeScript directly in Node 24, without a build step
// (.scratch/mvp/issues/05-codda-cli-commands.md). So far the minimal `build`
// (lesson-manifest); the full `build` and the commands init/lesson/test/dev
// come with the author-cli feature.
//
// Exit codes: 0 — success, 1 — errors in the Course, 2 — environment or
// invocation (unknown command or flag, no course.yaml, no built UI).
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import pkg from "../package.json" with { type: "json" };
import { buildDependencyArtifact } from "./dependency-artifact.ts";
import { readCourse } from "./read-course.ts";

const HELP = `Использование: codda [флаги]
       codda build <путь к курсу> [--out <папка>]

Инструмент автора курсов codda.

Команды:
  build          собрать курс в папку статических файлов (по умолчанию <путь>/dist)

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

if (command === "build") await build();
else if (values.version) process.stdout.write(`${pkg.version}\n`);
else process.stdout.write(HELP);

async function build() {
  if (args.length === 0) fail("не указан путь к курсу: codda build <путь>");
  if (args.length > 1) fail(`лишний аргумент ${args[1]}`);
  const root = resolve(args[0]);
  const out = resolve(typeof values.out === "string" ? values.out : join(root, "dist"));

  if (!existsSync(join(root, "course.yaml"))) fail(`нет course.yaml в ${root}`);
  if (!existsSync(join(uiDir, "index.html"))) fail(`нет собранного UI в ${uiDir}: выполните npm run build`);

  const result = readCourse(root);
  if ("errors" in result) {
    process.stderr.write(result.errors.map((line) => `${line}\n`).join(""));
    process.exit(1);
  }

  const lessonIds = result.course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id));
  const artifact = await buildDependencyArtifact(root, lessonIds, out);
  if ("errors" in artifact) {
    process.stderr.write(artifact.errors.map((line) => `${line}\n`).join(""));
    process.exit(1);
  }

  mkdirSync(out, { recursive: true });
  cpSync(uiDir, out, { recursive: true });
  writeFileSync(join(out, "course.json"), JSON.stringify({ ...result.course, deps: artifact.deps }));
  process.stdout.write(`Курс собран в ${out}\n`);
}
