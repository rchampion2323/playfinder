// scanner/normalize.js
//
// The accuracy gate. Everything the model returns passes through here before it
// can reach the database. A wrong date sends a family on a three-hour drive to
// a tournament that doesn't exist — that's the failure mode this file prevents.

const STATES = new Set(["AL", "FL", "MS"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate one raw event. Returns { ok, event, reasons }.
 */
export function validateEvent(raw, source) {
  const reasons = [];
  const name = String(raw?.name || "").trim();
  if (!name || name.length < 4) reasons.push("missing or too-short name");

  // Dates must be real ISO dates, not invented strings
  const startDate = String(raw?.startDate || "").trim();
  if (!ISO_DATE.test(startDate)) {
    reasons.push("startDate not in YYYY-MM-DD form");
  } else {
    const d = new Date(startDate + "T12:00:00Z");
    if (Number.isNaN(d.getTime())) reasons.push("startDate is not a real date");
    // Reject anything in the past or absurdly far out
    const now = new Date();
    const twoYears = new Date(now.getTime() + 730 * 864e5);
    if (d < new Date(now.toDateString())) reasons.push("event date is in the past");
    if (d > twoYears) reasons.push("event date more than 2 years out — likely hallucinated");
  }

  let endDate = String(raw?.endDate || "").trim();
  if (!ISO_DATE.test(endDate)) endDate = startDate;
  if (ISO_DATE.test(startDate) && ISO_DATE.test(endDate) && endDate < startDate) {
    reasons.push("endDate before startDate");
  }

  const state = String(raw?.state || "").trim().toUpperCase();
  if (!STATES.has(state)) reasons.push(`state "${state}" outside AL/FL/MS`);

  // Ages must be sane for junior golf
  const ageMin = Number(raw?.ageMin);
  const ageMax = Number(raw?.ageMax);
  const agesOk =
    Number.isFinite(ageMin) && Number.isFinite(ageMax) &&
    ageMin >= 5 && ageMax <= 19 && ageMin <= ageMax;
  if (!agesOk) reasons.push("age range missing or implausible");

  // URL must be a real http(s) URL
  const url = String(raw?.url || "").trim();
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) reasons.push("url not http(s)");
  } catch {
    reasons.push("url missing or malformed");
  }

  if (reasons.length) return { ok: false, event: null, reasons };

  return {
    ok: true,
    reasons: [],
    event: {
      id: makeId(name, startDate),
      name,
      startDate,
      endDate,
      venue: String(raw.venue || "").trim(),
      city: String(raw.city || "").trim(),
      state,
      ageMin,
      ageMax,
      divisions: Array.isArray(raw.divisions) ? raw.divisions.map(String) : [],
      fee: String(raw.fee || "").trim(),
      url,
      tour: source.name,
      source: source.name,
      sourceNote: String(raw.sourceNote || "").trim(),
      // Review gate: nothing goes live until a human flips this to "published"
      status: "pending",
      confidence: scoreConfidence(raw),
      lastVerified: new Date().toISOString(),
    },
  };
}

function makeId(name, startDate) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `${slug}-${startDate}`;
}

/**
 * Confidence heuristic — drives which events you can eventually auto-publish.
 */
function scoreConfidence(raw) {
  let score = 0;
  if (raw?.venue) score++;
  if (raw?.city) score++;
  if (Array.isArray(raw?.divisions) && raw.divisions.length) score++;
  if (raw?.fee) score++;
  if (raw?.sourceNote) score++;
  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}

/**
 * Dedupe across sources. Two events are the same if name+startDate collide,
 * or if the same venue hosts an event on the same date.
 */
export function dedupe(events) {
  const byKey = new Map();
  for (const e of events) {
    const nameKey = `${e.name.toLowerCase().replace(/[^a-z0-9]/g, "")}|${e.startDate}`;
    const venueKey = e.venue
      ? `v:${e.venue.toLowerCase().replace(/[^a-z0-9]/g, "")}|${e.startDate}`
      : null;
    const existingKey = byKey.has(nameKey) ? nameKey
      : (venueKey && byKey.has(venueKey) ? venueKey : null);

    if (existingKey) {
      // Keep the richer record
      const prev = byKey.get(existingKey);
      const rank = { high: 3, medium: 2, low: 1 };
      if (rank[e.confidence] > rank[prev.confidence]) {
        byKey.set(existingKey, { ...e, alsoFoundVia: prev.source });
      } else {
        prev.alsoFoundVia = e.source;
      }
    } else {
      byKey.set(nameKey, e);
      if (venueKey) byKey.set(venueKey, byKey.get(nameKey));
    }
  }
  return [...new Set(byKey.values())].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/**
 * Run raw model output through validation + dedupe.
 * Returns { events, rejected } — always inspect `rejected` while tuning prompts.
 */
export function normalize(rawEventsBySource) {
  const accepted = [];
  const rejected = [];
  for (const { source, events } of rawEventsBySource) {
    for (const raw of events) {
      const result = validateEvent(raw, source);
      if (result.ok) accepted.push(result.event);
      else rejected.push({ source: source.name, name: raw?.name || "(unnamed)", reasons: result.reasons });
    }
  }
  return { events: dedupe(accepted), rejected };
}
