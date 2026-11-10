import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, dirname, extname } from "node:path";
import { resolveDemoAsset } from "./demo-paths.mjs";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const port = Number(process.env.PORT || 4173);

const server = createServer(async (req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname); }
  catch { res.writeHead(400).end("Invalid path"); return; }
  const fullpath = resolveDemoAsset(root, pathname);
  if (!fullpath) {
    res.writeHead(404).end("Not found"); return;
  }
  try {
    const body = await readFile(fullpath);
    res.writeHead(200, { "Content-Type": mime[extname(fullpath)], "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log("Cromi Widget demo: http://127.0.0.1:" + port);
});
