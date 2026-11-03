# Site Studio

A pipeline for turning ideas into websites — for yourself and for small businesses — and shipping
them to **Azure Static Web Apps** and/or **GitHub Pages**, with Claude as the designer/builder.

```
 Idea ──▶ Brief ──▶ Build ──▶ Preview ──▶ Live
 issue    ideas/    sites/    PR + Azure   main →
 or chat  <slug>.md <slug>/   preview URL  Azure / Pages
```

| Folder | What lives there |
|---|---|
| `ideas/` | One markdown brief per idea (`_TEMPLATE.md` is the starting point) |
| `templates/` | Starter designs: `small-business`, `personal`, `launch` |
| `sites/` | One folder per site, each with a `site.json` |
| `infra/` | `static-site.bicep` (one Static Web App per site) and `bootstrap.sh` (one-time Azure ↔ GitHub setup) |
| `scripts/` | Zero-dependency Node tools: new, validate, serve, build, plan, status |

The agent side lives in `CLAUDE.md`, `.claude/agents/site-designer.md`, and the skills in
`.claude/skills/` (`new-idea`, `build-site`, `deploy-site`).

---

## Everyday use

**From Claude Code** (CLI, desktop, web, or phone) in this repo, just talk:

> "New idea: a site for my neighbor's lawn care business in Gulf Breeze…"
> "Build the gulf-breeze-lawn site." · "Make the hero warmer." · "Put it on Azure and give me a preview link."

**From GitHub**: New issue → **Website idea** form. Comment `@claude build this` on the issue
(needs the one-time `CLAUDE_CODE_OAUTH_TOKEN` secret below) and Claude opens a PR with a draft.

**By hand**:

```bash
npm run studio:new -- --name "Gulf Breeze Lawn Co" --template small-business \
  --tagline "Lawns done right, every other Tuesday" --primary "#2f5d3a" --accent "#e2b04a" \
  --email hi@example.com --phone "(850) 555-0123" --city "Gulf Breeze, FL" --owner client
npm run studio:serve -- gulf-breeze-lawn-co    # http://localhost:4173
npm run studio:validate
npm run studio:status
```

## site.json

```jsonc
{
  "slug": "gulf-breeze-lawn-co",
  "name": "Gulf Breeze Lawn Co",
  "template": "small-business",
  "owner": "client",               // personal | client  (tags the Azure resource)
  "status": "draft",               // draft | review | live | archived
  "targets": [],                   // add "azure" and/or "github-pages" to deploy
  "azure": { "name": "swa-gulf-breeze-lawn-co", "sku": "Free", "customDomain": "", "url": "" },
  "build": { "command": "", "output": "." },   // e.g. "npm ci && npm run build" / "dist" for a Vite site
  "forms": { "endpoint": "" }      // optional form backend; blank = opens the visitor's email app
}
```

Only files a visitor needs are published — `site.json`, `*.md`, `package*.json`, `src/` and
`node_modules/` are stripped by `scripts/build.mjs`.

## How deploys work

`.github/workflows/studio-sites.yml`:

- **Pull request** → validates every site, provisions the Static Web App (Bicep), deploys changed
  Azure sites to a **preview environment** and comments the URL on the PR. Closing the PR deletes it.
- **Push to `main`** → deploys changed sites to production. Azure URL appears in the run summary.
  GitHub Pages sites publish to `https://rchampion2323.github.io/playfinder/<slug>/`.
- **Actions → Studio sites → Run workflow** → redeploy one site or `all`.

Azure auth is OpenID Connect: GitHub gets a short-lived token per run; no Azure passwords are stored.
The deployer identity can only touch one resource group (`rg-studio-sites`).

PlayFinder's own workflow ignores `studio/**`, so Studio changes never redeploy PlayFinder.

---

## One-time setup

You need the Azure CLI (`az`), Node 18+, and optionally the GitHub CLI (`gh`) on your own machine.
Use the personal accounts only — see the account rule in the main README.

```bash
az login                        # personal account; check the subscription it picks
az account set --subscription "<your personal subscription>"
gh auth login                   # optional: lets the script set repo secrets & enable Pages
bash studio/infra/bootstrap.sh
```

The script refuses to run if you're signed in as anyone other than `azure.expectedAccount` in
`studio.config.json`, and asks you to type the subscription name before it changes anything.

Then, optionally, for `@claude` on GitHub issues/PRs: run `claude setup-token` locally and save the
result as the repo secret `CLAUDE_CODE_OAUTH_TOKEN` (or use `/install-github-app` in Claude Code).

### Costs
- Azure Static Web Apps **Free**: $0 — 100 GB bandwidth/month per subscription, 2 custom domains
  per app, ~10 free apps per subscription. Upgrade a client site to `"sku": "Standard"` (~$9/month)
  if it needs more, then bill the client.
- GitHub Pages and Actions: free on a public repo.
- Set an Azure budget alert anyway: Portal → Cost Management → Budgets → $5.

### Privacy note
If this repo is public, everything in `ideas/` is public too. Keep client phone numbers,
emails and notes you wouldn't publish out of briefs — or move Studio to a **private** repo
(everything here is self-contained: copy `studio/`, `.claude/`, `CLAUDE.md`,
`.github/ISSUE_TEMPLATE/`, `.github/workflows/studio-sites.yml` and `claude.yml`, then update
`studio.config.json → github` and re-run bootstrap).
