import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { readCourse } from "./cli/read-course.ts";

/**
 * `npm run dev`: answers /course.json from the Course in CODDA_COURSE, read
 * anew on every request by the same module as `codda build`, so an edit to the
 * Course shows after a page reload. The path comes from the repository root's
 * script: the tool's code does not know where courses live (ADR-0006).
 */
function courseJson(): Plugin {
  return {
    name: "codda-course-json",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
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
        send(200, "application/json", JSON.stringify(result.course));
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
        test: {
          name: "browser",
          include: ["src/**/*.test.{ts,tsx}"],
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
