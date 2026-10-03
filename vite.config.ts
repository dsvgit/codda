import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["esbuild-wasm", "react", "react-dom/client", "codemirror", "@codemirror/lang-javascript"],
  },
  test: {
    browser: {
      enabled: true,
      headless: true,
      // Full Chromium, not chrome-headless-shell: only the full build puts the
      // Sandbox iframe in its own process, as Chrome does. In the shell an
      // infinite loop in student code freezes the parent and the Run timeout.
      provider: playwright({ launchOptions: { channel: "chromium" } }),
      instances: [{ browser: "chromium" }],
    },
  },
});
