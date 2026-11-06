# PlayFinder — Junior Golf Tournaments on the Gulf Coast

Parents search every junior golf tournament on the Gulf Coast by golfer's age,
distance from home, dates, tour and tournament type — refreshed daily from each
tour's own published schedule. First region: Alabama · Florida · Mississippi.

> **Account rule:** this is a personal project. Use only the personal GitHub
> (`rchampion2323`) and personal Azure account (`rchampion23@gmail.com`).
> Never use work accounts, the Volaris/Covenir Azure tenant, or Covenir AWS.
> Always verify the Subscription dropdown when creating Azure resources.

## How it works

```
GitHub Actions, every morning            Azure Static Web Apps
┌───────────────────────────────┐        ┌────────────────────────────┐
│ scanner/pull.js               │ commit │ React site (src/)          │
│  Claude reads each tour's     │───────▶│  reads /data/tournaments.json
│  schedule → checks → publish  │ deploy │  filters in the browser    │
│  (odd records held for review)│        │  instant, no backend calls │
└───────────────────────────────┘        └────────────────────────────┘
```

- One pull serves every visitor: search is instant and costs nothing per visit.
- Every tournament links to the organizer's own page; the site says when the
  data was last refreshed and always tells parents to confirm before traveling.
- Details of the pull and the review rules: [`scanner/README.md`](scanner/README.md).

## What parents can do (today)

- Filter by golfer's age (6–18), boys/girls, distance from a Gulf Coast city or
  their current location, time window, tournament type (first tournaments,
  ranked, state championships, national & elite, qualifiers), or keyword.
- Sort by soonest or closest; results grouped by month.
- Open a tournament for divisions, format, fee, entry deadline, directions,
  the entry link, and **Add to calendar** (.ics).
- Save tournaments on the device (☆). Share a search — filters live in the URL.
- "Tours & ages" explains which tours suit which ages.

## Run locally

```bash
npm install
node scanner/make-sample.js   # labelled SAMPLE data, if you don't have real data yet
npm run dev                   # http://localhost:5173
npm run build                 # → dist/
```

## Deploy

`.github/workflows/azure-static-web-apps.yml` builds
and deploys on every push to `main` (and gives each pull request a preview URL).
The daily pull starts it after committing new data. It deploys with the repo secret
`AZURE_STATIC_WEB_APPS_API_TOKEN` (the Static Web App's deployment token).

## Roadmap

| Round | Scope | Status |
|---|---|---|
| 1 | Real dated tournaments (daily pull), new search UI, calendar export | **this round** |
| 2 | Parent accounts: kids' profiles, saved searches, synced saved tournaments | next |
| 3 | Email alerts: new matches, registration opening/closing | |
| 4 | Map view; more Gulf Coast states (LA, TX, GA) | |
| 5 | Nationwide | |

Accounts (round 2) need a database (Cosmos DB free tier) and sign-in. Azure
Static Web Apps' Free plan only offers GitHub and Microsoft sign-in; Google and
Apple sign-in for parents needs the Standard plan (~$9/month) or a separate
auth provider — decide before round 2.

## Data accuracy

Never remove the "confirm with the organizer" notes — a wrong date sends a
family on a long drive to nothing. The pull only publishes dates Claude read on
the tour's own pages, rejects impossible records, and holds anything unusual
for review.
