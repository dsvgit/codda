import { defineConfig, devices } from "@playwright/test";

const devPort = 5179;
const pagesPort = 5180;
// The pilot is served from a subpath (https://dsvgit.github.io/codda/), so the
// built dist/ is tested from one too. Tests navigate relative to baseURL
// (`page.goto("./")`), never to "/".
const pagesBase = "/codda/";

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  reporter: "list",
  // Every test starts a cold Run (esbuild.wasm + Dependency Artifacts). With
  // more parallel browsers it no longer fits the Run's 5 s deadline.
  workers: 2,
  // Longer than the Run's own 5 s deadline, so a slow Run shows up in the UI
  // as "Timed out" instead of an expect timeout.
  expect: { timeout: 10_000 },
  use: {
    ...devices["Desktop Chrome"],
    // Full Chromium, not chrome-headless-shell: see vite.config.ts.
    channel: "chromium",
  },
  projects: [
    { name: "dev", use: { baseURL: `http://localhost:${devPort}/` } },
    // The build GitHub Pages deploys: `npm run test:e2e` builds dist/ first.
    { name: "pages", use: { baseURL: `http://localhost:${pagesPort}${pagesBase}` } },
  ],
  webServer: [
    {
      command: `npx vite --port ${devPort} --strictPort`,
      url: `http://localhost:${devPort}`,
      reuseExistingServer: false,
    },
    {
      command: `npx vite preview --base ${pagesBase} --port ${pagesPort} --strictPort`,
      url: `http://localhost:${pagesPort}${pagesBase}`,
      reuseExistingServer: false,
    },
  ],
});
