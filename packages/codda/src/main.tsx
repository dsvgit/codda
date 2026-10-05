import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App, runLesson } from "./App";
import type { CourseData, LessonData } from "./course-data";
import { run } from "./runtime/runner";

/**
 * The service page of `codda test` (cli/codda.ts): `#/__codda-test` is never a
 * Lesson id (`_` is not kebab-case), and nothing in the UI links to it. Node
 * drives the Runs through Playwright with these two functions on `window`.
 */
const TEST_PAGE = "__codda-test";

function installTestPage(course: CourseData) {
  const lessons = course.modules.flatMap((m) => m.lessons);
  Object.assign(window, {
    __codda: {
      /** A Run of empty code, so the first Lesson does not pay for a cold Compiler. */
      warmUp: async () => {
        await run({ source: "", tests: "" });
      },
      run: (lessonId: string, which: "solution" | "starter") => {
        // `codda test` never builds a BrokenLesson.
        const lesson = lessons.find((l) => l.id === lessonId) as LessonData;
        return runLesson(course, lesson, which === "solution" ? lesson.solution : lesson.workspace.starter);
      },
    },
  });
}

type Load = { state: "loading" } | { state: "failed" } | { state: "loaded"; course: CourseData };

/** Opened as the service page: decided once, the Lesson screen is not drawn at all. */
const testPage = location.hash === `#/${TEST_PAGE}`;

// course.json lies next to the page in a Course Build (ADR-0008); `npm run dev`
// serves it from the Course in CODDA_COURSE (vite.config.ts).
function Root() {
  const [load, setLoad] = useState<Load>({ state: "loading" });

  useEffect(() => {
    fetch("course.json", { cache: "no-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`course.json: HTTP ${response.status}`);
        return response.json() as Promise<CourseData>;
      })
      .then(
        (course) => {
          if (testPage) installTestPage(course);
          setLoad({ state: "loaded", course });
        },
        () => setLoad({ state: "failed" }),
      );
  }, []);

  switch (load.state) {
    case "loading":
      return <p className="status">Загрузка курса…</p>;
    case "failed":
      return (
        <div className="status">
          <p>Не удалось загрузить курс</p>
          <button onClick={() => location.reload()}>Обновить</button>
        </div>
      );
    case "loaded":
      if (testPage) return <p className="status">Служебная страница codda test</p>;
      // The Lesson screen follows the fragment `#/<lesson id>` itself.
      return <App course={load.course} />;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
