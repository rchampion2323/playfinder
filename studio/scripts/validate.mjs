#!/usr/bin/env node
// Validate every site (or the ones named): config, deploy settings, leftover
// template tokens, broken local links, and basic SEO/accessibility hygiene.
// Exit code 1 on any error. Runs in CI on every pull request.
//
//   node studio/scripts/validate.mjs [slug ...]
import fs from "node:fs";
import path from "node:path";
import { SITES, SLUG_RE, readConfig, listSites, listTemplates, resolveSite, walk } from "./lib.mjs";

const config = readConfig();
const slugs = process.argv.slice(2).filter((s) => !s.startsWith("-"));
const targets = slugs.length ? slugs : listSites();
let errors = 0, warnings = 0;

const err = (slug, msg) => { errors++; console.log(`  ✖ ${slug}: ${msg}`); };
const warn = (slug, msg) => { warnings++; console.log(`  ⚠ ${slug}: ${msg}`); };

if (!targets.length) console.log("No sites yet — create one with: npm run studio:new -- --name \"My Site\"");

const swaNames = new Map();
for (const slug of targets) {
  const dir = path.join(SITES, slug);
  if (!fs.existsSync(path.join(dir, "site.json"))) { err(slug, "missing site.json"); continue; }
  let site;
  try { site = resolveSite(slug, config); } catch (e) { err(slug, `site.json is not valid JSON (${e.message})`); continue; }

  if (!SLUG_RE.test(slug)) err(slug, "folder name must be lowercase letters, digits and dashes (max 40)");
  if (site.slug !== slug) err(slug, `site.json slug "${site.slug}" must match folder name`);
  if (!site.name) err(slug, "site.json needs a name");
  if (site.template && !listTemplates().includes(site.template)) warn(slug, `template "${site.template}" no longer exists (fine if intentional)`);
  if (!Array.isArray(site.targets)) err(slug, "targets must be an array");
  for (const t of site.targets) if (!config.allowedTargets.includes(t)) err(slug, `unknown target "${t}" (use ${config.allowedTargets.join(", ")})`);

  if (site.targets.includes("azure")) {
    const { name, location, sku } = site.azure;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,58}[a-zA-Z0-9]$/.test(name)) err(slug, `azure.name "${name}" is not a valid Static Web App name`);
    if (!config.allowedSwaLocations.includes(location)) err(slug, `azure.location "${location}" must be one of ${config.allowedSwaLocations.join(", ")}`);
    if (!["Free", "Standard"].includes(sku)) err(slug, `azure.sku must be Free or Standard`);
    if (swaNames.has(name)) err(slug, `azure.name "${name}" is also used by ${swaNames.get(name)}`);
    swaNames.set(name, slug);
  }

  if (site.build.command) {
    if (!fs.existsSync(path.join(dir, "package.json"))) err(slug, "build.command set but no package.json");
    continue; // built sites: source checks don't apply to the output
  }

  const out = path.resolve(dir, site.outputDir);
  if (!fs.existsSync(path.join(out, "index.html"))) { err(slug, "no index.html"); continue; }

  for (const file of walk(out)) {
    const rel = path.relative(dir, file);
    if (!/\.(html|css|js|json|svg)$/.test(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    const leftover = text.match(/\{\{[A-Z_]+\}\}/g);
    if (leftover) err(slug, `${rel} has unfilled template tokens: ${[...new Set(leftover)].join(" ")}`);
    if (!file.endsWith(".html")) continue;

    if (!/<html[^>]*\slang=/.test(text)) err(slug, `${rel} is missing <html lang>`);
    if (!/<title>[^<]+<\/title>/.test(text)) err(slug, `${rel} is missing a <title>`);
    if (!/name="viewport"/.test(text)) err(slug, `${rel} is missing a viewport meta tag`);
    if (rel === "index.html" && !/name="description"/.test(text)) warn(slug, `${rel} has no meta description`);
    for (const img of text.match(/<img\b[^>]*>/g) || []) if (!/\salt=/.test(img)) err(slug, `${rel}: <img> without alt text`);
    if (/example\.com|555-0100|Your City, ST/.test(text)) warn(slug, `${rel} still has placeholder contact details`);
    if (/TODO|Lorem ipsum/i.test(text)) warn(slug, `${rel} contains TODO / lorem ipsum`);

    for (const [, ref] of text.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      if (/^(https?:|mailto:|tel:|sms:|#|data:|javascript:)/.test(ref) || ref.startsWith("//")) continue;
      if (ref.startsWith("/")) {
        const msg = `${rel}: root-relative link "${ref}" breaks under the GitHub Pages sub-path — use a relative link`;
        site.targets.includes("github-pages") ? err(slug, msg) : warn(slug, msg);
        continue;
      }
      const clean = decodeURI(ref.split(/[?#]/)[0]);
      if (!clean) continue;
      let target = path.resolve(path.dirname(file), clean);
      if (clean.endsWith("/")) target = path.join(target, "index.html");
      if (!fs.existsSync(target)) err(slug, `${rel}: broken link "${ref}"`);
    }
  }
}

console.log(`\n${targets.length} site(s) checked — ${errors} error(s), ${warnings} warning(s).`);
process.exit(errors ? 1 : 0);
