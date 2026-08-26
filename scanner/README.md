# Scanner

Extracts real tournament data using the Anthropic API's web search tool.
Runs in Node only — **never in the browser**, because it holds the API key.

## Setup

1. Create a key at https://console.anthropic.com → API Keys
2. **Set a monthly spend limit in the console first** (Settings → Limits).
   Cap it at $10–20. This makes a runaway loop impossible.
3. Export it locally — never commit it, never paste it into a chat:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

## Cost-test sequence

Start with a dry run (free), then scale up deliberately:

```bash
# 1. Free — shows the plan, makes no API calls
node scanner/run.js --dry-run --limit=3 --state=AL

# 2. Cheapest real test — three sources with structured schedule pages
node scanner/run.js --only=sjgt
node scanner/run.js --only=hjgt
node scanner/run.js --only=fsga

# 3. Compare models on the same source
SCAN_MODEL=claude-haiku-4-5-20251001 node scanner/run.js --only=sjgt
SCAN_MODEL=claude-sonnet-5           node scanner/run.js --only=sjgt

# 4. Once accuracy looks good, widen
node scanner/run.js --state=AL --limit=8
node scanner/run.js                      # full scan
```

Every run prints tokens used, searches made, and an estimated cost.
Rates in `run.js` are approximations — verify at https://claude.com/pricing.

## Cost controls

| Control | Where | Effect |
|---|---|---|
| Console spend limit | console.anthropic.com | Hard ceiling. Set this first. |
| `MAX_SEARCHES` | env var (default 3) | Caps web searches per source — the dominant cost |
| `--limit=N` | CLI flag | Scan fewer sources |
| `SCAN_MODEL` | env var | Haiku is cheapest; Sonnet is more accurate on messy pages |
| Sequential execution | `run.js` | One call at a time; no runaway parallelism |

## What to check on your first real run

The output file (`scanner/output/events.json`) has three arrays:

- **`events`** — passed validation. Pick 3 and verify against the organizer's
  actual page. This is the only test that matters.
- **`rejected`** — failed validation, with reasons. A high count usually means
  the prompt needs tightening, not that the tour has no events.
- **`errors`** — source-level failures (auth, network, rate limits).

Everything is written with `status: "pending"`. Nothing reaches users until you
review it. Keep that gate — a wrong date sends a family on a three-hour drive
to a tournament that doesn't exist.

## Files

- `scan.js` — one API call per source; capped web searches; usage tracking
- `normalize.js` — validation, confidence scoring, cross-source dedupe
- `run.js` — CLI with dry-run, filters, and cost reporting
