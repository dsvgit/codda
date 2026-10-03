import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { lessons } from "../courses";
import { App } from "./App";
import "./styles.css";

// Manual run of a course Lesson: /?lesson=react-hooks/01-use-state
const lessonId = new URLSearchParams(location.search).get("lesson");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App lesson={lessonId ? lessons[lessonId] : undefined} />
  </StrictMode>,
);
