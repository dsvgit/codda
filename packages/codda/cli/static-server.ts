// A static server on node:http for a Course Build: the folder under a subpath,
// like the pilot on hosting (GitHub Pages at /codda/), on 127.0.0.1 only.
// `codda test` opens the build through it on a free port. `codda dev` adds
// `live`: the SSE endpoint EVENTS and, in the index.html it serves, an inline
// script that reloads the page on its `reload` event. The script is never in
// the build or the UI's code.
import { readFileSync, statSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, resolve, sep } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
};

/** The SSE endpoint of `live`, under `base`. */
export const EVENTS = "__codda/events";

const reloadScript = (base: string) =>
  `<script>new EventSource(${JSON.stringify(base + EVENTS)}).addEventListener("reload", () => location.reload());</script>`;

/**
 * Serves `dir` at `base` (`/<path>/`) on `port` (0 — a free one); `url` is the
 * address of `base`. A busy port rejects with the listen error (`EADDRINUSE`).
 * With `live`, `reload()` sends the event `reload` to every open page.
 */
export async function serveFolder(
  dir: string,
  base: string,
  { port = 0, live = false }: { port?: number; live?: boolean } = {},
): Promise<{ url: string; close: () => Promise<void>; reload: () => void }> {
  const root = resolve(dir);
  const streams = new Set<ServerResponse>();
  const server = createServer((req, res) => {
    let path = "";
    try {
      path = decodeURIComponent((req.url ?? "/").split("?")[0]);
    } catch {} // a malformed %-escape: 404 below
    if (live && path === base + EVENTS) {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
      res.write(": codda dev\n\n");
      streams.add(res);
      res.on("close", () => streams.delete(res));
      return;
    }
    const file = path.startsWith(base) ? resolve(root, `./${path.slice(base.length)}`.replace(/\/$/, "/index.html")) : undefined;
    if (!file || !file.startsWith(root + sep) || !statSync(file, { throwIfNoEntry: false })?.isFile()) {
      res.writeHead(404).end();
      return;
    }
    let body: string | Buffer = readFileSync(file);
    if (live && file === resolve(root, "index.html")) {
      const html = body.toString("utf8");
      body = html.includes("</head>") ? html.replace("</head>", `${reloadScript(base)}</head>`) : html + reloadScript(base);
    }
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" }).end(body);
  });
  await new Promise<void>((done, fail) => {
    server.once("error", fail);
    server.listen(port, "127.0.0.1", done);
  });
  const address = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}${base}`,
    close: () => {
      server.closeAllConnections();
      return new Promise((done) => server.close(() => done()));
    },
    reload: () => {
      for (const stream of streams) stream.write("event: reload\ndata: \n\n");
    },
  };
}
