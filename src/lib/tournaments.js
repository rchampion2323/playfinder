// Everything the UI needs to load, filter, sort and describe tournaments.
// Data comes from /data/tournaments.json, written daily by scanner/pull.js.

export const TYPES = {
  entry: { label: "First tournaments", short: "Entry", hint: "Local tours & 9-hole events — great for beginners" },
  ranked: { label: "Ranked tours", short: "Ranked", hint: "Counts toward Junior Golf Scoreboard / tour rankings" },
  championship: { label: "State championships", short: "State", hint: "State association junior titles" },
  national: { label: "National & elite", short: "Elite", hint: "AJGA, invitationals, national finals" },
  qualifier: { label: "Qualifiers", short: "Qualifier", hint: "Qualify for a bigger championship" },
};

export const WHEN = [
  { value: "30", label: "Next 30 days", days: 30 },
  { value: "90", label: "Next 3 months", days: 90 },
  { value: "180", label: "Next 6 months", days: 180 },
  { value: "all", label: "All upcoming", days: 0 },
];

export const DEFAULT_FILTERS = {
  age: "",        // "" = any, else "6".."18"
  gender: "any",  // any | boys | girls
  near: "",       // place id, "me", or ""
  radius: 200,    // miles; 0 = any
  when: "180",
  types: [],      // [] = all types
  q: "",
  sort: "date",   // date | distance
};

export async function loadTournaments() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/tournaments.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Couldn't load tournaments (${res.status})`);
  return res.json();
}

const R = 3958.8; // earth radius, miles
export function milesBetween(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const toDate = (iso) => new Date(`${iso}T12:00:00`);
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(iso, n) {
  const d = toDate(iso); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function filterTournaments(list, f, origin) {
  const today = todayIso();
  const win = WHEN.find((w) => w.value === f.when);
  const until = win && win.days ? addDays(today, win.days) : null;
  const age = f.age ? Number(f.age) : null;
  const q = f.q.trim().toLowerCase();

  const out = [];
  for (const t of list) {
    if ((t.endDate || t.startDate) < today) continue;
    if (until && t.startDate > until) continue;
    if (age != null && (age < t.ageMin || age > t.ageMax)) continue;
    if (f.gender === "boys" && t.gender === "girls") continue;
    if (f.gender === "girls" && t.gender === "boys") continue;
    if (f.types.length && !f.types.includes(t.type)) continue;
    if (q && !`${t.name} ${t.tour} ${t.venue} ${t.city}`.toLowerCase().includes(q)) continue;
    const miles = origin ? milesBetween(origin, t) : null;
    // Statewide events (championships, national events, qualifiers) are worth the drive,
    // so they ignore the distance limit; everything else must be within it.
    if (origin && f.radius && t.region !== "statewide" && (miles == null || miles > f.radius)) continue;
    out.push({ ...t, miles });
  }
  out.sort(f.sort === "distance" && origin
    ? (a, b) => (a.miles ?? 1e9) - (b.miles ?? 1e9) || a.startDate.localeCompare(b.startDate)
    : (a, b) => a.startDate.localeCompare(b.startDate) || (a.miles ?? 0) - (b.miles ?? 0));
  return out;
}

export function groupByMonth(list) {
  const groups = [];
  for (const t of list) {
    const key = t.startDate.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) groups.push((g = { key, label: toDate(`${key}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" }), items: [] }));
    g.items.push(t);
  }
  return groups;
}

export function dateParts(t) {
  const s = toDate(t.startDate), e = toDate(t.endDate || t.startDate);
  const days = Math.round((e - s) / 864e5) + 1;
  return {
    mon: s.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
    day: s.getDate(),
    dow: s.toLocaleDateString(undefined, { weekday: "short" }),
    days,
    range: days > 1
      ? `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${e.toLocaleDateString(undefined, s.getMonth() === e.getMonth() ? { day: "numeric" } : { month: "short", day: "numeric" })}`
      : s.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }),
  };
}

export function ageLabel(t) {
  return t.ageMin === t.ageMax ? `Age ${t.ageMin}` : `Ages ${t.ageMin}–${t.ageMax}`;
}
export function genderLabel(g) {
  return g === "boys" ? "Boys" : g === "girls" ? "Girls" : "Boys & girls";
}

/** Registration status shown on cards: { tone, text } or null. */
export function registration(t) {
  if (t.status === "full") return { tone: "bad", text: "Field full" };
  if (t.status === "closed") return { tone: "bad", text: "Entry closed" };
  if (!t.registrationCloses) return null;
  const days = Math.ceil((toDate(t.registrationCloses) - toDate(todayIso())) / 864e5);
  if (days < 0) return { tone: "bad", text: "Entry closed" };
  const when = toDate(t.registrationCloses).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (days <= 7) return { tone: "warn", text: days === 0 ? "Entry closes today" : `Entry closes ${when}` };
  return { tone: "ok", text: `Entry open until ${when}` };
}

export function freshness(iso) {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 60) return "updated just now";
  const h = Math.round(mins / 60);
  if (h < 36) return `updated ${h} hour${h === 1 ? "" : "s"} ago`;
  return `updated ${Math.round(h / 24)} days ago`;
}

/** Build an .ics calendar file for one tournament (all-day event). */
export function icsFor(t) {
  const d = (iso) => iso.replace(/-/g, "");
  const end = addDays(t.endDate || t.startDate, 1); // DTEND is exclusive for all-day events
  const esc = (s) => String(s || "").replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PlayFinder//EN", "BEGIN:VEVENT",
    `UID:${t.id}@playfinder`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${d(t.startDate)}`, `DTEND;VALUE=DATE:${d(end)}`,
    `SUMMARY:${esc(t.name)}`, `LOCATION:${esc([t.venue, t.city].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${esc(`${t.tour} · ${ageLabel(t)} · Confirm details: ${t.entryUrl || t.sourceUrl || ""}`)}`,
    t.entryUrl ? `URL:${t.entryUrl}` : null,
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

// Filters <-> URL query, so a search can be bookmarked or texted to another parent.
export function filtersFromUrl(search) {
  const p = new URLSearchParams(search);
  const f = { ...DEFAULT_FILTERS };
  if (p.has("age")) f.age = p.get("age");
  if (p.has("gender")) f.gender = p.get("gender");
  if (p.has("near")) f.near = p.get("near");
  if (p.has("radius")) f.radius = Number(p.get("radius")) || 0;
  if (p.has("when")) f.when = p.get("when");
  if (p.has("types")) f.types = p.get("types").split(",").filter((t) => t in TYPES);
  if (p.has("q")) f.q = p.get("q");
  if (p.has("sort")) f.sort = p.get("sort");
  return f;
}
export function filtersToUrl(f) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (k === "near" && v === "me") continue; // never put a device location in a URL
    const val = Array.isArray(v) ? v.join(",") : String(v);
    if (val !== (Array.isArray(DEFAULT_FILTERS[k]) ? DEFAULT_FILTERS[k].join(",") : String(DEFAULT_FILTERS[k]))) p.set(k, val);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}
