---
name: build-site
description: Design and build (or redesign) a Site Studio website from its brief in studio/ideas/<slug>.md. Use when the user asks to build, design, draft, mock up or change a site in studio/sites/.
---

# Build a site from a brief

1. Find the brief `studio/ideas/<slug>.md`. If there isn't one, run the `new-idea` skill first
   (a one-paragraph brief is fine for small personal pages).
2. Hand the work to the **site-designer** agent (Agent tool, `subagent_type: site-designer`) with
   the slug and anything the user said in chat that isn't in the brief. For a small tweak to an
   existing site, just make the edit yourself.
3. When it returns, verify independently:
   - `npm run studio:validate -- <slug>` passes.
   - Look at the screenshots in `studio/.out/shots/` (desktop + mobile). If something looks off,
     fix it before showing the user.
4. Update the brief frontmatter `status: building` (first draft) and `site: studio/sites/<slug>`.
   Set site.json `"status": "draft"` (or `"review"` once the owner has seen it).
5. Commit (`studio: build <slug>`) and push the working branch. Show the user the screenshots and
   the placeholder checklist. Suggest a preview link: opening a PR to `main` with `"targets":
   ["azure"]` gives a private-ish preview URL to share with a client before anything goes live.
