// scanner/pull.js — the daily tournament pull.
//
//   node scanner/pull.js --dry-run              # free: show which sources would be read
//   node scanner/pull.js --only=hjgt            # one source (id or name fragment)
//   node scanner/pull.js --limit=3              # first N sources
//   node scanner/pull.js                        # everything (what the daily Action runs)
//
// Reads each tour's schedule with Claude (scanner/extract.js), validates every
// record (scanner/normalize.js), places it on the map (scanner/geocode.js), and
// merges it into public/data/tournaments.json — the file the site reads.
//
// Publishing rule (chosen by the owner): records that pass every check go live
// automatically; records with anything unusual are held in
// scanner/output/held.json until approved in scanner/review.json.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PULL_SOURCES, STATES, HORIZON_DAYS } from "./sources.js";
import { validate, flags, slug } from "./normalize.js";
import { geocode, saveGeocache } from "./geocode.js";
import { classify } from "../src/data/region.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const DATA = path.join(ROOT, "public/data/tournaments.json");
const OUT = path.join(here, "output");
const REVIEW = path.join(here, "review.json");

// USD per million tokens / per 1,000 searches — for the cost estimate only.
const RATES = {
  "claude-opus-5-5": [4, 20], "claude-sonnet-5-5": [2, 10], "claude-haiku-5-5": [0.1, 0.5],
};
const SEARCH_PER_1000 = 10;

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v ?? true];
}));
const today = new Date().toISOString().slice(0, 10);
const readJson = (f, fallback) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : fallback);

let sources = PULL_SOURCES;
if (args.only) {
  const want = String(args.only).toLowerCase().split(",");
  sources = sources.filter((s) => want.some((w) => s.id === w || s.name.toLowerCase().includes(w)));
}
if (args.limit) sources = sources.slice(0, Number(args.limit));

if (args["dry-run"]) {
  console.log(`Would read ${sources.length} source(s) for ${STATES.join("/")}, next ${HORIZON_DAYS} days:`);
  for (const s of sources) console.log(`  ${s.id.padEnd(16)} ${s.type.padEnd(13)} ${s.url}`);
  process.exit(0);
}
// PULL_FIXTURE=file.json swaps Claude for canned results ({ "<source id>": [raw...] }) — for testing the merge.
const fixture = process.env.PULL_FIXTURE ? readJson(process.env.PULL_FIXTURE, {}) : null;
if (!fixture && !process.env.ANTHROPIC_API_KEY) {
  console.error("✖ ANTHROPIC_API_KEY is not set (repo secret in CI; export it locally). Never commit it.");
  process.exit(1);
}
const { extractSource, MODEL } = fixture
  ? { MODEL: "fixture", extractSource: async (s) => {
      if (fixture[s.id] === "error") throw new Error("fixture error");
      return { tournaments: fixture[s.id] || [], notes: "fixture", usage: {} };
    } }
  : await import("./extract.js");

const previous = readJson(DATA, { tournaments: [], sources: [] });
const prevList = previous.sample ? [] : previous.tournaments; // sample data is never merged with real data
const review = readJson(REVIEW, { approve: [], reject: [] });
const approved = new Set(review.approve), rejected = new Set(review.reject);

const bySource = new Map();
for (const t of prevList) bySource.set(t.source, [...(bySource.get(t.source) || []), t]);
const prevByName = new Map(prevList.map((t) => [`${t.source}|${slug(t.name)}`, t]));
const sourceStatus = new Map((previous.sample ? [] : previous.sources || []).map((s) => [s.name, s]));

const published = [];
const held = [];
const totals = { inputTokens: 0, outputTokens: 0, searches: 0, fetches: 0 };
const pulledNames = new Set();

for (const source of sources) {
  process.stdout.write(`▸ ${source.name} … `);
  const before = bySource.get(source.name) || [];
  try {
    const { tournaments, notes, usage } = await extractSource(source, { states: STATES, today, horizonDays: HORIZON_DAYS });
    for (const k of Object.keys(totals)) totals[k] += usage[k] || 0;

    const kept = [];
    let dropped = 0, heldHere = 0, outside = 0;
    for (const raw of tournaments) {
      const v = validate(raw, source, today);
      if (!v.ok) { dropped++; continue; }
      const e = v.event;
      if (!STATES.includes(e.state) || rejected.has(e.id)) continue;
      Object.assign(e, (await geocode(e.city, e.state)) || { lat: null, lng: null });
      // Outside PlayFinder's Gulf Coast definition (src/data/region.js)? Leave it out —
      // unless we couldn't place it, in which case the review flag below catches it.
      e.region = classify(e);
      if (!e.region && e.lat != null) { outside++; continue; }
      e.lastVerified = new Date().toISOString();
      const why = flags(e, prevByName.get(`${source.name}|${slug(e.name)}`), today);
      if (why.length && !approved.has(e.id)) { held.push({ ...e, flags: why }); heldHere++; continue; }
      if (!kept.some((k) => k.id === e.id)) kept.push(e);
    }

    // A tour that suddenly returns nothing is more likely a broken page than a
    // cancelled season — keep what we had and say so.
    if (kept.length === 0 && heldHere === 0 && before.length >= 3) {
      published.push(...before);
      sourceStatus.set(source.name, { name: source.name, ok: false, checked: new Date().toISOString(), count: before.length,
        note: `returned no tournaments (had ${before.length}); kept the previous list. ${notes}`.trim() });
      console.log(`⚠ nothing found, kept ${before.length} previous`);
    } else {
      published.push(...kept);
      sourceStatus.set(source.name, { name: source.name, ok: true, checked: new Date().toISOString(), count: kept.length, note: notes });
      console.log(`✔ ${kept.length} published, ${heldHere} held, ${dropped} rejected, ${outside} outside the region`);
    }
    pulledNames.add(source.name);
  } catch (err) {
    published.push(...before);
    sourceStatus.set(source.name, { name: source.name, ok: false, checked: new Date().toISOString(), count: before.length, note: String(err.message || err).slice(0, 300) });
    pulledNames.add(source.name);
    console.log(`✖ ${err.message} (kept ${before.length} previous)`);
  }
}

// Sources not read this run keep their previous records.
for (const [name, list] of bySource) if (!pulledNames.has(name)) published.push(...list);

const live = published
  .map((t) => (t.region ? t : { ...t, region: classify(t) }))
  .filter((t) => t.region && (t.endDate || t.startDate) >= today && !rejected.has(t.id))
  .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));

const [inRate, outRate] = RATES[MODEL] || RATES["claude-opus-5-5"];
const cost = (totals.inputTokens / 1e6) * inRate + (totals.outputTokens / 1e6) * outRate + (totals.searches / 1000) * SEARCH_PER_1000;

fs.mkdirSync(path.dirname(DATA), { recursive: true });
fs.writeFileSync(DATA, JSON.stringify({
  generatedAt: new Date().toISOString(),
  sample: false,
  states: STATES,
  sources: [...sourceStatus.values()].sort((a, b) => a.name.localeCompare(b.name)),
  tournaments: live,
}, null, 1) + "\n");
saveGeocache();

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "held.json"), JSON.stringify(held, null, 2) + "\n");
const failed = [...sourceStatus.values()].filter((s) => pulledNames.has(s.name) && !s.ok);
const summary = [
  `### Tournament pull — ${today}`,
  `- **${live.length}** upcoming tournaments published (${sources.length} source(s) read)`,
  `- **${held.length}** held for review${held.length ? " — see below" : ""}`,
  `- Model \`${MODEL}\` · ${totals.inputTokens.toLocaleString()} in / ${totals.outputTokens.toLocaleString()} out tokens · ${totals.searches} searches · ${totals.fetches} fetches · ≈ $${cost.toFixed(2)}`,
  failed.length ? `\n**Sources with problems**\n${failed.map((s) => `- ${s.name}: ${s.note}`).join("\n")}` : "",
  held.length ? `\n**Held for review** — approve by adding the id to \`scanner/review.json\` → \`approve\`, or hide it via \`reject\`.\n${
    held.map((h) => `- \`${h.id}\` — ${h.name}, ${h.startDate}, ${h.city} ${h.state}: ${h.flags.join("; ")}`).join("\n")}` : "",
].filter(Boolean).join("\n");
fs.writeFileSync(path.join(OUT, "summary.md"), summary + "\n");
console.log(`\n${summary}`);
