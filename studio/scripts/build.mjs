#!/usr/bin/env node
// Stage a site's deployable files into studio/.out/<slug>/ (runs its build
// command first if it has one). Private files — site.json, *.md, package
// manifests, node_modules — are never published.
//
//   node studio/scripts/build.mjs <slug>     → studio/.out/<slug>
//   node studio/scripts/build.mjs --pages    → studio/.out/_pages (every github-pages site + an index)
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { OUT, readConfig, listSites, resolveSite, copyDir, parseArgs } from "./lib.mjs";

const PRIVATE = new Set(["site.json", "node_modules", "package.json", "package-lock.json", "src", ".DS_Store"]);
const skip = (name) => PRIVATE.has(name) || name.endsWith(".md") || name.startsWith(".");

const args = parseArgs();
const config = readConfig();

export function stage(slug, dest) {
  const site = resolveSite(slug, config);
  if (site.build.command) {
    console.log(`▸ ${slug}: ${site.build.command}`);
    execSync(site.build.command, { cwd: site.dir, stdio: "inherit" });
  }
  const src = path.resolve(site.dir, site.outputDir);
  fs.rmSync(dest, { recursive: true, force: true });
  // For built sites the output folder is already clean; for static sites filter private files.
  copyDir(src, dest, site.build.command ? () => false : skip);
  console.log(`✔ ${slug} → ${path.relative(process.cwd(), dest)}`);
  return site;
}

if (args.pages) {
  const root = path.join(OUT, "_pages");
  fs.rmSync(root, { recursive: true, force: true });
  const sites = listSites().map((s) => resolveSite(s, config)).filter((s) => s.targets.includes("github-pages"));
  for (const s of sites) stage(s.slug, path.join(root, s.slug));
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, "index.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Site Studio</title><meta name="robots" content="noindex">
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;color:#1c1917;background:#fafaf9}
a{color:inherit}li{margin:.5rem 0}small{color:#78716c}</style></head>
<body><h1>Site Studio</h1><ul>
${sites.map((s) => `<li><a href="./${s.slug}/">${esc(s.name)}</a> <small>${esc(s.status || "")}</small></li>`).join("\n")}
</ul></body></html>\n`);
  fs.writeFileSync(path.join(root, ".nojekyll"), "");
  console.log(`✔ GitHub Pages bundle: ${sites.length} site(s) in ${path.relative(process.cwd(), root)}`);
} else if (args._[0]) {
  stage(args._[0], path.join(OUT, args._[0]));
} else {
  console.error("Usage: build.mjs <slug> | --pages");
  process.exit(1);
}
