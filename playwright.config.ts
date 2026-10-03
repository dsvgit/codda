import { defineConfig, devices } from "@playwright/test";

const port = 5179;

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
    baseURL: `http://localhost:${port}`,
    // Full Chromium, not chrome-headless-shell: see vite.config.ts.
    channel: "chromium",
  },
  webServer: {
    command: `npx vite --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
  },
});
