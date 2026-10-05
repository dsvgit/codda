// The report of `codda test`: one line per Lesson — ✓ passed, ✗ errors,
// ⚠ warnings only — with its errors and warnings indented under it, and the
// summary line. Warnings do not fail a Lesson. With `color` (a TTY without
// NO_COLOR, cli/codda.ts) the mark is green, red or yellow.

export type LessonResult = { id: string; errors: string[]; warnings: string[] };

const COLORS = { "✓": 32, "✗": 31, "⚠": 33 };

export function formatLesson({ id, errors, warnings }: LessonResult, color = false): string {
  const mark = errors.length > 0 ? "✗" : warnings.length > 0 ? "⚠" : "✓";
  const shown = color ? `\x1b[${COLORS[mark]}m${mark}\x1b[0m` : mark;
  return [`${shown} ${id}`, ...[...errors, ...warnings].map((line) => `  ${line}`)].map((line) => `${line}\n`).join("");
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
