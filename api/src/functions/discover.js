// api/src/functions/discover.js
//
// POST /api/discover
// Body: { state, known: ["SJGT", "HJGT", ...] }
// Returns: { sources: [{ name, url, states, cat }] }
//
// Powers the "Find missing tours" button. This is what makes coverage
// self-expanding instead of limited to a hand-built list.

import { app } from "@azure/functions";
import { callClaude, parseJsonArray, jsonResponse, rateLimit } from "../lib/claude.js";

const STATE_NAMES = { AL: "Alabama", FL: "Florida", MS: "Mississippi" };

app.http("discover", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    const limit = rateLimit(request);
    if (!limit.allowed) {
      return jsonResponse(429, {
        error: "RATE_LIMITED",
        message: "Too many discovery scans from this address. Try again later.",
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { error: "BAD_REQUEST", message: "Body must be JSON." });
    }

    const state = body?.state;
    // Cap the known-list size so a caller can't inflate our token bill
    const known = Array.isArray(body?.known)
      ? body.known.slice(0, 80).map((s) => String(s).slice(0, 120))
      : [];

    const stateTxt = !state || state === "all"
      ? "Alabama, Florida (especially the Panhandle/Emerald Coast), and Mississippi"
      : STATE_NAMES[state] || state;

    const prompt = `Today's date is ${new Date().toDateString()}.

Search the web to find junior golf TOURS, TOUR SERIES, and SANCTIONING ORGANIZATIONS that run competitive tournaments for juniors (ages 6-18) in ${stateTxt}.

Include SMALL REGIONAL AND LOCAL operators, not just national tours — for example area junior tour series, city or county junior golf associations, and regional tour operators. Those are the ones most often missed.

I ALREADY KNOW ABOUT THESE — EXCLUDE THEM: ${known.join("; ") || "(none)"}

Find organizations NOT on that list. Only include real organizations you verified via search.

Respond with ONLY a JSON array — no markdown fences, no commentary. Up to 8 objects with exactly these keys:
  "name": organization name
  "url": its website (full https URL)
  "states": array containing any of "AL", "FL", "MS"
  "cat": one short sentence on what it runs and which ages

Respond with [] if you find nothing new.`;

    try {
      const { text, usage } = await callClaude(prompt, { maxTokens: 1500 });
      const knownLower = new Set(known.map((k) => k.toLowerCase()));

      const sources = parseJsonArray(text)
        .filter((s) => s && String(s.name || "").trim().length > 2)
        .filter((s) => !knownLower.has(String(s.name).toLowerCase()))
        .map((s) => {
          let url = String(s.url || "").trim();
          try { new URL(url); } catch { url = ""; }
          const states = Array.isArray(s.states)
            ? s.states.map((x) => String(x).toUpperCase()).filter((x) => ["AL","FL","MS"].includes(x))
            : [];
          return {
            name: String(s.name).trim(),
            url,
            states: states.length ? states : ["all"],
            cat: String(s.cat || "").trim().slice(0, 300),
          };
        })
        .slice(0, 8);

      context.log(`discover (${state || "all"}): ${sources.length} new sources, ${usage.searches} searches`);
      return jsonResponse(200, { sources, usage });
    } catch (err) {
      context.error(`discover failed: ${err.code} ${err.message} ${err.detail || ""}`);
      if (err.code === "NO_KEY") {
        return jsonResponse(503, {
          error: "NOT_CONFIGURED",
          message: "ANTHROPIC_API_KEY is not set in Azure Application Settings.",
        });
      }
      if (err.code === "BAD_KEY") {
        return jsonResponse(503, { error: "BAD_KEY", message: "The Anthropic API key was rejected." });
      }
      return jsonResponse(502, { error: err.code || "API_ERROR", message: "Discovery failed. Try again." });
    }
  },
});
