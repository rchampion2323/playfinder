// scanner/scan.js
//
// Calls the Anthropic API with the web_search tool to extract real tournament
// data for one source. Runs ONLY in Node (GitHub Actions or your laptop) —
// never in the browser, because it holds the API key.
//
// Key comes from process.env.ANTHROPIC_API_KEY. Never hardcode it.

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

// Model is configurable so you can cost-compare. Haiku is cheapest and usually
// sufficient for structured extraction; switch to Sonnet if date parsing on
// messy schedule pages proves unreliable.
// Verify current model strings at https://docs.claude.com
const MODEL = process.env.SCAN_MODEL || "claude-haiku-4-5-20251001";

// Hard cap on searches per source. This is your primary cost control —
// web search is billed per request and is the dominant cost of a scan.
const MAX_SEARCHES_PER_SOURCE = Number(process.env.MAX_SEARCHES || 3);

const MONTH_NAMES = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];

function buildPrompt(source, { state, age, month, today }) {
  const stateTxt = !state || state === "all"
    ? "Alabama, Florida, or Mississippi"
    : { AL: "Alabama", FL: "Florida", MS: "Mississippi" }[state] || state;
  const ageTxt = !age || age === "any"
    ? "juniors ages 6-18"
    : `a ${age}-year-old junior golfer`;
  const monthTxt = !month || month === "any"
    ? "in the next 6 months"
    : `in ${MONTH_NAMES[Number(month) - 1]}`;

  return `Today's date is ${today}.

Search the web for: ${source.scan}
Primary site to check: ${source.url}

Find UPCOMING competitive junior golf tournaments run by this organization in ${stateTxt}, suitable for ${ageTxt}, taking place ${monthTxt}.

CRITICAL RULES:
- Only include events you actually found and verified via search. Do NOT guess, infer, or fill in from general knowledge.
- Every event MUST have a specific start date you saw on a page. If you cannot find a real date, omit the event entirely.
- Omit events whose date has already passed.
- Prefer the organization's own schedule page over third-party summaries.

Respond with ONLY a JSON array — no markdown fences, no commentary. Each object must have exactly these keys:
  "name": official event name
  "startDate": "YYYY-MM-DD"
  "endDate": "YYYY-MM-DD" (same as startDate for one-day events)
  "venue": course name
  "city": "City, ST"
  "state": "AL" | "FL" | "MS"
  "ageMin": number
  "ageMax": number
  "divisions": array of division name strings (empty array if unknown)
  "fee": string (empty string if unknown)
  "url": direct URL to the event or its schedule page
  "sourceNote": one short phrase naming where you found this (e.g. "SJGT schedule page")

Respond with [] if you cannot verify any events.`;
}

/**
 * Scan a single source. Returns { events, usage, raw }.
 * Throws on HTTP/auth errors so the caller can report them.
 */
export async function scanSource(source, opts = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set.\n" +
      "  Local:  export ANTHROPIC_API_KEY=sk-ant-...\n" +
      "  CI:     add it as a GitHub repository secret.\n" +
      "Never commit the key or paste it into a chat."
    );
  }

  const today = opts.today || new Date().toDateString();
  const body = {
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: buildPrompt(source, { ...opts, today }) }],
    tools: [{
      type: "web_search_20250305",
      name: "web_search",
      max_uses: MAX_SEARCHES_PER_SOURCE,
    }],
  };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": API_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status} for "${source.name}": ${text.slice(0, 300)}`);
  }

  const data = await res.json();

  // Assemble text blocks by TYPE, not position — responses interleave
  // text, server_tool_use, and web_search_tool_result blocks.
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const events = parseEventJson(text);

  return {
    events,
    usage: {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      searches: data.usage?.server_tool_use?.web_search_requests ?? 0,
    },
    raw: text,
  };
}

/**
 * Extract a JSON array from the model's text, tolerating stray prose or fences.
 */
export function parseEventJson(text) {
  if (!text) return [];
  const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = clean.indexOf("[");
  const end = clean.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  try {
    const parsed = JSON.parse(clean.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
