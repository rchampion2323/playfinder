#!/usr/bin/env node
// Pipeline overview: every idea and every site, with status and where it lives.
//   node studio/scripts/status.mjs
import fs from "node:fs";
import path from "node:path";
import { IDEAS, readConfig, listSites, resolveSite, frontmatter } from "./lib.mjs";

const config = readConfig();
const pad = (s, n) => String(s ?? "").slice(0, n).padEnd(n);

const ideas = fs.existsSync(IDEAS)
  ? fs.readdirSync(IDEAS).filter((f) => f.endsWith(".md") && !f.startsWith("_") && f !== "README.md")
  : [];
console.log(`\nIDEAS (${ideas.length})`);
console.log(`  ${pad("slug", 28)} ${pad("status", 10)} ${pad("for", 10)} title`);
for (const f of ideas) {
  const fm = frontmatter(path.join(IDEAS, f));
  console.log(`  ${pad(f.replace(/\.md$/, ""), 28)} ${pad(fm.status, 10)} ${pad(fm.for, 10)} ${fm.title || ""}`);
}

const sites = listSites();
console.log(`\nSITES (${sites.length})`);
console.log(`  ${pad("slug", 28)} ${pad("status", 10)} ${pad("targets", 22)} url`);
for (const slug of sites) {
  const s = resolveSite(slug, config);
  const urls = [];
  if (s.targets.includes("azure")) urls.push(s.azure.customDomain ? `https://${s.azure.customDomain}` : s.azure.url || "(azure: see Actions summary)");
  if (s.targets.includes("github-pages")) urls.push(`${config.github.pagesBaseUrl}/${slug}/`);
  console.log(`  ${pad(slug, 28)} ${pad(s.status, 10)} ${pad(s.targets.join(",") || "—", 22)} ${urls.join("  ")}`);
}
console.log("");
