// src/lib/cache.js
//
// Caches live scan results per state so the UI never has to make the user wait
// (or click a button) for filtering.
//
// The key insight: we fetch by STATE ONLY — at most 4 possible values
// (AL / FL / MS / all). Age, month, area, tour, and search then filter that
// cached set instantly in the browser. This makes the app feel instant AND cuts
// API cost dramatically, because changing the age filter no longer triggers a
// paid scan.
//
// Phase 2 replaces this with a server-side cache in Cosmos DB, so one scan
// serves every visitor instead of one browser.

const KEY = "playfinder:live-cache-v1";
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours — tournament schedules move slowly

function readAll() {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(obj) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(obj));
  } catch {
    /* quota or private mode — cache is a nice-to-have, never required */
  }
}

/** Returns { events, fetchedAt, stale } or null if never fetched. */
export function get(state) {
  const all = readAll();
  const entry = all[state || "all"];
  if (!entry) return null;
  const age = Date.now() - entry.fetchedAt;
  return {
    events: entry.events || [],
    fetchedAt: entry.fetchedAt,
    stale: age > TTL_MS,
  };
}

export function set(state, events) {
  const all = readAll();
  all[state || "all"] = { events, fetchedAt: Date.now() };
  writeAll(all);
}

export function clear() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Human-readable freshness, e.g. "updated 3 hours ago". */
export function freshness(fetchedAt) {
  if (!fetchedAt) return null;
  const mins = Math.floor((Date.now() - fetchedAt) / 60000);
  if (mins < 1) return "updated just now";
  if (mins < 60) return `updated ${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `updated ${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `updated ${days} day${days === 1 ? "" : "s"} ago`;
}
