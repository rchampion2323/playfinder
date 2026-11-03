---
name: new-idea
description: Capture a website idea (personal, small-business client, or product test) into the Site Studio funnel as a brief in studio/ideas/. Use when the user describes a new site idea, pastes a client request, or points at a GitHub "Website idea" issue.
---

# Capture an idea → brief

Goal: a brief good enough that the `site-designer` agent can build a first draft without guessing.

1. **Gather the input.** It may be a chat message, pasted notes/email, or a GitHub issue created
   from the "Website idea" form (read it with the GitHub tools). Don't ask for what's already there.
2. **Pick the slug**: lowercase-dashed name, ≤ 40 chars (e.g. `gulf-breeze-bakery`). Check
   `studio/ideas/` and `studio/sites/` so it isn't taken.
3. **Copy `studio/ideas/_TEMPLATE.md` to `studio/ideas/<slug>.md`** and fill every section you can.
   Set frontmatter `status: idea` if important questions remain, `status: brief` if it's buildable.
   Link the issue number in `source:` when there is one.
4. **Ask only the questions that block a good first draft** — at most 5, in one message, using
   AskUserQuestion when options are clear-cut. Typical blockers: the main action the site should
   drive, who it's for, real contact details, hosting target. Everything else can be a placeholder.
5. **Recommend a template** (`small-business`, `personal`, `launch`) and hosting
   (Azure SWA for clients/custom domains/preview links; GitHub Pages for quick personal pages).
6. Commit the brief on the working branch (`studio: add idea <slug>`). Run `npm run studio:status`
   and show the user where it sits in the pipeline. Offer to continue with `build-site`.
