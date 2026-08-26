// API adapter — the ONLY place in the front end that knows about URLs.
//
// IMPORTANT: the Claude artifact version called api.anthropic.com directly from
// the browser. That only works inside Claude.ai, where Anthropic injects the key.
// In production you must NEVER ship an API key to the browser — it would be
// extracted within hours. All AI calls go through your own backend instead.
//
// Phase 1 (now):     no backend. Scans return NOT_CONFIGURED and the UI shows a
//                    friendly message. Reference data + filters + pins all work.
// Phase 2:           /api/events serves cached tournaments from Cosmos DB.
// Phase 3:           the weekly GitHub Actions scanner populates that database;
//                    /api/scan optionally triggers an on-demand refresh (admin).

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export const NOT_CONFIGURED = "NOT_CONFIGURED";

async function call(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  // 404 = the API isn't deployed at all (Phase 1, before Azure).
  if (res.status === 404) return { error: NOT_CONFIGURED };

  // The Functions return structured errors; pass them through so the UI can
  // tell "key not configured" apart from "rate limited" apart from "failed".
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON error page */ }

  if (!res.ok) {
    return body?.error
      ? body
      : { error: "API_ERROR", message: `Request failed (${res.status}).` };
  }
  return body ?? {};
}

/**
 * Fetch events. Phase 1 returns null so the app falls back to bundled seed data.
 */
export async function fetchEvents(filters = {}) {
  try {
    const qs = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v && v !== "any" && v !== "all")
    ).toString();
    const data = await call(`/events${qs ? `?${qs}` : ""}`);
    if (data?.error === NOT_CONFIGURED) return null;
    return data;
  } catch {
    return null; // fall back to seed data
  }
}

/**
 * Ask the backend for freshly scanned events for one source.
 * Phase 1: returns { error: NOT_CONFIGURED }.
 */
export async function scanSource({ source, state, age, month }) {
  try {
    return await call("/scan", {
      method: "POST",
      body: JSON.stringify({ source, state, age, month }),
    });
  } catch {
    return { error: "NETWORK", message: "Could not reach the server." };
  }
}

/**
 * Ask the backend to discover sanctioning organizations not yet in the list.
 * Phase 1: returns { error: NOT_CONFIGURED }.
 */
export async function discoverSources({ state, known }) {
  try {
    return await call("/discover", {
      method: "POST",
      body: JSON.stringify({ state, known }),
    });
  } catch {
    return { error: "NETWORK", message: "Could not reach the server." };
  }
}

/** Free diagnostic — is the API deployed and is the key configured? */
export async function health() {
  try {
    return await call("/health");
  } catch {
    return { error: "NETWORK" };
  }
}

/**
 * User-submitted correction or missing tournament.
 * Feeds the review queue described in the build plan — this is how the parent
 * community becomes your QA layer.
 */
export async function reportIssue(payload) {
  try {
    return await call("/report", { method: "POST", body: JSON.stringify(payload) });
  } catch {
    return { error: NOT_CONFIGURED };
  }
}
