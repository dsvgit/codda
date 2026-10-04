// The static server of `codda test`: a Course Build under a subpath, on
// 127.0.0.1 and a free port.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { serveFolder } from "./static-server.ts";
import { writeFiles } from "./test-helpers.ts";

let server: Awaited<ReturnType<typeof serveFolder>>;

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "codda-serve-"));
  writeFiles(dir, {
    "index.html": "<!doctype html>",
    "assets/esbuild.wasm": "\0asm",
    "course.json": "{}",
  });
  writeFiles(join(dir, ".."), { "secret.txt": "secret" });
  server = await serveFolder(dir, "/demo/");
});

afterAll(() => server.close());

test("listens on 127.0.0.1 on a free port, the folder is at the subpath", async () => {
  expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/demo\/$/);
  expect(server.url).not.toContain(":0/");

  const index = await fetch(server.url);
  expect(index.status).toBe(200);
  expect(index.headers.get("content-type")).toMatch(/^text\/html/);
  expect(await index.text()).toBe("<!doctype html>");

  const json = await fetch(`${server.url}course.json?x=1`);
  expect(json.headers.get("content-type")).toMatch(/^application\/json/);
  expect(await json.text()).toBe("{}");
});

test(".wasm is served as application/wasm", async () => {
  const wasm = await fetch(`${server.url}assets/esbuild.wasm`);
  expect(wasm.status).toBe(200);
  expect(wasm.headers.get("content-type")).toBe("application/wasm");
});

test("404 outside the subpath, for missing files and for paths leaving the folder", async () => {
  const origin = new URL(server.url).origin;
  expect((await fetch(`${origin}/index.html`)).status).toBe(404);
  expect((await fetch(`${origin}/`)).status).toBe(404);
  expect((await fetch(`${server.url}nope.js`)).status).toBe(404);
  expect((await fetch(`${server.url}assets`)).status).toBe(404);
  expect((await fetch(`${server.url}%2e%2e/secret.txt`)).status).toBe(404);
  expect((await fetch(`${server.url}%E0`)).status).toBe(404);
});
