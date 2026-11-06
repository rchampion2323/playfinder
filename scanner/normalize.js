// scanner/normalize.js
//
// The accuracy gate. Everything Claude extracts passes through here before a
// parent can see it. A wrong date sends a family on a three-hour drive to a
// tournament that doesn't exist — that's the failure this file prevents.
//
// validate() → hard failures: the record is dropped.
// flags()    → soft anomalies: the record is held for review instead of published.

export const STATES = new Set(["AL", "FL", "MS", "LA", "GA", "TN", "TX"]);
export const TYPES = new Set(["entry", "ranked", "championship", "national", "qualifier"]);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const isRealDate = (s) => {
  if (!ISO.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const isUrl = (s) => { try { return /^https?:$/.test(new URL(s).protocol); } catch { return false; } };
const clean = (s, n = 200) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export function slug(s) {
  return String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

/** Returns { ok, event, reasons }. */
export function validate(raw, source, today = new Date().toISOString().slice(0, 10)) {
  const reasons = [];
  const name = clean(raw?.name, 160);
  if (name.length < 4) reasons.push("missing name");

  const startDate = clean(raw?.startDate, 10);
  let endDate = clean(raw?.endDate, 10) || startDate;
  if (!isRealDate(startDate)) reasons.push(`bad startDate "${startDate}"`);
  if (!isRealDate(endDate)) endDate = startDate;
  if (endDate < startDate) reasons.push("endDate before startDate");
  if (isRealDate(startDate) && endDate < today) reasons.push("already finished");

  const state = clean(raw?.state, 2).toUpperCase();
  if (!STATES.has(state)) reasons.push(`state "${state}" outside coverage`);

  const ageMin = Number(raw?.ageMin), ageMax = Number(raw?.ageMax);
  if (!(Number.isInteger(ageMin) && Number.isInteger(ageMax) && ageMin >= 4 && ageMax <= 19 && ageMin <= ageMax)) {
    reasons.push(`implausible ages ${raw?.ageMin}–${raw?.ageMax}`);
  }

  const entryUrl = clean(raw?.entryUrl, 500);
  const sourceUrl = clean(raw?.sourceUrl, 500);
  if (!isUrl(entryUrl) && !isUrl(sourceUrl)) reasons.push("no valid link to the tournament");

  if (reasons.length) return { ok: false, reasons };

  const gender = ["boys", "girls"].includes(raw?.gender) ? raw.gender : "coed";
  const type = TYPES.has(raw?.type) ? raw.type : source.type || "ranked";
  const closes = clean(raw?.registrationCloses, 10);
  const fee = Number(raw?.feeAmount);
  const holes = Number(raw?.holes);

  return {
    ok: true,
    reasons: [],
    event: {
      id: `${slug(source.id || source.name)}--${slug(name)}--${startDate}`,
      name,
      tour: clean(raw?.tour, 80) || source.short || source.name,
      source: source.name,
      startDate,
      endDate,
      venue: clean(raw?.venue, 120),
      city: clean(raw?.city, 80),
      state,
      ageMin,
      ageMax,
      gender,
      type,
      divisions: Array.isArray(raw?.divisions) ? raw.divisions.map((d) => clean(d, 60)).filter(Boolean).slice(0, 12) : [],
      holes: Number.isInteger(holes) && holes > 0 && holes <= 90 ? holes : null,
      feeAmount: raw?.feeAmount != null && Number.isFinite(fee) && fee >= 0 ? Math.round(fee) : null,
      registrationCloses: isRealDate(closes) ? closes : null,
      status: ["open", "closed", "full", "not_open"].includes(raw?.status) ? raw.status : "unknown",
      entryUrl: isUrl(entryUrl) ? entryUrl : sourceUrl,
      sourceUrl: isUrl(sourceUrl) ? sourceUrl : entryUrl,
    },
  };
}

/** Soft checks. Any flag holds the record back for a human look. */
export function flags(event, previous, today = new Date().toISOString().slice(0, 10)) {
  const out = [];
  const days = (a, b) => Math.round((new Date(`${a}T12:00:00Z`) - new Date(`${b}T12:00:00Z`)) / 864e5);
  if (days(event.startDate, today) > 550) out.push("more than 18 months away");
  if (days(event.endDate, event.startDate) > 6) out.push("runs longer than a week");
  if (event.feeAmount != null && event.feeAmount > 1200) out.push(`unusually high fee ($${event.feeAmount})`);
  if (event.lat == null) out.push(`couldn't place "${event.city}, ${event.state}" on the map`);
  if (event.registrationCloses && event.registrationCloses > event.endDate) out.push("registration closes after the event");
  if (previous && previous.startDate !== event.startDate && Math.abs(days(event.startDate, previous.startDate)) > 21) {
    out.push(`date moved from ${previous.startDate} to ${event.startDate}`);
  }
  return out;
}
