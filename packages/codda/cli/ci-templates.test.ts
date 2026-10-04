// `codda init --ci github|gitlab`: the CI template of a new Course repository.
// The test runs `init` as a process (the template is substituted there), then
// parses the written file with `yaml` and checks its jobs, the order of the
// `codda` commands and that the deploy runs only on `main`.
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { parse } from "yaml";
import pkg from "../package.json" with { type: "json" };
import { runCodda } from "./test-helpers.ts";

const LONG = { timeout: 120_000 };
const playwright = pkg.dependencies.playwright;

/** `codda init --ci <kind>` into a new folder; returns the folder and the result. */
function initWithCi(kind: string) {
  const course = join(realpathSync(mkdtempSync(join(tmpdir(), "codda-ci-"))), "my-course");
  return { course, ...runCodda(join(course, ".."), ["init", "my-course", "--ci", kind]) };
}

/** The `codda` commands of a list of shell lines, in order. */
const coddaCommands = (lines: string[]) => lines.filter((line) => /^(npm ci|npx codda)/.test(line));

test("init --ci github: .github/workflows/codda.yml — check in the Playwright image, Pages deploy only on push to main", LONG, () => {
  const { course, status, stdout, stderr } = initWithCi("github");

  expect(stderr).toBe("");
  expect(status).toBe(0);
  expect(stdout).toContain(".github/workflows/codda.yml\n");
  expect(existsSync(join(course, ".gitlab-ci.yml"))).toBe(false);
  const text = readFileSync(join(course, ".github/workflows/codda.yml"), "utf8");
  expect(text).not.toContain("{{playwright}}");
  const workflow = parse(text);

  expect(Object.keys(workflow.on).sort()).toEqual(["pull_request", "push"]);
  expect(workflow.on.push.branches).toEqual(["main"]);
  expect(Object.keys(workflow.jobs)).toEqual(["check", "deploy"]);

  const { check, deploy } = workflow.jobs;
  expect(check.container.image).toBe(`mcr.microsoft.com/playwright:v${playwright}-noble`);
  const runs = check.steps.filter((step: { run?: string }) => step.run).map((step: { run: string }) => step.run);
  expect(coddaCommands(runs)).toEqual(["npm ci", "npx codda test", "npx codda build"]);
  const upload = check.steps.at(-1);
  expect(upload.uses).toMatch(/^actions\/upload-pages-artifact@/);
  expect(upload.with.path).toBe("dist/");

  const onMain = "github.event_name == 'push' && github.ref == 'refs/heads/main'";
  expect(upload.if).toBe(onMain);
  expect(deploy.if).toBe(onMain);
  expect(deploy.needs).toBe("check");
  expect(deploy.permissions).toEqual({ pages: "write", "id-token": "write" });
  expect(deploy.environment.name).toBe("github-pages");
  expect(deploy.concurrency.group).toBeTruthy();
  expect(deploy.steps.map((step: { uses?: string }) => step.uses)).toEqual([expect.stringMatching(/^actions\/deploy-pages@/)]);
});

test("init --ci gitlab: .gitlab-ci.yml — check with $CODDA_IMAGE keeps dist/, S3 deploy only on main", LONG, () => {
  const { course, status, stdout, stderr } = initWithCi("gitlab");

  expect(stderr).toBe("");
  expect(status).toBe(0);
  expect(stdout).toContain(".gitlab-ci.yml\n");
  expect(existsSync(join(course, ".github"))).toBe(false);
  const text = readFileSync(join(course, ".gitlab-ci.yml"), "utf8");
  expect(text).not.toContain("{{playwright}}");
  expect(text).toContain(`Node 24 и Chromium для Playwright ${playwright}`);
  expect(text).toContain("HTTPS");
  const pipeline = parse(text);

  expect(pipeline.image).toBe("$CODDA_IMAGE");
  const { check, deploy } = pipeline;
  expect(coddaCommands(check.script)).toEqual(["npm ci", "npx codda test", "npx codda build"]);
  expect(check.artifacts.paths).toEqual(["dist/"]);

  expect(deploy.image).toMatch(/^\$/);
  expect(deploy.needs).toEqual(["check"]);
  expect(deploy.rules).toEqual([{ if: '$CI_COMMIT_BRANCH == "main"' }]);
  const script: string = deploy.script.join("\n");
  expect(script).toContain("aws s3 sync dist/ s3://$CODDA_S3_BUCKET/ --delete");
  expect(script).toContain("$AWS_ENDPOINT_URL");
  expect(script).toMatch(/dist\/index\.html .*no-cache/);
  expect(script).toMatch(/dist\/course\.json .*no-cache/);
  expect(script).toContain("immutable");
});

test("init --ci bogus: code 2, nothing created", () => {
  const { course, status, stdout, stderr } = initWithCi("bogus");

  expect(stdout).toBe("");
  expect(stderr).toBe("codda: --ci: github или gitlab, а не bogus (справка: codda --help)\n");
  expect(status).toBe(2);
  expect(readdirSync(join(course, ".."))).toEqual([]);
});

test("init without --ci: no CI file", LONG, () => {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), "codda-ci-")));

  expect(runCodda(parent, ["init", "plain"]).status).toBe(0);

  expect(existsSync(join(parent, "plain/.github"))).toBe(false);
  expect(existsSync(join(parent, "plain/.gitlab-ci.yml"))).toBe(false);
});
