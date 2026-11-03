---
name: deploy-site
description: Publish a Site Studio site to Azure Static Web Apps and/or GitHub Pages, share a preview link, attach a custom domain, or check deployment status. Use when the user wants a site live, previewed, shared, moved, or taken down.
---

# Deploy a site

Deploys are done by `.github/workflows/studio-sites.yml`, never by hand from the agent's machine.
Read `studio/README.md → One-time setup` if the repo secrets aren't set yet.

## Before anything goes live
- Confirm with the user: which site, which target(s), and that placeholders are resolved
  (`npm run studio:validate -- <slug>` should show no placeholder warnings for a client site).
- Confirm the Azure subscription is the **personal** one (bootstrap enforces this; never use work tenants).

## Choose targets (site.json → `targets`)
- `"azure"` — Azure Static Web Apps, Free tier: own `*.azurestaticapps.net` URL, free SSL,
  custom domains, preview URL per PR. Best for clients. (Free tier allows ~10 apps per subscription.)
- `"github-pages"` — `https://rchampion2323.github.io/playfinder/<slug>/`. Best for quick personal pages.
  Pages has no previews, so it only publishes from `main`.

## Preview → production
1. Set `targets`, `status: "review"`, commit, push the working branch.
2. Open a PR to `main` (only when the user asks). The workflow validates, provisions the Static Web
   App, and posts a **preview URL** on the PR — share that with the client.
3. When approved, merge (user's call). The workflow deploys production and writes the URL to the
   run summary. Record it: site.json `azure.url`, `status: "live"`; brief `status: live`.
4. Manual redeploy: Actions → "Studio sites" → Run workflow → slug or `all`.

## Custom domain (Azure)
1. Client adds a DNS CNAME `www` → the site's `*.azurestaticapps.net` host
   (apex domains: use a TXT validation record + ALIAS/ANAME, per Azure's portal instructions).
2. Then: `az staticwebapp hostname set -n swa-<slug> -g rg-studio-sites --hostname www.example.com`
3. Save it in site.json `azure.customDomain`.

## Status / troubleshooting
- `npm run studio:status` — pipeline overview.
- Use the GitHub tools to read the latest "Studio sites" run and its logs.
- `AADSTS700213`/"no matching federated identity": the run came from a branch other than `main`
  or a PR; only those subjects are trusted — re-run bootstrap after changing repos.
- Take a site down: remove its target and merge, then delete the resource:
  `az staticwebapp delete -n swa-<slug> -g rg-studio-sites` (ask the user first — irreversible).
