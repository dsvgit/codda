// Course lookup shared by the commands: `course.yaml` is searched upwards
// from the given path; a path inside a Lesson folder also names that Lesson.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";
import { findCourse } from "./find-course.ts";
import { tsCourse } from "./test-helpers.ts";

test("the Course root itself: the root, no Lesson", () => {
  const course = tsCourse();

  expect(findCourse(course)).toEqual({ root: course, lessonId: undefined });
});

test("a Lesson folder or a folder inside it: the root and the Lesson id", () => {
  const course = tsCourse();
  mkdirSync(join(course, "greet", "notes"));

  expect(findCourse(join(course, "greet"))).toEqual({ root: course, lessonId: "greet" });
  expect(findCourse(join(course, "greet", "notes"))).toEqual({ root: course, lessonId: "greet" });
});

test("no course.yaml here or above: null", () => {
  expect(findCourse(dirname(tsCourse()))).toBeNull();
});
