// api/src/functions/scan.js
//
// POST /api/scan
// Body: { source: { name, url, scan }, state, age, month }
// Returns: { events: [...], usage: {...} }
//
// Called by the "Deep scan" button. The Anthropic key stays here on the server.

import { app } from "@azure/functions";
import {
  callClaude, parseJsonArray, jsonResponse, rateLimit, isAllowedSource,
} from "../lib/claude.js";

const MONTHS = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const STATE_NAMES = { AL: "Alabama", FL: "Florida", MS: "Mississippi" };
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function buildPrompt(source, { state, age, month }) {
  const stateTxt = !state || state === "all"
    ? "Alabama, Florida, or Mississippi"
    : STATE_NAMES[state] || state;
  const ageTxt = !age || age === "any" ? "juniors ages 6-18" : `a ${age}-year-old junior golfer`;
  const monthTxt = !month || month === "any"
    ? "in the next 6 months"
    : `in ${MONTHS[Number(month) - 1]}`;

  return `Today's date is ${new Date().toDateString()}.

Search the web for: ${source.scan || source.name + " junior golf tournament schedule"}
${source.url ? `Primary site to check: ${source.url}` : ""}

Find UPCOMING competitive junior golf tournaments run by this organization in ${stateTxt}, suitable for ${ageTxt}, taking place ${monthTxt}.

CRITICAL RULES:
- Only include events you actually found and verified via search. Do NOT guess or fill in from general knowledge.
- Every event MUST have a specific start date you saw on a page. If you cannot find a real date, omit the event entirely.
- Omit events whose date has already passed.
- Prefer the organization's own schedule page over third-party summaries.

Respond with ONLY a JSON array — no markdown fences, no commentary. Each object must have exactly these keys:
  "name", "dates" (human readable, e.g. "Apr 18-19, 2026"), "startDate" ("YYYY-MM-DD"),
  "venue", "city" ("City, ST"), "state" ("AL"|"FL"|"MS"), "ages" (e.g. "11-18"),
  "tour", "url" (direct link)

Respond with [] if you cannot verify any events.`;
}

/** Light validation — the front end shows these directly to parents. */
function clean(rows, sourceName) {
  const today = new Date(new Date().toDateString());
  const twoYears = new Date(Date.now() + 730 * 864e5);
  return rows
    .filter((r) => r && String(r.name || "").trim().length > 3)
    .filter((r) => {
      if (!ISO.test(String(r.startDate || ""))) return false;
      const d = new Date(r.startDate + "T12:00:00Z");
      return !Number.isNaN(d.getTime()) && d >= today && d <= twoYears;
    })
    .filter((r) => {
      try { new URL(r.url); return true; } catch { return false; }
    })
    .map((r) => ({
      name: String(r.name).trim(),
      dates: String(r.dates || r.startDate).trim(),
      startDate: r.startDate,
      venue: String(r.venue || "").trim(),
      city: String(r.city || "").trim(),
      state: String(r.state || "").toUpperCase().slice(0, 2),
      ages: String(r.ages || "").trim(),
      tour: String(r.tour || sourceName).trim(),
      url: String(r.url).trim(),
    }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

app.http("scan", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    // Abuse protection: this endpoint spends money
    const limit = rateLimit(request);
    if (!limit.allowed) {
      return jsonResponse(429, {
        error: "RATE_LIMITED",
        message: "Too many scans from this address. Try again later.",
        resetAt: new Date(limit.resetAt).toISOString(),
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { error: "BAD_REQUEST", message: "Body must be JSON." });
    }

    const source = body?.source;
    if (!source?.name) {
      return jsonResponse(400, { error: "BAD_REQUEST", message: "source.name is required." });
    }

    // Never let a caller point the paid scanner at an arbitrary URL
    if (!isAllowedSource(source.url)) {
      return jsonResponse(403, {
        error: "SOURCE_NOT_ALLOWED",
        message: "That source is not on the allowed list.",
      });
    }

    try {
      const { text, usage } = await callClaude(
        buildPrompt(source, { state: body.state, age: body.age, month: body.month })
      );
      const events = clean(parseJsonArray(text), source.name);
      context.log(
        `scan "${source.name}": ${events.length} events, ${usage.searches} searches, ` +
        `${usage.inputTokens}/${usage.outputTokens} tokens`
      );
      return jsonResponse(200, { events, usage, source: source.name });
    } catch (err) {
      context.error(`scan failed for "${source.name}": ${err.code} ${err.message} ${err.detail || ""}`);
      if (err.code === "NO_KEY") {
        return jsonResponse(503, {
          error: "NOT_CONFIGURED",
          message: "ANTHROPIC_API_KEY is not set in Azure Application Settings.",
        });
      }
      if (err.code === "BAD_KEY") {
        return jsonResponse(503, {
          error: "BAD_KEY",
          message: "The Anthropic API key was rejected. Check it in Application Settings.",
        });
      }
      return jsonResponse(502, { error: err.code || "API_ERROR", message: "Scan failed. Try again." });
    }
  },
});
