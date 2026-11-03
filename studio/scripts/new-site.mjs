#!/usr/bin/env node
// Scaffold a new site from a template.
//
//   node studio/scripts/new-site.mjs --name "Gulf Breeze Bakery" --template small-business \
//     --tagline "Fresh bread, every morning" --primary "#9a3412" --accent "#f59e0b" \
//     --email hello@example.com --phone "(850) 555-0100" --city "Gulf Breeze, FL" \
//     --owner client --client "Jane Doe" --idea gulf-breeze-bakery
//
// Creates studio/sites/<slug>/ with the template files and a site.json.
// New sites have NO deploy targets — nothing goes live until you add one.
import fs from "node:fs";
import path from "node:path";
import { SITES, TEMPLATES, TEXT_EXT, SLUG_RE, listTemplates, parseArgs, copyDir, walk, slugify } from "./lib.mjs";

const a = parseArgs();
if (a.help || !a.name) {
  console.log(`Usage: new-site.mjs --name "Business Name" [--slug x] [--template ${listTemplates().join("|")}]
  [--tagline ..] [--description ..] [--primary #hex] [--accent #hex]
  [--email ..] [--phone ..] [--city ..] [--owner personal|client] [--client ..] [--idea <idea-slug>] [--form-endpoint https://...]`);
  process.exit(a.help ? 0 : 1);
}

const slug = a.slug || slugify(a.name);
const template = a.template || "small-business";
if (!SLUG_RE.test(slug)) fail(`Invalid slug "${slug}" (lowercase letters, digits, dashes; max 40).`);
if (!listTemplates().includes(template)) fail(`Unknown template "${template}". Options: ${listTemplates().join(", ")}`);
const dest = path.join(SITES, slug);
if (fs.existsSync(dest)) fail(`studio/sites/${slug} already exists.`);

const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(v || "") ? v : d);
const tokens = {
  NAME: a.name,
  SLUG: slug,
  INITIAL: a.name.trim()[0].toUpperCase(),
  TAGLINE: a.tagline || "A short, specific promise goes here.",
  DESCRIPTION: a.description || `${a.name} — ${a.tagline || "learn more and get in touch."}`,
  PRIMARY: hex(a.primary, "#1f4e79"),
  ACCENT: hex(a.accent, "#e8a33d"),
  EMAIL: a.email || "hello@example.com",
  PHONE: a.phone || "(555) 555-0100",
  PHONE_RAW: (a.phone || "5555550100").replace(/[^\d+]/g, ""),
  CITY: a.city || "Your City, ST",
  YEAR: String(new Date().getFullYear()),
  FORM_ENDPOINT: a["form-endpoint"] || "",
};

copyDir(path.join(TEMPLATES, template), dest);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
for (const file of walk(dest)) {
  if (!TEXT_EXT.has(path.extname(file))) continue;
  const html = /\.(html|svg|xml)$/.test(file);
  const text = fs.readFileSync(file, "utf8").replace(/\{\{([A-Z_]+)\}\}/g, (m, k) =>
    k in tokens ? (html ? esc(tokens[k]) : tokens[k]) : m);
  fs.writeFileSync(file, text);
}

const site = {
  slug,
  name: a.name,
  template,
  owner: a.owner === "client" ? "client" : "personal",
  client: a.client || "",
  status: "draft",
  idea: a.idea ? `studio/ideas/${a.idea}.md` : "",
  targets: [],
  azure: { name: `swa-${slug}`, sku: "Free", customDomain: "", url: "" },
  build: { command: "", output: "." },
  brand: { primary: tokens.PRIMARY, accent: tokens.ACCENT },
  contact: { email: tokens.EMAIL, phone: tokens.PHONE, city: tokens.CITY },
  forms: { endpoint: tokens.FORM_ENDPOINT },
  created: new Date().toISOString().slice(0, 10),
};
fs.writeFileSync(path.join(dest, "site.json"), JSON.stringify(site, null, 2) + "\n");

console.log(`Created studio/sites/${slug} from "${template}".
Next:
  npm run studio:serve -- ${slug}        # preview at http://localhost:4173
  npm run studio:validate
  Add "azure" and/or "github-pages" to "targets" in site.json when ready to deploy.`);

function fail(msg) { console.error(`✖ ${msg}`); process.exit(1); }
