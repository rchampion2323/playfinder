#!/usr/bin/env node
// Decide what the "Studio sites" workflow should deploy.
//
// Inputs (env): GITHUB_EVENT_NAME, BEFORE (push), BASE_REF (pull_request),
//               INPUT_SITE (workflow_dispatch: slug or "all").
// Outputs (GITHUB_OUTPUT): azure=<matrix JSON>, has_azure=true|false, pages=true|false
//
// Locally:  node studio/scripts/ci-plan.mjs --all   (prints the plan)
import fs from "node:fs";
import { execSync } from "node:child_process";
import { readConfig, listSites, resolveSite, parseArgs } from "./lib.mjs";

const args = parseArgs();
const env = process.env;
const config = readConfig();
const all = listSites();
const ZERO = /^0+$/;

function changedFiles() {
  const git = (cmd) => execSync(`git ${cmd}`, { encoding: "utf8" }).split("\n").filter(Boolean);
  if (env.GITHUB_EVENT_NAME === "pull_request") {
    try { return git(`diff --name-only origin/${env.BASE_REF}...HEAD`); } catch { return null; }
  }
  if (env.GITHUB_EVENT_NAME === "push" && env.BEFORE && !ZERO.test(env.BEFORE)) {
    try { return git(`diff --name-only ${env.BEFORE} HEAD`); } catch { return null; }
  }
  return null; // unknown → deploy everything
}

let selected;
if (args.all || env.INPUT_SITE === "all") selected = all;
else if (env.INPUT_SITE) selected = all.filter((s) => s === env.INPUT_SITE);
else {
  const files = changedFiles();
  const global = !files || files.some((f) => /^studio\/(infra|scripts)\/|^studio\/studio\.config\.json$|^\.github\/workflows\/studio-sites\.yml$/.test(f));
  selected = global ? all : all.filter((s) => files.some((f) => f.startsWith(`studio/sites/${s}/`)));
}

const sites = selected.map((s) => resolveSite(s, config));
const azure = sites.filter((s) => s.targets.includes("azure")).map((s) => ({
  slug: s.slug,
  name: s.azure.name,
  location: s.azure.location,
  sku: s.azure.sku,
  resourceGroup: s.azure.resourceGroup,
  owner: s.owner || "personal",
}));
// Pages publishes one bundle for the whole repo, so rebuild it whenever any
// selected site targets Pages (never on PRs — Pages has no preview environments).
const pages = env.GITHUB_EVENT_NAME !== "pull_request" && sites.some((s) => s.targets.includes("github-pages"));

const out = { azure: JSON.stringify(azure), has_azure: String(azure.length > 0), pages: String(pages) };
if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, Object.entries(out).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
console.log(`Selected: ${selected.join(", ") || "(none)"}`);
console.log(`Azure:    ${azure.map((a) => a.slug).join(", ") || "(none)"}`);
console.log(`Pages:    ${pages}`);
