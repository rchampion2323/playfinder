# Repo guide for Claude

This repo holds two things:

1. **PlayFinder** (root, `src/`, `api/`, `scanner/`) — the junior golf directory. Deployed by
   `.github/workflows/azure-static-web-apps-*.yml`. See `README.md`.
2. **Site Studio** (`studio/`) — a pipeline for turning ideas into websites for the owner and
   small-business clients, deployed to Azure Static Web Apps and/or GitHub Pages.
   See `studio/README.md`.

Keep the two separate: Studio work never touches PlayFinder files and vice versa.

## Account rules (non-negotiable)

- Personal accounts only: GitHub `rchampion2323`, personal Azure subscription
  (the account in `studio/studio.config.json → azure.expectedAccount`).
- Never use work accounts, the Volaris/Covenir Azure tenant, or Covenir AWS.
- Never commit secrets, API keys, deployment tokens or client personal data beyond
  what will be published on the client's own site.

## Site Studio workflow

Use the skills — they hold the detailed steps:

| Stage | Skill | Output |
|---|---|---|
| Capture an idea | `new-idea` | `studio/ideas/<slug>.md` (status: idea → brief) |
| Design & build | `build-site` (uses the `site-designer` agent) | `studio/sites/<slug>/` |
| Ship | `deploy-site` | site.json `targets`, merged to `main`, live URL |

Commands (Node 18+, no install needed):

```bash
npm run studio:status                 # every idea and site, with status and URLs
npm run studio:new -- --name "X" --template small-business|personal|launch
npm run studio:serve -- <slug>        # preview at http://localhost:4173
npm run studio:validate               # must pass before committing a site
```

Rules for sites:
- Plain HTML/CSS/JS by default; use **relative** links only (GitHub Pages serves under a sub-path).
- Every site must pass `npm run studio:validate` with zero errors.
- Never invent facts about a real business (prices, reviews, credentials, addresses). Use what the
  brief provides; leave clearly-marked placeholders otherwise and list them for the owner.
- Reviews/testimonials must be real and attributable, or removed.
- A new site has `"targets": []` — nothing deploys until the owner chooses a target.
- Going live is outward-facing: confirm with the owner before adding a target or merging to `main`.
