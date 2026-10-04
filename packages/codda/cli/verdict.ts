// The verdict of a Lesson in `codda test`: the Test Reports of its Solution
// and Starter → errors, each `<file from the Course root>: <message>`. Solution
// must pass ≥1 test and all of them; Starter must fail at least one. Any other
// kind of report (compile error, runtime error, timeout, cancelled, internal
// error) is an error for both. Without a Starter report (the Solution failed)
// only the Solution is judged.
import type { LessonData } from "../src/course-data.ts";
import type { TestReport } from "../src/runtime/types.ts";

export function verdict(
  lesson: Pick<LessonData, "id"> & { workspace: Pick<LessonData["workspace"], "name"> },
  solution: TestReport,
  starter?: TestReport,
): string[] {
  const solutionFile = `${lesson.id}/${lesson.workspace.name.replace("main", "solution")}`;
  const starterFile = `${lesson.id}/${lesson.workspace.name}`;

  if (solution.kind !== "tests") return broken(solutionFile, solution);
  if (solution.results.length === 0) return [`${solutionFile}: в Lesson Tests нет ни одного теста`];
  const failed = solution.results.filter((r) => r.status === "fail");
  if (failed.length > 0) return failed.map((r) => `${solutionFile}: тест «${r.name}» не прошёл: ${r.error ?? ""}`);

  if (starter === undefined) return [];
  if (starter.kind !== "tests") return broken(starterFile, starter);
  if (starter.results.every((r) => r.status === "pass")) return [`${starterFile}: Starter уже проходит все тесты`];
  return [];
}

function broken(file: string, report: Exclude<TestReport, { kind: "tests" }>): string[] {
  switch (report.kind) {
    case "compile-error":
      return report.errors.map((e) => `${file}: ${e.line ? `строка ${e.line}: ` : ""}ошибка компиляции: ${e.message}`);
    case "runtime-error":
      return [`${file}: ошибка при выполнении: ${report.message}`];
    case "timeout":
      return [`${file}: тесты не завершились за ${report.ms / 1000} с`];
    case "cancelled":
      return [`${file}: Run отменён`];
    case "internal-error":
      return [`${file}: внутренняя ошибка: ${report.message}`];
  }
}
