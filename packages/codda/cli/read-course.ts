// Course folder → course.json data, or the Course errors as lines
// `<file from the Course root>: <field path>: <message>` in Russian.
// Used by `codda build`; the tool's dev server takes it in lesson-manifest/01b.
// The full set of rules (missing Lessons and files, unlisted folders, repeated
// ids) is lesson-manifest/02.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "yaml";
import * as z from "zod";
import type { CourseData, LessonData } from "../src/course-data.ts";

z.config(z.locales.ru());

const kebabCase = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "ожидается kebab-case, например use-state");

const CourseYaml = z.strictObject({
  id: kebabCase,
  title: z.string().min(1),
  modules: z
    .array(z.strictObject({ title: z.string().min(1), lessons: z.array(kebabCase).min(1) }))
    .min(1),
});

const Frontmatter = z.strictObject({ title: z.string().min(1) });

type Result = { course: CourseData } | { errors: string[] };

/**
 * Parses YAML `text` from `file` and checks it with `schema`; problems go to
 * `errors`. `firstLine` is the line of `file` where `text` starts.
 */
function parseYaml<T>(file: string, text: string, schema: z.ZodType<T>, errors: string[], firstLine = 1): T | undefined {
  const doc = parseDocument(text, { prettyErrors: false });
  if (doc.errors.length > 0) {
    for (const e of doc.errors) errors.push(`${file}: строка ${(e.linePos?.[0].line ?? 1) + firstLine - 1}: ${e.message}`);
    return undefined;
  }
  const parsed = schema.safeParse(doc.toJS());
  if (parsed.success) return parsed.data;
  for (const issue of parsed.error.issues) {
    const path = z.core.toDotPath(issue.path);
    errors.push(path ? `${file}: ${path}: ${issue.message}` : `${file}: ${issue.message}`);
  }
  return undefined;
}

function readLesson(root: string, id: string, errors: string[]): LessonData | undefined {
  const dir = join(root, id);
  const read = (name: string) => readFileSync(join(dir, name), "utf8");

  const md = read("lesson.md").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!md) {
    errors.push(`${id}/lesson.md: нет frontmatter между строками ---`);
    return undefined;
  }
  const front = parseYaml(`${id}/lesson.md`, md[1], Frontmatter, errors, 2);
  if (!front) return undefined;

  const ext = existsSync(join(dir, "main.tsx")) ? "tsx" : "ts";
  const testsExt = existsSync(join(dir, "lesson.test.tsx")) ? "tsx" : "ts";
  return {
    id,
    title: front.title,
    instructions: md[2].replace(/^\r?\n/, ""),
    workspace: { name: `main.${ext}`, starter: read(`main.${ext}`) },
    solution: read(`solution.${ext}`),
    tests: read(`lesson.test.${testsExt}`),
  };
}

export function readCourse(root: string): Result {
  const errors: string[] = [];
  const yaml = parseYaml("course.yaml", readFileSync(join(root, "course.yaml"), "utf8"), CourseYaml, errors);
  if (!yaml) return { errors };

  const course: CourseData = {
    id: yaml.id,
    title: yaml.title,
    modules: yaml.modules.map((module) => ({
      title: module.title,
      lessons: module.lessons.flatMap((id) => readLesson(root, id, errors) ?? []),
    })),
  };
  return errors.length > 0 ? { errors } : { course };
}
