// Shared helpers for the Site Studio scripts. Node 18+, no dependencies.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ROOT = path.resolve(STUDIO, "..");
export const SITES = path.join(STUDIO, "sites");
export const TEMPLATES = path.join(STUDIO, "templates");
export const IDEAS = path.join(STUDIO, "ideas");
export const OUT = path.join(STUDIO, ".out");

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
export const TEXT_EXT = new Set([".html", ".css", ".js", ".json", ".svg", ".txt", ".md", ".webmanifest", ".xml"]);

export function readConfig() {
  return JSON.parse(fs.readFileSync(path.join(STUDIO, "studio.config.json"), "utf8"));
}

export function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith(".") && !d.name.startsWith("_"))
    .map((d) => d.name)
    .sort();
}

export const listSites = () => listDirs(SITES);
export const listTemplates = () => listDirs(TEMPLATES);

export function readSite(slug) {
  const file = path.join(SITES, slug, "site.json");
  const site = JSON.parse(fs.readFileSync(file, "utf8"));
  site.targets ??= [];
  site.build ??= {};
  site.azure ??= {};
  return site;
}

/** Fill in defaults that every consumer (validate, plan, build) relies on. */
export function resolveSite(slug, config = readConfig()) {
  const site = readSite(slug);
  return {
    ...site,
    dir: path.join(SITES, slug),
    outputDir: site.build.output || ".",
    azure: {
      name: site.azure.name || `swa-${slug}`,
      location: site.azure.location || config.azure.location,
      sku: site.azure.sku || config.azure.defaultSku,
      resourceGroup: site.azure.resourceGroup || config.azure.resourceGroup,
      customDomain: site.azure.customDomain || "",
      url: site.azure.url || "",
    },
  };
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split(/=(.*)/s);
      if (v !== undefined) args[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith("--")) args[k] = argv[++i];
      else args[k] = true;
    } else args._.push(a);
  }
  return args;
}

/** Recursively copy, skipping names for which skip(name) is true. */
export function copyDir(src, dest, skip = () => false) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d, skip);
    else fs.copyFileSync(s, d);
  }
}

export function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Read simple `key: value` YAML frontmatter from a markdown file. */
export function frontmatter(file) {
  const text = fs.readFileSync(file, "utf8");
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  const data = {};
  if (!m) return data;
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return data;
}

export function slugify(s) {
  return String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
}
