#!/usr/bin/env node
// Zero-dependency preview server for one site.
//   node studio/scripts/serve.mjs <slug> [--port 4173]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { SITES, parseArgs, resolveSite } from "./lib.mjs";

const args = parseArgs();
const slug = args._[0];
if (!slug || !fs.existsSync(path.join(SITES, slug))) {
  console.error("Usage: serve.mjs <slug> [--port 4173]");
  process.exit(1);
}
const root = path.resolve(SITES, slug, resolveSite(slug).outputDir);
const port = Number(args.port || 4173);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".txt": "text/plain" };

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) {
    const nf = path.join(root, "404.html");
    res.writeHead(404, { "Content-Type": TYPES[".html"] });
    res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : "Not found");
    return;
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Previewing ${slug} at http://localhost:${port}`));
