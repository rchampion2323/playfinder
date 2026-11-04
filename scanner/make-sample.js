// scanner/make-sample.js — writes clearly-labelled SAMPLE data to
// public/data/tournaments.json so the interface can be designed and reviewed
// before the first real pull runs. The site shows a "sample data" banner
// whenever `sample: true`, and scanner/pull.js never merges sample records.
//
//   node scanner/make-sample.js
//
// Never deploy sample data to production: the first real pull replaces it.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PLACES } from "../src/data/places.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const place = Object.fromEntries(PLACES.map((p) => [p.id, p]));

// Deterministic pseudo-random so the sample doesn't churn between runs.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const SERIES = [
  { tour: "HJGT", type: "ranked", ages: [8, 18], gender: "coed", fee: 245, holes: 36, days: 2, every: 21,
    url: "https://hjgt.org/schedule/", divisions: ["Boys 16–18", "Boys 14–15", "Boys 11–13", "Girls 11–18", "Boys & Girls 8–10"],
    stops: [["mobile-al", "Magnolia Grove", "Mobile Junior Open"], ["destin-fl", "Kelly Plantation", "Emerald Coast Junior Open"],
      ["gulfport-ms", "Grand Bear", "Mississippi Gulf Coast Junior Open"], ["pensacola-fl", "Scenic Hills", "Pensacola Junior Classic"],
      ["birmingham-al", "Oxmoor Valley", "Birmingham Junior Open"], ["tampa-fl", "Innisbrook", "Tampa Bay Junior Open"]] },
  { tour: "SJGT", type: "ranked", ages: [11, 18], gender: "coed", fee: 215, holes: 36, days: 2, every: 28,
    url: "https://www.sjgt.com/schedule.aspx", divisions: ["Boys 15–18", "Boys 11–14", "Girls 11–18"],
    stops: [["montgomery-al", "Capitol Hill", "Montgomery Junior Classic"], ["auburn-al", "Grand National", "Auburn Junior Classic"],
      ["dothan-al", "Highland Oaks", "Wiregrass Junior Classic"], ["hattiesburg-ms", "Canebrake", "Pine Belt Junior Classic"],
      ["fairhope-al", "Rock Creek", "Eastern Shore Junior Classic"]] },
  { tour: "US Kids Golf", type: "entry", ages: [6, 12], gender: "coed", fee: 55, holes: 9, days: 1, every: 14,
    url: "https://www.uskidsgolf.com/tournaments/local-tours/find-a-tour", divisions: ["6 & under", "7", "8", "9", "10", "11–12"],
    stops: [["mobile-al", "Azalea City", "Mobile Local Tour"], ["fairhope-al", "Lakewood", "Baldwin County Local Tour"],
      ["pensacola-fl", "Marcus Pointe", "Pensacola Local Tour"], ["gulfport-ms", "Windance", "Gulf Coast MS Local Tour"],
      ["destin-fl", "Indian Bayou", "Emerald Coast Local Tour"]] },
  { tour: "Emerald Coast JGT", type: "entry", ages: [7, 15], gender: "coed", fee: 40, holes: 9, days: 1, every: 30,
    url: "https://www.emeraldcoastjuniorgolftour.com", divisions: ["7–9", "10–12", "13–15"],
    stops: [["destin-fl", "Bluewater Bay", "Monthly Junior Series"], ["panama-city-fl", "Signal Hill", "Bay County Junior Series"]] },
  { tour: "FJT", type: "ranked", ages: [13, 18], gender: "coed", fee: 175, holes: 36, days: 2, every: 35,
    url: "https://www.fsga.org/juniors", divisions: ["Boys 13–18", "Girls 13–18"],
    stops: [["tallahassee-fl", "Golden Eagle", "North Florida Junior"], ["orlando-fl", "Grand Cypress", "Central Florida Junior"],
      ["jacksonville-fl", "TPC Sawgrass Valley", "First Coast Junior"]] },
  { tour: "PKB", type: "ranked", ages: [7, 18], gender: "girls", fee: 195, holes: 36, days: 2, every: 45,
    url: "https://www.pkbgt.org", divisions: ["Girls 15–18", "Girls 12–14", "Girls 7–11"],
    stops: [["orlando-fl", "Orange County National", "PKB Orlando Classic"], ["birmingham-al", "Ross Bridge", "PKB Alabama Classic"]] },
  { tour: "AJGA", type: "national", ages: [12, 18], gender: "coed", fee: 395, holes: 54, days: 3, every: 60,
    url: "https://www.ajga.org/schedule", divisions: ["Boys 12–19", "Girls 12–19"],
    stops: [["palm-beach-fl", "PGA National", "AJGA Palm Beach Junior"], ["huntsville-al", "Hampton Cove", "AJGA Rocket City Junior"]] },
  { tour: "Dixie PGA", type: "ranked", ages: [8, 18], gender: "coed", fee: 60, holes: 18, days: 1, every: 21,
    url: "https://dixie.pga.com", divisions: ["Boys 15–18", "Boys 12–14", "Girls 12–18", "8–11 (9 holes)"],
    stops: [["mobile-al", "Lakewood", "Dixie Junior Series — Mobile"], ["montgomery-al", "Wynlakes", "Dixie Junior Series — Montgomery"]] },
];

const start = new Date(); start.setDate(start.getDate() + 3);
const end = new Date(); end.setDate(end.getDate() + 200);
const iso = (d) => d.toISOString().slice(0, 10);
const tournaments = [];

for (const s of SERIES) {
  const d = new Date(start); d.setDate(d.getDate() + Math.floor(rand() * s.every));
  let i = 0;
  while (d < end) {
    while (d.getDay() !== 6) d.setDate(d.getDate() + 1); // Saturdays
    const [placeId, course, title] = s.stops[i++ % s.stops.length];
    const p = place[placeId];
    const e = new Date(d); e.setDate(e.getDate() + s.days - 1);
    const closes = new Date(d); closes.setDate(closes.getDate() - 10);
    const name = s.tour === "US Kids Golf" || s.tour === "Emerald Coast JGT" || s.tour === "Dixie PGA" || s.tour === "AJGA" || s.tour === "PKB"
      ? title : `${s.tour} ${title}`;
    tournaments.push({
      id: `sample--${s.tour.toLowerCase().replace(/\W+/g, "-")}--${placeId}--${iso(d)}`,
      name, tour: s.tour, source: s.tour,
      startDate: iso(d), endDate: iso(e),
      venue: `${course}${/(National|Valley|Oaks|Hill|Creek|Plantation|Bay|Pointe|Bayou|Bridge|Cove|Eagle|Cypress|Bear)$/.test(course) ? "" : " Golf Club"}`,
      city: p.name.split(",")[0].split(" / ")[0], state: p.name.slice(-2),
      lat: p.lat, lng: p.lng,
      ageMin: s.ages[0], ageMax: s.ages[1], gender: s.gender, type: s.type,
      divisions: s.divisions, holes: s.holes, feeAmount: s.fee + Math.round(rand() * 4) * 5,
      registrationCloses: iso(closes),
      status: rand() < 0.08 ? "full" : "open",
      entryUrl: s.url, sourceUrl: s.url,
      lastVerified: new Date().toISOString(),
    });
    d.setDate(d.getDate() + s.every + Math.floor(rand() * 7));
  }
}

// State championships & qualifiers (one-offs)
const oneOffs = [
  ["Alabama Boys' State Junior Championship", "AGA", "championship", 12, 18, "boys", "birmingham-al", "Greystone", 4, 54, 125, "https://www.alabamagolf.org/championships"],
  ["Alabama Girls' State Junior Championship", "AGA", "championship", 12, 18, "girls", "montgomery-al", "Arrowhead", 4, 36, 110, "https://www.alabamagolf.org/championships"],
  ["Mississippi State Junior Championship", "MGA", "championship", 12, 18, "coed", "jackson-ms", "Annandale", 5, 54, 100, "https://www.msgolf.org"],
  ["Drive, Chip & Putt Local Qualifier — Mobile", "Drive, Chip & Putt", "qualifier", 7, 15, "coed", "mobile-al", "Magnolia Grove", 2, null, 0, "https://www.drivechipandputt.com/registration"],
  ["Drive, Chip & Putt Local Qualifier — Pensacola", "Drive, Chip & Putt", "qualifier", 7, 15, "coed", "pensacola-fl", "Perdido Bay", 3, null, 0, "https://www.drivechipandputt.com/registration"],
  ["Optimist District Qualifier — Gulf Coast", "Optimist", "qualifier", 10, 18, "coed", "gulfport-ms", "Fallen Oak", 3, 36, 85, "https://www.optimist.org/member/junior-golf"],
  ["Press Thornton Future Masters", "Future Masters", "national", 10, 18, "boys", "dothan-al", "Dothan Country Club", 4, 54, 225, "https://www.futuremasters.org"],
];
for (const [name, tour, type, a0, a1, gender, placeId, venue, monthsOut, holes, fee, url] of oneOffs) {
  const p = place[placeId];
  const d = new Date(); d.setMonth(d.getMonth() + monthsOut); while (d.getDay() !== 2) d.setDate(d.getDate() + 1);
  const e = new Date(d); e.setDate(e.getDate() + (holes === 54 ? 2 : holes === 36 ? 1 : 0));
  tournaments.push({
    id: `sample--${tour.toLowerCase().replace(/\W+/g, "-")}--${iso(d)}`, name, tour, source: tour,
    startDate: iso(d), endDate: iso(e), venue, city: p.name.split(",")[0].split(" / ")[0], state: p.name.slice(-2),
    lat: p.lat, lng: p.lng, ageMin: a0, ageMax: a1, gender, type,
    divisions: [], holes, feeAmount: fee, registrationCloses: null, status: "not_open",
    entryUrl: url, sourceUrl: url, lastVerified: new Date().toISOString(),
  });
}

tournaments.sort((a, b) => a.startDate.localeCompare(b.startDate));
const out = path.join(ROOT, "public/data/tournaments.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({
  generatedAt: new Date().toISOString(), sample: true, states: ["AL", "FL", "MS"],
  sources: [...new Set(tournaments.map((t) => t.tour))].map((name) => ({ name, ok: true, count: tournaments.filter((t) => t.tour === name).length })),
  tournaments,
}, null, 1) + "\n");
console.log(`Wrote ${tournaments.length} SAMPLE tournaments to public/data/tournaments.json`);
