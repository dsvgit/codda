// Global setup of the browser tests: builds the Dependency Artifact of
// fixtures/react-course with the code of `codda build`: from its .codda/ cache
// when the hash matches, otherwise with npm ci from the default registry when
// its node_modules are missing or stale. The test server serves the
// build root at FIXTURE_BUILD_PATH (vite.config.ts); the tests get the path of
// its importmap.json with inject("importMap").
import { rmSync } from "node:fs";
import type { TestProject } from "vitest/node";
import { buildDependencyArtifact } from "./cli/dependency-artifact.ts";
import { FIXTURE_BUILD_DIR, FIXTURE_BUILD_PATH, FIXTURE_COURSE } from "./vite.config.ts";

declare module "vitest" {
  export interface ProvidedContext {
    importMap: string;
  }
}

export default async function setup(project: TestProject) {
  rmSync(FIXTURE_BUILD_DIR, { recursive: true, force: true });
  const result = await buildDependencyArtifact(FIXTURE_COURSE, ["toggle"], FIXTURE_BUILD_DIR);
  if ("errors" in result || result.deps === null) throw new Error(`fixture artifact: ${JSON.stringify(result)}`);
  project.provide("importMap", `${FIXTURE_BUILD_PATH}${result.deps}importmap.json`);
}
