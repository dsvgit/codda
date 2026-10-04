import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Connect, Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { buildDependencyArtifact } from "./cli/dependency-artifact.ts";
import { readCourse } from "./cli/read-course.ts";

/** The Course whose Dependency Artifact the browser tests use (vitest.global-setup.ts). */
export const FIXTURE_COURSE = fileURLToPath(new URL("fixtures/react-course", import.meta.url));
/** Its build root on disk and the URL path the test server serves it at. */
export const FIXTURE_BUILD_DIR = join(FIXTURE_COURSE, "dist");
export const FIXTURE_BUILD_PATH = "/fixture-build/";

/**
 * Serves the files under `dir` at the URL path `prefix` byte for byte: Vite's
 * own middleware would transform the .js files and break their `integrity`.
 */
function serveFiles(prefix: string, dir: string): Connect.NextHandleFunction {
  return (req, res, next) => {
    const path = req.url?.split("?")[0];
    if (!path?.startsWith(prefix)) return next();
    const file = resolve(dir, decodeURIComponent(path.slice(prefix.length)));
    if (!file.startsWith(dir + sep) || !statSync(file, { throwIfNoEntry: false })?.isFile()) {
      res.statusCode = 404;
      return res.end();
    }
    res.setHeader("Content-Type", file.endsWith(".json") ? "application/json" : "text/javascript");
    res.end(readFileSync(file));
  };
}

/**
 * `npm run dev`: answers /course.json from the Course in CODDA_COURSE, read
 * anew on every request by the same module as `codda build`, so an edit to the
 * Course shows after a page reload. The path comes from the repository root's
 * script: the tool's code does not know where courses live (ADR-0006). The
 * Dependency Artifact is built anew with each course.json into a temporary
 * folder and served from /deps/.
 */
function courseJson(): Plugin {
  return {
    name: "codda-course-json",
    configureServer(server) {
      const out = mkdtempSync(join(tmpdir(), "codda-dev-"));
      server.middlewares.use(serveFiles("/deps/", join(out, "deps")));
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split("?")[0] !== "/course.json") return next();
        const send = (status: number, type: string, body: string) => {
          res.statusCode = status;
          res.setHeader("Content-Type", `${type}; charset=utf-8`);
          res.end(body);
        };
        const fail = (lines: string[]) => send(500, "text/plain", lines.map((l) => `${l}\n`).join(""));

        const dir = process.env.CODDA_COURSE;
        if (!dir) return fail(["не задана переменная окружения CODDA_COURSE — путь к курсу"]);
        const root = resolve(dir);
        if (!existsSync(join(root, "course.yaml"))) return fail([`нет course.yaml в ${root}`]);
        const result = readCourse(root);
        if ("errors" in result) return fail(result.errors);
        const lessonIds = result.course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id));
        const artifact = await buildDependencyArtifact(root, lessonIds, out);
        if ("errors" in artifact) return fail(artifact.errors);
        send(200, "application/json", JSON.stringify({ ...result.course, deps: artifact.deps }));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), courseJson()],
  // Relative URLs: the build works from any subpath, e.g. the pilot on GitHub
  // Pages at /codda/ (.scratch/misc/issues/02-pages-deploy.md).
  base: "./",
  // The tool's built UI; `codda build` copies it into a Course Build (ADR-0008).
  build: { outDir: "dist-tool" },
  optimizeDeps: {
    include: ["esbuild-wasm", "react", "react-dom/client", "codemirror", "@codemirror/lang-javascript"],
  },
  test: {
    projects: [
      {
        extends: true,
        plugins: [
          {
            name: "codda-fixture-build",
            configureServer(server) {
              server.middlewares.use(serveFiles(FIXTURE_BUILD_PATH, FIXTURE_BUILD_DIR));
            },
          },
        ],
        test: {
          name: "browser",
          include: ["src/**/*.test.{ts,tsx}"],
          globalSetup: ["./vitest.global-setup.ts"],
          // Each file starts a cold Run (esbuild.wasm + Dependency Artifacts).
          // With files in parallel browsers, on a CI runner it no longer fits
          // the Run's 5 s deadline (cf. workers in playwright.config.ts).
          fileParallelism: false,
          browser: {
            enabled: true,
            headless: true,
            // Full Chromium, not chrome-headless-shell: only the full build puts
            // the Sandbox iframe in its own process, as Chrome does. In the
            // shell an infinite loop in student code freezes the parent and the
            // Run timeout.
            provider: playwright({ launchOptions: { channel: "chromium" } }),
            instances: [{ browser: "chromium" }],
            // Tests of a Compiler Worker that cannot load esbuild.wasm or its
            // own script (runner.test.ts): requests whose URL matches the
            // pattern are aborted until restoreRequests.
            commands: {
              failRequests: async ({ page }, pattern: string) => {
                await page.route(new RegExp(pattern), (route) => route.abort());
              },
              restoreRequests: async ({ page }) => {
                await page.unrouteAll();
              },
            },
          },
        },
      },
      {
        // The CLI and the dev server run in Node: their tests start them for real.
        test: { name: "cli", include: ["cli/**/*.test.ts"], environment: "node" },
      },
    ],
  },
});
