#!/usr/bin/env node
// codda CLI. Runs as TypeScript directly in Node 24, without a build step
// (.scratch/mvp/issues/05-codda-cli-commands.md). So far only the skeleton:
// the commands init/lesson/test/dev/build come with the author-cli feature.
//
// Exit codes: 0 — success, 1 — errors in the Course, 2 — environment or
// invocation (unknown command or flag).
import { parseArgs } from "node:util";
import pkg from "../package.json" with { type: "json" };

const HELP = `Использование: codda [флаги]

Инструмент автора курсов codda.

Флаги:
  -h, --help     показать эту справку
  -v, --version  показать версию
`;

const options = {
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
} as const;

function fail(message: string): never {
  process.stderr.write(`codda: ${message}\nСправка: codda --help\n`);
  process.exit(2);
}

// strict: false, so unknown flags and commands get our own message in Russian
// instead of parseArgs' English TypeError.
const { values, tokens } = parseArgs({ options, strict: false, allowPositionals: true, tokens: true });

for (const token of tokens) {
  if (token.kind === "positional") fail(`неизвестная команда ${token.value}`);
  if (token.kind === "option" && !(token.name in options)) fail(`неизвестный флаг ${token.rawName}`);
  if (token.kind === "option" && token.value !== undefined) fail(`флаг ${token.rawName} не принимает значение`);
}

if (values.version) process.stdout.write(`${pkg.version}\n`);
else process.stdout.write(HELP);
