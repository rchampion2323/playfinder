// api/src/lib/claude.js
//
// Shared helper for calling the Anthropic API from Azure Functions.
//
// THE API KEY LIVES ONLY IN AZURE APPLICATION SETTINGS.
// It is read here as process.env.ANTHROPIC_API_KEY and never sent to the browser.
// Nothing in src/ (the front end) can see it.

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

// Cheapest capable model by default. Override with the SCAN_MODEL app setting.
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

// Caps web searches per request — the dominant cost of a scan.
const MAX_SEARCHES = Number(process.env.MAX_SEARCHES || 3);

/**
 * Domains the scanner is allowed to be pointed at. Because /api/scan is a
 * public endpoint that spends real money, we never let a caller supply an
 * arbitrary URL — only known junior-golf sanctioning bodies.
 */
const ALLOWED_HOSTS = [
  "sjgt.com", "hjgt.org", "fsga.org", "alabamagolf.org", "msgolf.org",
  "uskidsgolf.com", "ajga.org", "pga.com", "dixie.pga.com", "gulfstates.pga.com",
  "nfpga.pga.com", "sfpga.pga.com", "pkbgt.org", "fcwtgolf.com", "ijgt.com",
  "futuremasters.org", "jrorangebowl.org", "southerngolf.org", "usga.org",
  "drivechipandputt.com", "pgajrleague.com", "nb3jgnc.com", "optimist.org",
  "juniorgolfscoreboard.com", "amateurgolf.com", "firsttee.org", "ahsaa.com",
  "emeraldcoastjuniorgolftour.com",
];

export function isAllowedSource(url) {
  if (!url) return true; // sources without a URL still get a text-only search
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Very simple in-memory rate limiter, keyed by caller IP.
 *
 * This is a speed bump, not a wall — Functions instances recycle and scale, so
 * the counter resets. It's enough to stop casual abuse of a paid endpoint.
 * The real fix is Phase 2: serve cached scan results from the database and make
 * live scanning admin-only.
 */
const hits = new Map();
const WINDOW_MS = 60 * 60 * 1000;   // 1 hour
const MAX_PER_WINDOW = Number(process.env.RATE_LIMIT_PER_HOUR || 20);

export function rateLimit(request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-azure-clientip") ||
    "unknown";
  const now = Date.now();
  const entry = hits.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + WINDOW_MS; }
  entry.count += 1;
  hits.set(ip, entry);

  // Opportunistic cleanup so the map can't grow unbounded
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
  }

  return {
    allowed: entry.count <= MAX_PER_WINDOW,
    remaining: Math.max(0, MAX_PER_WINDOW - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Call Claude with the web_search tool. Returns { text, usage }.
 */
export async function callClaude(prompt, { maxTokens = 2000, useSearch = true } = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error("ANTHROPIC_API_KEY is not configured in Azure Application Settings.");
    err.code = "NO_KEY";
    throw err;
  }

  const body = {
    model: process.env.SCAN_MODEL || DEFAULT_MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  };
  if (useSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES }];
  }

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
    const detail = await res.text();
    const err = new Error(`Anthropic API ${res.status}`);
    err.code = res.status === 401 ? "BAD_KEY" : res.status === 429 ? "RATE_LIMITED" : "API_ERROR";
    err.detail = detail.slice(0, 400);
    throw err;
  }

  const data = await res.json();

  // Assemble by block TYPE, never by position — responses interleave text,
  // server_tool_use, and web_search_tool_result blocks.
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  return {
    text,
    usage: {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      searches: data.usage?.server_tool_use?.web_search_requests ?? 0,
    },
  };
}

/** Pull a JSON array out of model text, tolerating fences or stray prose. */
export function parseJsonArray(text) {
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

export function jsonResponse(status, payload) {
  return {
    status,
    headers: { "Content-Type": "application/json" },
    jsonBody: payload,
  };
}
