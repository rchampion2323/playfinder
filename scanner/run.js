// scanner/run.js
//
// CLI entry point. Start small and cost-check before scaling up.
//
//   node scanner/run.js --dry-run                  # no API calls; shows the plan
//   node scanner/run.js --limit=3 --state=AL       # ~3 sources, real calls
//   node scanner/run.js --state=FL --month=6
//   node scanner/run.js                            # full scan (all sources)
//
// Flags:
//   --dry-run        print what would be scanned; make no API calls
//   --limit=N        only scan the first N matching sources
//   --state=AL|FL|MS filter sources and query by state
//   --age=N          target a specific player age
//   --month=1..12    target a specific month
//   --only=substr    only sources whose name contains substr (case-insensitive)
//   --out=path       output file (default scanner/output/events.json)

import fs from "node:fs/promises";
import path from "node:path";
import { SOURCES } from "../src/data/sources.js";
import { scanSource } from "./scan.js";
import { normalize } from "./normalize.js";

// Approximate rates for cost ESTIMATION ONLY. Verify current pricing at
// https://claude.com/pricing — these change and are not authoritative.
const RATES = {
  "claude-haiku-4-5-20251001": { inPerMTok: 1.0, outPerMTok: 5.0 },
  "claude-sonnet-5":           { inPerMTok: 3.0, outPerMTok: 15.0 },
  _default:                    { inPerMTok: 3.0, outPerMTok: 15.0 },
  searchPer1000: 10.0,
};

function parseArgs(argv) {
  const args = { dryRun: false };
  for (const a of argv.slice(2)) {
    if (a === "--dry-run") args.dryRun = true;
    else if (a.startsWith("--limit=")) args.limit = Number(a.split("=")[1]);
    else if (a.startsWith("--state=")) args.state = a.split("=")[1].toUpperCase();
    else if (a.startsWith("--age=")) args.age = a.split("=")[1];
    else if (a.startsWith("--month=")) args.month = a.split("=")[1];
    else if (a.startsWith("--only=")) args.only = a.split("=")[1].toLowerCase();
    else if (a.startsWith("--out=")) args.out = a.split("=")[1];
  }
  return args;
}

function pickSources({ state, only, limit }) {
  let list = SOURCES.filter((s) =>
    !state || state === "ALL" || s.states.includes(state) || s.states.includes("all")
  );
  if (only) list = list.filter((s) => s.name.toLowerCase().includes(only));
  if (limit) list = list.slice(0, limit);
  return list;
}

function estimateCost(usage, model) {
  const r = RATES[model] || RATES._default;
  return (
    (usage.inputTokens / 1e6) * r.inPerMTok +
    (usage.outputTokens / 1e6) * r.outPerMTok +
    (usage.searches / 1000) * RATES.searchPer1000
  );
}

async function main() {
  const args = parseArgs(process.argv);
  const model = process.env.SCAN_MODEL || "claude-haiku-4-5-20251001";
  const targets = pickSources({ state: args.state, only: args.only, limit: args.limit });

  console.log(`\nPlayFinder scanner`);
  console.log(`  model:   ${model}`);
  console.log(`  state:   ${args.state || "all (AL/FL/MS)"}`);
  console.log(`  age:     ${args.age || "any"}`);
  console.log(`  month:   ${args.month || "next 6 months"}`);
  console.log(`  sources: ${targets.length}`);
  console.log(`  mode:    ${args.dryRun ? "DRY RUN (no API calls)" : "LIVE"}\n`);

  if (!targets.length) {
    console.log("No sources matched those filters. Nothing to do.");
    return;
  }

  targets.forEach((s, i) => console.log(`  ${i + 1}. ${s.name}`));

  if (args.dryRun) {
    const maxSearches = Number(process.env.MAX_SEARCHES || 3);
    console.log(
      `\nDry run complete. A live run would make up to ${targets.length * maxSearches} ` +
      `web searches across ${targets.length} API calls.\n` +
      `Rough cost estimate: $${(targets.length * 0.05).toFixed(2)}–$${(targets.length * 0.12).toFixed(2)}\n` +
      `(Estimate only — verify pricing at https://claude.com/pricing)\n`
    );
    return;
  }

  const totals = { inputTokens: 0, outputTokens: 0, searches: 0 };
  const rawBySource = [];
  const errors = [];

  // Sequential on purpose: keeps you well inside rate limits and makes a runaway
  // loop impossible to miss. Parallelize later if scan duration becomes a problem.
  for (const [i, source] of targets.entries()) {
    process.stdout.write(`\n[${i + 1}/${targets.length}] ${source.name} … `);
    try {
      const { events, usage } = await scanSource(source, {
        state: args.state, age: args.age, month: args.month,
      });
      totals.inputTokens += usage.inputTokens;
      totals.outputTokens += usage.outputTokens;
      totals.searches += usage.searches;
      console.log(
        `${events.length} event(s), ${usage.searches} search(es), ` +
        `~$${estimateCost(usage, model).toFixed(4)}`
      );
      rawBySource.push({ source, events });
    } catch (err) {
      console.log(`FAILED — ${err.message.split("\n")[0]}`);
      errors.push({ source: source.name, error: err.message });
      // Auth failures will hit every source; stop rather than burn calls
      if (/401|403|authentication|credit/i.test(err.message)) {
        console.log("\nStopping early — this looks like an auth or credit problem.");
        break;
      }
    }
  }

  const { events, rejected } = normalize(rawBySource);

  console.log(`\n${"─".repeat(56)}`);
  console.log(`Accepted:  ${events.length} events`);
  console.log(`Rejected:  ${rejected.length} (failed validation)`);
  console.log(`Errors:    ${errors.length} source(s)`);
  console.log(`Tokens:    ${totals.inputTokens.toLocaleString()} in / ${totals.outputTokens.toLocaleString()} out`);
  console.log(`Searches:  ${totals.searches}`);
  console.log(`Est. cost: $${estimateCost(totals, model).toFixed(4)}`);
  console.log(`${"─".repeat(56)}\n`);

  if (rejected.length) {
    console.log("Rejected events (tune the prompt if these look wrong):");
    rejected.slice(0, 15).forEach((r) =>
      console.log(`  • [${r.source}] ${r.name} — ${r.reasons.join("; ")}`)
    );
    if (rejected.length > 15) console.log(`  … and ${rejected.length - 15} more`);
    console.log();
  }

  if (events.length) {
    console.log("Accepted events — VERIFY THESE AGAINST THE REAL SITES:");
    events.forEach((e) =>
      console.log(`  • ${e.startDate}  ${e.name} — ${e.venue || "?"}, ${e.city || "?"} [${e.confidence}]`)
    );
    console.log();
  }

  const outPath = args.out || "scanner/output/events.json";
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify({
    scannedAt: new Date().toISOString(),
    model,
    filters: { state: args.state || null, age: args.age || null, month: args.month || null },
    usage: totals,
    estimatedCostUsd: Number(estimateCost(totals, model).toFixed(4)),
    events, rejected, errors,
  }, null, 2));

  console.log(`Written to ${outPath}`);
  console.log(`All events are status="pending" — review before publishing.\n`);
}

main().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exit(1);
});
