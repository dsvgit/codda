import type { LessonData } from "./course-data";

/**
 * What the student did in one Course, kept in the browser (spec course-ux):
 * `localStorage` keys `codda:<course id>/<lesson id>:…`, a key per Lesson.
 * GitHub Pages gives every repository of the owner the same origin, hence the
 * `codda:` prefix. Any access to `localStorage` may throw (blocked, full): the
 * screen keeps working, the text stays in memory until the page reloads, and
 * `failed()` turns true for the warning above the editor.
 */
export type CourseStorage = ReturnType<typeof courseStorage>;

export function courseStorage(courseId: string) {
  // Once the storage has failed, every Workspace of the page is kept here too.
  const inMemory = new Map<string, string>();
  let failed = false;
  const listeners = new Set<() => void>();
  const fail = () => {
    if (failed) return;
    failed = true;
    for (const listener of listeners) listener();
  };
  const workspaceKey = (lesson: LessonData) => `codda:${courseId}/${lesson.id}:workspace`;

  return {
    /** A storage error has happened on this page: nothing is saved for sure. */
    failed: () => failed,
    /** `listener` is called once, on the first error of a write. */
    onFailure(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /**
     * The saved Workspace of `lesson`, or else its Starter. Called while the
     * Lesson renders: a read error does not call the listeners, the caller sees
     * it in `failed()` itself.
     */
    workspace(lesson: LessonData): string {
      const key = workspaceKey(lesson);
      const kept = inMemory.get(key);
      if (kept !== undefined) return kept;
      try {
        return localStorage.getItem(key) ?? lesson.workspace.starter;
      } catch {
        failed = true;
        return lesson.workspace.starter;
      }
    },
    /** Saves the Workspace of `lesson`; one equal to the Starter is not kept, its key goes away. */
    saveWorkspace(lesson: LessonData, text: string) {
      const key = workspaceKey(lesson);
      try {
        if (text === lesson.workspace.starter) localStorage.removeItem(key);
        else localStorage.setItem(key, text);
      } catch {
        fail();
      }
      if (failed) inMemory.set(key, text);
    },
  };
}
