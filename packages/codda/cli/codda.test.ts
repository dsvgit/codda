// The CLI as an Author calls it: `npx codda …` from the repository root and
// from a Course folder, where npm finds the `codda` bin of the workspace.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import pkg from "../package.json" with { type: "json" };

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const coursesDir = fileURLToPath(new URL("../../../courses", import.meta.url));

function codda(cwd: string, ...args: string[]) {
  const { status, stdout, stderr } = spawnSync("npx", ["codda", ...args], { cwd, encoding: "utf8" });
  return { status, stdout, stderr };
}

test.each([
  ["the repository root", repoRoot],
  ["courses/", coursesDir],
])("`npx codda --version` from %s prints the package version", (_, cwd) => {
  const { status, stdout } = codda(cwd, "--version");

  expect(status).toBe(0);
  expect(stdout.trim()).toBe(pkg.version);
});

test("`--help` prints usage in Russian and exits 0", () => {
  const { status, stdout } = codda(repoRoot, "--help");

  expect(status).toBe(0);
  expect(stdout).toContain("Использование: codda");
  expect(stdout).toContain("--version");
});

test("without arguments prints the same help and exits 0", () => {
  expect(codda(repoRoot)).toEqual(codda(repoRoot, "--help"));
});

test("an unknown flag exits 2 and names the flag", () => {
  const { status, stdout, stderr } = codda(repoRoot, "--bogus");

  expect(status).toBe(2);
  expect(stdout).toBe("");
  expect(stderr).toContain("неизвестный флаг --bogus");
  expect(stderr).toContain("codda --help");
});

test("an unknown command exits 2 and names the command", () => {
  const { status, stderr } = codda(repoRoot, "bogus");

  expect(status).toBe(2);
  expect(stderr).toContain("неизвестная команда bogus");
});

test("a short unknown flag exits 2 as well", () => {
  const { status, stderr } = codda(repoRoot, "-x");

  expect(status).toBe(2);
  expect(stderr).toContain("неизвестный флаг -x");
});
