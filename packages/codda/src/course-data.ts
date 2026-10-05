// course.json: the boundary between a Course and the tool (ADR-0006, ADR-0008).
// `codda build` writes it from the Course folder, the UI loads it with fetch.
// The UI does not validate it: only our own `codda build` writes it.
// `errors` (top-level and of a Lesson) is only ever in the course.json of
// `codda dev`: `build` and `test` refuse a Course with manifest errors.

export type CourseData = {
  id: string;
  title: string;
  modules: { title: string; lessons: (LessonData | BrokenLesson)[] }[];
  /**
   * Folder of the Course's Dependency Artifact relative to the page,
   * `deps/<hash>/` with importmap.json in it; null if no Lesson imports a package.
   */
  deps: string | null;
  /** `codda dev`: errors of course.yaml or of the Course as a whole, shown full-screen. */
  errors?: string[];
};

/** `codda dev`: a Lesson with manifest errors, in place of its content. `title` is its id. */
export type BrokenLesson = { id: string; title: string; errors: string[] };

export type LessonData = {
  id: string;
  title: string;
  /** HTML from the Markdown body of lesson.md; `codda build` escapes raw HTML and drops script links. */
  instructions: string;
  workspace: { name: "main.ts" | "main.tsx"; starter: string };
  solution: string;
  /** Lesson Tests; they import the Workspace as "./main". */
  tests: string;
  /** The Lesson Tests' file name: its extension picks how they compile. */
  testsName: "lesson.test.ts" | "lesson.test.tsx";
};
