/// <reference types="node" />
import { defineConfig, devices } from "@playwright/test";

const devPort = 5179;
const pagesPort = 5180;
// The pilot is served from a subpath (https://dsvgit.github.io/codda/), so the
// Course Build is tested from one too. Tests navigate relative to baseURL
// (`page.goto("./")`), never to "/".
const pagesBase = "/codda/";
// The Course Build GitHub Pages deploys: `npm run test:e2e` builds the UI, then
// runs `codda build courses/react-hooks` into its default --out.
const courseBuild = "courses/react-hooks/dist";

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  reporter: "list",
  // Every test starts a cold Run (esbuild.wasm + Dependency Artifacts). With
  // more parallel browsers it no longer fits the Run's 5 s deadline.
  workers: 2,
  // In CI only: the deferred flake of a false 5 s timeout (a new Sandbox that
  // never starts) — .scratch/mvp-autorun/README.md, «Отложенные проблемы».
  retries: process.env.CI ? 2 : 0,
  // Longer than the Run's own 5 s deadline, so a slow Run shows up in the UI
  // as "Timed out" instead of an expect timeout.
  expect: { timeout: 10_000 },
  use: {
    ...devices["Desktop Chrome"],
    // Full Chromium, not chrome-headless-shell: see packages/codda/vite.config.ts.
    channel: "chromium",
  },
  projects: [
    // `npm run dev` gets a smoke test and the moves between Lessons; everything else runs on the build.
    { name: "dev", testMatch: ["dev.e2e.ts", "navigation.e2e.ts"], use: { baseURL: `http://localhost:${devPort}/` } },
    {
      name: "pages",
      testIgnore: "dev.e2e.ts",
      use: { baseURL: `http://localhost:${pagesPort}${pagesBase}` },
    },
  ],
  webServer: [
    {
      // The repository's own `npm run dev`, which points it at courses/react-hooks.
      command: `npm run dev -- --port ${devPort} --strictPort`,
      url: `http://localhost:${devPort}`,
      reuseExistingServer: false,
    },
    {
      command: `npx vite preview --outDir ../../${courseBuild} --base ${pagesBase} --port ${pagesPort} --strictPort`,
      cwd: "packages/codda",
      url: `http://localhost:${pagesPort}${pagesBase}`,
      reuseExistingServer: false,
    },
  ],
});
