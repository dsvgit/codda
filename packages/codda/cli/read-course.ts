// Course folder → course.json data, or the Course errors as lines
// `<file from the Course root>: <field path>: <message>` in Russian, all of
// them in one run: course.yaml first, then the Lessons in course.yaml order.
// Used by `codda build` and the tool's dev server (vite.config.ts).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Marked, Renderer } from "marked";
import { LineCounter, parseDocument } from "yaml";
import * as z from "zod";
import type { CourseData, LessonData } from "../src/course-data.ts";

z.config(z.locales.ru());

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const kebabCase = z.string().regex(KEBAB_CASE, "ожидается kebab-case, например use-state");

const CourseYaml = z.strictObject({
  id: kebabCase,
  title: z.string().min(1),
  modules: z
    .array(z.strictObject({ title: z.string().min(1), lessons: z.array(kebabCase).min(1) }))
    .min(1),
});

const Frontmatter = z.strictObject({ title: z.string().min(1) });

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Instructions: CommonMark + GFM → HTML, once, in `codda build`; the UI
// inserts it as is. Raw HTML in the Markdown is shown as text, never as tags.
const markdown = new Marked({
  gfm: true,
  renderer: {
    html: ({ text, block }) => (block ? `<p>${escapeHtml(text.trim())}</p>\n` : escapeHtml(text)),
    // External links open in a new tab; `#/…` and other links inside the site do not.
    // The HTML goes into our own page, so a link with any other scheme
    // (javascript:, data:, …) is only its text. Browsers ignore tabs, newlines
    // and leading spaces in a URL, so they are dropped before the check.
    link(token) {
      const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(token.href.replace(/[\x00-\x20]/g, ""))?.[1];
      if (scheme && !/^(https?|mailto)$/i.test(scheme)) return this.parser.parseInline(token.tokens);
      const html = Renderer.prototype.link.call(this, token);
      return /^https?:\/\//i.test(token.href) ? html.replace(">", ' target="_blank" rel="noopener">') : html;
    },
  },
});

// `deps` is added by whoever builds the Dependency Artifact (codda build, the dev server).
type Result = { course: Omit<CourseData, "deps"> } | { errors: string[] };

// The `yaml` package reports syntax errors in English.
const yamlMessages: Record<string, string> = {
  DUPLICATE_KEY: "ключ повторяется",
  BAD_INDENT: "неверный отступ",
  TAB_AS_INDENT: "табуляция в отступе, нужны пробелы",
  MISSING_CHAR: "не закрыта кавычка или скобка",
};

/**
 * Parses YAML `text` from `file`; syntax errors go to `errors` with the line
 * number. `firstLine` is the line of `file` where `text` starts.
 */
function parseYaml(file: string, text: string, errors: string[], firstLine = 1): { value: unknown } | undefined {
  const lines = new LineCounter();
  const doc = parseDocument(text, { prettyErrors: false, lineCounter: lines });
  if (doc.errors.length === 0) return { value: doc.toJS() ?? {} };
  const found = doc.errors.map((e) => {
    const line = lines.linePos(e.pos[0]).line + firstLine - 1;
    return `${file}: строка ${line}: ${yamlMessages[e.code] ?? "ошибка синтаксиса YAML"}`;
  });
  errors.push(...new Set(found));
  return undefined;
}

/** Checks `value` read from `file` with `schema`; problems go to `errors`. */
function check<T>(file: string, value: unknown, schema: z.ZodType<T>, errors: string[]): T | undefined {
  const parsed = schema.safeParse(value, { reportInput: true });
  if (parsed.success) return parsed.data;
  for (const issue of parsed.error.issues) {
    const path = z.core.toDotPath(issue.path);
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) errors.push(`${file}: ${path ? `${path}.` : ""}${key}: неизвестное поле`);
    } else {
      errors.push(path ? `${file}: ${path}: ${message(issue)}` : `${file}: ${message(issue)}`);
    }
  }
  return undefined;
}

const typeNames: Record<string, string> = { string: "строка", array: "список", object: "объект" };

/** Zod's ru locale names types in English ("ожидалось string"), so the common issues get our own words. */
function message(issue: z.core.$ZodIssue): string {
  if (issue.code === "invalid_type") return issue.input == null ? "обязательное поле" : `ожидается ${typeNames[issue.expected] ?? issue.expected}`;
  if (issue.code === "too_small") return issue.origin === "array" ? "список не может быть пустым" : "не может быть пустым";
  return issue.message;
}

/**
 * Lesson ids as course.yaml lists them, even when another field of course.yaml
 * is invalid: the Lessons are still checked, so all errors show in one run.
 */
function listedLessons(value: unknown): { id: unknown; path: string }[] {
  const modules = (value as { modules?: unknown }).modules;
  if (!Array.isArray(modules)) return [];
  return modules.flatMap((module: { lessons?: unknown } | null, i) => {
    const lessons = module?.lessons;
    return Array.isArray(lessons) ? lessons.map((id: unknown, j) => ({ id, path: `modules[${i}].lessons[${j}]` })) : [];
  });
}

const isDirectory = (path: string) => statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false;

function readLesson(root: string, id: string, errors: string[]): LessonData | undefined {
  const dir = join(root, id);
  const has = (name: string) => existsSync(join(dir, name));
  const read = (name: string) => readFileSync(join(dir, name), "utf8");
  const errorsBefore = errors.length;

  let title = "";
  let instructions = "";
  if (!has("lesson.md")) {
    errors.push(`${id}/: нет lesson.md`);
  } else {
    const md = read("lesson.md").match(/^---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)([\s\S]*)$/);
    if (!md) {
      errors.push(`${id}/lesson.md: нет frontmatter между строками ---`);
    } else {
      const yaml = parseYaml(`${id}/lesson.md`, md[1] ?? "", errors, 2);
      const front = yaml && check(`${id}/lesson.md`, yaml.value, Frontmatter, errors);
      title = front?.title ?? "";
      const body = md[2];
      const bodyLine = md.input!.slice(0, md.input!.length - body.length).split("\n").length;
      const tokens = markdown.lexer(body);
      // Tokens carry no line numbers: find each image's `raw` in the body, in order.
      let from = 0;
      markdown.walkTokens(tokens, (token) => {
        if (token.type !== "image") return;
        const at = body.indexOf(token.raw, from);
        from = at + token.raw.length;
        const line = bodyLine + body.slice(0, at).split("\n").length - 1;
        errors.push(`${id}/lesson.md: строка ${line}: картинки в Instructions не поддерживаются`);
      });
      instructions = markdown.parser(tokens);
    }
  }

  const mains = (["main.ts", "main.tsx"] as const).filter(has);
  if (mains.length === 0) errors.push(`${id}/: нет main.ts или main.tsx`);
  if (mains.length === 2) errors.push(`${id}/: есть и main.ts, и main.tsx — нужен один`);
  const solution = mains.length === 1 ? mains[0].replace("main", "solution") : undefined;
  if (solution && !has(solution)) errors.push(`${id}/: нет ${solution} — расширение как у ${mains[0]}`);

  const tests = ["lesson.test.ts", "lesson.test.tsx"].filter(has);
  if (tests.length === 0) errors.push(`${id}/: нет lesson.test.ts или lesson.test.tsx`);
  if (tests.length === 2) errors.push(`${id}/: есть и lesson.test.ts, и lesson.test.tsx — нужен один`);

  if (errors.length > errorsBefore || !solution) return undefined;
  return {
    id,
    title,
    instructions,
    workspace: { name: mains[0], starter: read(mains[0]) },
    solution: read(solution),
    tests: read(tests[0]),
  };
}

export function readCourse(root: string): Result {
  const errors: string[] = [];
  const raw = parseYaml("course.yaml", readFileSync(join(root, "course.yaml"), "utf8"), errors);
  if (!raw) return { errors };
  const yaml = check("course.yaml", raw.value, CourseYaml, errors);

  // course.yaml against the folders on disk.
  const listed = listedLessons(raw.value);
  const lessonPathById = new Map<string, string>();
  for (const { id, path } of listed) {
    if (typeof id !== "string" || !KEBAB_CASE.test(id)) continue; // reported by the schema
    const first = lessonPathById.get(id);
    if (first) {
      errors.push(`course.yaml: ${path}: урок ${id} уже указан в ${first}`);
      continue;
    }
    lessonPathById.set(id, path);
    if (!isDirectory(join(root, id))) errors.push(`course.yaml: ${path}: нет папки урока ${id}`);
  }
  // A folder with lesson.md is a Lesson; others (node_modules/, dist/) are not.
  // With no Lesson listed at all, the schema error already says it all.
  if (listed.length > 0) {
    const listedIds = new Set(listed.map(({ id }) => id));
    const unlisted = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !listedIds.has(entry.name) && existsSync(join(root, entry.name, "lesson.md")))
      .map((entry) => entry.name)
      .sort();
    for (const id of unlisted) errors.push(`${id}/lesson.md: урок ${id} не указан в course.yaml`);
  }

  const lessons = new Map<string, LessonData | undefined>();
  for (const id of lessonPathById.keys()) {
    if (isDirectory(join(root, id))) lessons.set(id, readLesson(root, id, errors));
  }

  if (errors.length > 0 || !yaml) return { errors };
  return {
    course: {
      id: yaml.id,
      title: yaml.title,
      modules: yaml.modules.map((module) => ({
        title: module.title,
        lessons: module.lessons.map((id) => lessons.get(id)!),
      })),
    },
  };
}
