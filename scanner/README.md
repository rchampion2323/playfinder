# Scanner — the daily tournament pull

Turns each tour's published schedule into `public/data/tournaments.json`, the
file the site reads. Runs every morning in GitHub Actions
(`.github/workflows/pull-tournaments.yml`); never in the browser.

```
for each tour in scanner/sources.js
  Claude reads the tour's schedule page (web fetch + search)  → scanner/extract.js
  every record is checked: real dates, ages, state, link      → scanner/normalize.js
  city → map coordinates (cached in geocache.json)            → scanner/geocode.js
  clean records publish; odd ones are held for review         → scanner/pull.js
commit tournaments.json → redeploy the site
```

## Publishing rule

- **Rejected** (never shown): impossible dates, finished events, ages outside 4–19,
  states outside coverage, no link to the tournament.
- **Held for review** (not shown until approved): more than 18 months out,
  longer than a week, fee over $1,200, city that can't be placed on the map,
  entry deadline after the event, date moved by more than 3 weeks.
- **Published**: everything else.
- If a tour that had 3+ tournaments suddenly returns none, or errors, its
  previous list is kept and the run summary says so.

Held tournaments are listed in an open **"Tournaments to review"** issue. Approve
or hide one by adding its id to `scanner/review.json`:

```json
{ "approve": ["hjgt--hjgt-destin-junior--2027-04-10"], "reject": [] }
```

## Setup

1. Create an API key at https://console.anthropic.com and **set a monthly spend
   limit first** (Settings → Limits).
2. GitHub → this repo → Settings → Secrets and variables → Actions →
   New repository secret: `ANTHROPIC_API_KEY`.
3. Optional repository *variable* `SCAN_MODEL`. Default `claude-opus-5-5`
   (most reliable reading of messy schedule pages). `claude-haiku-5-5` costs a
   small fraction as much; compare one run of each before switching.
4. Actions → **Pull tournaments** → Run workflow (try `only: hjgt` first).

## Running locally

```bash
export ANTHROPIC_API_KEY=...            # never commit it or paste it in a chat
node scanner/pull.js --dry-run          # free: lists the sources it would read
node scanner/pull.js --only=hjgt        # one tour
node scanner/make-sample.js             # writes labelled SAMPLE data for design work
```

Testing the merge without the API: `PULL_FIXTURE=fixture.json node scanner/pull.js --only=hjgt`
where the fixture maps source ids to arrays of raw tournaments (or `"error"`).

## Cost

Each run prints token, search and fetch counts plus an estimate (in the Actions
run summary). Roughly: 21 sources × a few page fetches each. Check the first
real run's estimate, then pick the model and schedule that fit your budget.
