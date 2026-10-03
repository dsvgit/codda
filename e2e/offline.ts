// Every e2e test runs offline (ADR-0002): any request that leaves localhost is
// aborted, every request of the page — its Worker and Sandbox included — is
// logged, and the test fails unless the external ones (WebSockets included,
// which routing does not see) are exactly `expectedExternal` (none by default).
import { test as base, expect } from "@playwright/test";

export { expect };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isExternal(url: string): boolean {
  const { protocol, hostname } = new URL(url);
  return /^(https?|wss?):$/.test(protocol) && !LOCAL_HOSTS.has(hostname);
}

export const test = base.extend<{ expectedExternal: string[]; blockExternalNetwork: void }>({
  expectedExternal: [[], { option: true }],
  blockExternalNetwork: [
    async ({ context, page, expectedExternal }, use) => {
      const requests: string[] = [];
      const external: string[] = [];
      const log = (method: string, url: string) => {
        requests.push(`${method} ${url}`);
        if (isExternal(url)) external.push(url);
      };
      context.on("request", (request) => log(request.method(), request.url()));
      page.on("websocket", (socket) => log("WS", socket.url()));
      await context.route("**/*", (route) =>
        isExternal(route.request().url()) ? route.abort("blockedbyclient") : route.fallback(),
      );

      await use();

      console.log(`Network requests (${requests.length}):\n  ${requests.join("\n  ")}`);
      expect(external, "requests outside localhost").toEqual(expectedExternal);
    },
    { auto: true },
  ],
});
