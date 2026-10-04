// A static server on node:http for a Course Build: the folder under a subpath,
// like the pilot on hosting (GitHub Pages at /codda/), on 127.0.0.1 only and a
// free port. `codda test` opens the build through it; `codda dev` will too.
import { readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
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

/** Serves `dir` at `base` (`/<path>/`); `url` is the address of `base`. */
export async function serveFolder(dir: string, base: string): Promise<{ url: string; close: () => Promise<void> }> {
  const root = resolve(dir);
  const server = createServer((req, res) => {
    let path = "";
    try {
      path = decodeURIComponent((req.url ?? "/").split("?")[0]);
    } catch {} // a malformed %-escape: 404 below
    const file = path.startsWith(base) ? resolve(root, `./${path.slice(base.length)}`.replace(/\/$/, "/index.html")) : undefined;
    if (!file || !file.startsWith(root + sep) || !statSync(file, { throwIfNoEntry: false })?.isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}${base}`,
    close: () => {
      server.closeAllConnections();
      return new Promise((done) => server.close(() => done()));
    },
  };
}
