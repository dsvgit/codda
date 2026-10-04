import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import type { CourseData } from "./course-data";

type Load = { state: "loading" } | { state: "failed" } | { state: "loaded"; course: CourseData };

/** `#/<lesson id>` → the id; no fragment → undefined, the first Lesson. */
function lessonIdFromHash(): string | undefined {
  return location.hash.startsWith("#/") ? decodeURIComponent(location.hash.slice(2)) : undefined;
}

// course.json lies next to the page in a Course Build (ADR-0008); `npm run dev`
// serves it from the Course in CODDA_COURSE (vite.config.ts).
function Root() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [lessonId, setLessonId] = useState(lessonIdFromHash);

  useEffect(() => {
    fetch("course.json", { cache: "no-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`course.json: HTTP ${response.status}`);
        return response.json() as Promise<CourseData>;
      })
      .then(
        (course) => setLoad({ state: "loaded", course }),
        () => setLoad({ state: "failed" }),
      );
  }, []);

  useEffect(() => {
    const onHashChange = () => setLessonId(lessonIdFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
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
      return <App course={load.course} lessonId={lessonId} />;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
