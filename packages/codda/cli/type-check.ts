// The type check of `codda test` (ADR-0009): the core of the Type Checker
// (src/type-checker/core.ts) in Node, with TypeScript 6, the lib files of
// `typescript-6` and types.json of the Course's fresh Dependency Artifact.
// For each Lesson two checks: its Solution as the Starter's name ("main.*",
// which the Lesson Tests import as "./main") with its Lesson Tests and the
// declaration of "@codda/test" — errors; and its Starter alone, as the
// student's editor sees it — warnings.
import { readFileSync } from "node:fs";
import ts from "typescript-6";
import type { LessonData } from "../src/course-data.ts";
import { createTypeEnvironment, type TypeEnvironment } from "../src/type-checker/core.ts";
import { solutionName } from "./read-course.ts";
import { tsLibFiles } from "./ts-lib.ts";

const CODDA_TEST = readFileSync(new URL("../src/runtime/codda-test.d.ts", import.meta.url), "utf8");

/** `types`: the parsed types.json of the artifact, or {} for a Course without packages. */
export function lessonTypeChecker(types: Record<string, string>) {
  const lib = tsLibFiles();
  // The default import of CommonJS TS 6; under NodeNext the core's `import type *` adds `default`.
  const checker = ts as never;
  // Two environments: the Starter's must not see "@codda/test" or the Lesson Tests.
  const withTests = createTypeEnvironment(checker, { ...lib, ...types, "/node_modules/@codda/test/index.d.ts": CODDA_TEST });
  const alone = createTypeEnvironment(checker, { ...lib, ...types });

  return (lesson: LessonData): { errors: string[]; warnings: string[] } => {
    const main = lesson.workspace.name;
    withTests.setFiles({ [main]: lesson.solution, [lesson.testsName]: lesson.tests });
    alone.setFiles({ [main]: lesson.workspace.starter });
    return {
      errors: [...lines(withTests, main, `${lesson.id}/${solutionName(main)}`), ...lines(withTests, lesson.testsName, `${lesson.id}/${lesson.testsName}`)],
      warnings: lines(alone, main, `${lesson.id}/${main}`),
    };
  };
}

/** `<file from the Course root>:<line>:<column> — <message> (TS<code>)`, one line per error. */
function lines(env: TypeEnvironment, name: string, file: string): string[] {
  return env
    .errors(name)
    .map(({ line, column, message, code }) => `${file}:${line}:${column} — ${message.split("\n").map((part) => part.trim()).join(" ")} (TS${code})`);
}
