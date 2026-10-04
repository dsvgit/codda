// course.json: the boundary between a Course and the tool (ADR-0006, ADR-0008).
// `codda build` writes it from the Course folder, the UI loads it with fetch.
// The UI does not validate it: only our own `codda build` writes it.

export type CourseData = {
  id: string;
  title: string;
  modules: { title: string; lessons: LessonData[] }[];
};

export type LessonData = {
  id: string;
  title: string;
  /** HTML from the Markdown body of lesson.md; `codda build` escapes raw HTML and drops script links. */
  instructions: string;
  workspace: { name: "main.ts" | "main.tsx"; starter: string };
  solution: string;
  /** Lesson Tests; they import the Workspace as "./main". */
  tests: string;
};
