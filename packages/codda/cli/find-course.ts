// Course lookup for the commands, except `init`: `course.yaml` is searched
// upwards from the given path. A path inside a Lesson folder also names that
// Lesson (the first folder below the Course root).
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

export function findCourse(path: string): { root: string; lessonId: string | undefined } | null {
  const start = resolve(path);
  for (let dir = start; ; dir = dirname(dir)) {
    if (existsSync(join(dir, "course.yaml"))) {
      const [lessonId] = relative(dir, start).split(sep);
      return { root: dir, lessonId: lessonId || undefined };
    }
    if (dirname(dir) === dir) return null;
  }
}
