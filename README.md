# PlayFinder — Junior Golf & Sports Directory

Find competitive junior tournaments by age, area, and time of year.
First vertical: **Gulf Coast Junior Golf** (Alabama · Florida · Mississippi), ages 6–18.

> **Account rule:** this is a personal project. Use only the personal GitHub
> (`rchampion2323`) and personal Azure account (`rchampion23@gmail.com`).
> Never use work accounts, the Volaris/Covenir Azure tenant, or Covenir AWS.
> Tip: use a **separate Chrome profile** so work sessions can't leak in, and
> always verify the Subscription dropdown when creating Azure resources.

---

## Phase 1 status (this commit)

Working now, with no backend and no cost:

- Filter by state, player age (6–18), area, month, tour, keyword
- Sort chronologically or by area
- 28-organization source coverage checklist
- Expandable event detail (format, fee, eligibility, links)
- Pinned events saved in `localStorage`

Deliberately **not** working yet — these need Phase 3:

- Deep scan (live tournament search)
- Tour discovery (finding organizations not yet listed)

Both show a friendly "needs the backend" message rather than failing silently.

---

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # outputs to dist/
```

---

## Deploy to Azure Static Web Apps (free tier)

1. Push this repo to GitHub as **public** (free unlimited Actions minutes).
2. Azure Portal → **Create a resource** → **Static Web App**.
3. **Verify the Subscription is your personal free subscription** — not a work tenant.
4. Plan: **Free**. Source: **GitHub** → this repo, branch `main`.
5. Build presets: **Custom**
   - App location: `/`
   - Api location: `api`
   - Output location: `dist`
6. Azure adds the `AZURE_STATIC_WEB_APPS_API_TOKEN` secret and may generate its
   own workflow file. If it does, delete `.github/workflows/azure-static-web-apps.yml`
   and keep Azure's.

---

## Architecture: why the adapters exist

Two files isolate everything that changes between phases:

**`src/lib/storage.js`** — `localStorage` today. In Phase 4, swap the three
function bodies to call `/api/pins` with the signed-in user's token. No other
file changes.

**`src/lib/api.js`** — the only place URLs live. It is also the security
boundary: **the Anthropic API key must never reach the browser.** The Claude
artifact prototype called `api.anthropic.com` directly, which works only inside
Claude.ai. In production, all AI calls go through your own Functions, which read
the key from Azure app settings.

### Scanning model

Do **not** run an AI scan per user, per click. Instead:

```
GitHub Actions cron (weekly)
  → scanner/ runs one Claude web search per source
  → normalize, dedupe, validate dates
  → write to Cosmos DB with status="pending"
  → you review the diff → status="published"
  → every user reads cached data instantly
```

One scan serves all users. Cost drops from per-user to per-week
(~$5–15/month), and responses go from 30 seconds to milliseconds.

Keep the human review gate in v1: a wrong tournament date sends a family on a
three-hour drive to nothing, and that review can't be undone.

---

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | Static site, filters, local pins | **this commit** |
| 2 | Cosmos DB + `/api/events` | next |
| 3 | Weekly scanner + review queue | |
| 4 | Federated auth (Google/Apple/Microsoft), synced pins | |
| 5 | Sponsor slots, ads, optional Capacitor iOS wrap | |
| 6 | New regions and sports via config | |

### Scaling to new verticals

Almost nothing here is golf-specific. To add a region or sport, extend
`src/data/constants.js` (regions/states) and `src/data/sources.js`
(organizations), then let the discovery scan bootstrap the rest. The one genuine
rewrite is **taxonomy**: golf sorts by age division, swimming by time standards,
tennis by UTR. Keep filters driven by a taxonomy definition rather than
hardcoded age ranges.

---

## Data accuracy

`when.months` values are **typical annual windows**, not confirmed dates. The UI
labels them "TYPICAL" and tells users to verify with the organizer. Never remove
that disclaimer — it is both the honest position and your liability shield.

---

## Scanner (Phase 3 — built, ready to test)

See `scanner/README.md`. Quick start:

```bash
export ANTHROPIC_API_KEY=sk-ant-...          # set a spend limit in the console first
node scanner/run.js --dry-run --only=sjgt    # free
node scanner/run.js --only=sjgt              # ~$0.05-0.12
```

Then verify 3 of the returned events against sjgt.com before trusting anything.
