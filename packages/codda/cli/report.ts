// The report of `codda test`: one line per Lesson — ✓ passed, ✗ errors,
// ⚠ warnings only — with its errors and warnings indented under it, and the
// summary line. Warnings do not fail a Lesson.

export type LessonResult = { id: string; errors: string[]; warnings: string[] };

export function formatLesson({ id, errors, warnings }: LessonResult): string {
  const mark = errors.length > 0 ? "✗" : warnings.length > 0 ? "⚠" : "✓";
  return [`${mark} ${id}`, ...[...errors, ...warnings].map((line) => `  ${line}`)].map((line) => `${line}\n`).join("");
}

/** `N из M Lesson прошли[, K предупреждений]`; `otherWarnings` — those not of a Lesson (Dependency Artifact). */
export function formatSummary(lessons: LessonResult[], otherWarnings = 0): string {
  const passed = lessons.filter((lesson) => lesson.errors.length === 0).length;
  const warnings = lessons.reduce((sum, lesson) => sum + lesson.warnings.length, otherWarnings);
  const tail = warnings > 0 ? `, ${warnings} ${warningsWord(warnings)}` : "";
  return `${passed} из ${lessons.length} Lesson прошли${tail}\n`;
}

function warningsWord(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return "предупреждение";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "предупреждения";
  return "предупреждений";
}
