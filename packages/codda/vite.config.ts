import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  plugins: [react()],
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
          // From the repository root: courses/courses.test.ts lives outside the
          // package until lesson-manifest replaces the PoC course format.
          dir: "../..",
          include: ["packages/codda/src/**/*.test.{ts,tsx}", "courses/**/*.test.ts"],
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
        // The CLI runs in Node: its tests start it as a process.
        test: { name: "cli", include: ["cli/**/*.test.ts"], environment: "node" },
      },
    ],
  },
});
