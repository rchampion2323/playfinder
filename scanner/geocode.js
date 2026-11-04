// scanner/geocode.js — "City", "ST" → { lat, lng }, cached in scanner/geocache.json.
// Uses the free Open-Meteo geocoding API (no key needed). The cache is
// committed, so each city is looked up once, ever.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(here, "geocache.json");
const STATE_NAMES = {
  AL: "Alabama", FL: "Florida", MS: "Mississippi", LA: "Louisiana",
  GA: "Georgia", TN: "Tennessee", TX: "Texas",
};

let cache = null;
const load = () => (cache ??= fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {});

export function saveGeocache() {
  if (!cache) return;
  const sorted = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(CACHE, JSON.stringify(sorted, null, 2) + "\n");
}

export async function geocode(city, state) {
  const name = String(city || "").split(",")[0].replace(/\s+(area|metro)$/i, "").trim();
  if (!name || !STATE_NAMES[state]) return null;
  const key = `${name.toLowerCase()}|${state}`;
  const db = load();
  if (key in db) return db[key];

  try {
    const url = "https://geocoding-api.open-meteo.com/v1/search?count=10&countryCode=US&language=en&format=json&name="
      + encodeURIComponent(name);
    const res = await fetch(url);
    if (!res.ok) return null; // transient — retry on the next run
    const { results = [] } = await res.json();
    const r = results.find((x) => x.admin1 === STATE_NAMES[state]);
    db[key] = r ? { lat: Number(r.latitude.toFixed(4)), lng: Number(r.longitude.toFixed(4)) } : null;
    return db[key];
  } catch {
    return null;
  }
}
