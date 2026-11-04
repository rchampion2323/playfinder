// scanner/sources.js — which organizations the daily pull reads, and how.
//
// Builds on src/data/sources.js (the list the site shows under "Tours").
// `type` is the default tournament type when a page doesn't make it clear.
// Sources with pull: false are shown on the site but not scraped — usually
// aggregators (we go to the original tours instead) or programs without
// public dated schedules.

import { SOURCES } from "../src/data/sources.js";

const CONFIG = {
  "HJGT (Hurricane Junior Golf Tour)": { id: "hjgt", short: "HJGT", type: "ranked" },
  "SJGT (Southeastern Junior Golf Tour)": { id: "sjgt", short: "SJGT", type: "ranked" },
  "US Kids Golf": { id: "uskids", short: "US Kids Golf", type: "entry",
    notes: "Local tours list events per tour; open the Gulf Coast-area local tours (Mobile, Baldwin County, Pensacola/Emerald Coast, Gulf Coast MS, Birmingham, Montgomery)." },
  "AJGA": { id: "ajga", short: "AJGA", type: "national" },
  "FSGA / Florida Junior Tour": { id: "fsga", short: "FJT", type: "ranked" },
  "Alabama Golf Association": { id: "aga", short: "AGA", type: "championship" },
  "Mississippi Golf Association": { id: "mga", short: "MGA", type: "championship" },
  "Emerald Coast Junior Golf Tour": { id: "ecjgt", short: "Emerald Coast JGT", type: "entry" },
  "Dixie Section PGA": { id: "dixie-pga", short: "Dixie PGA", type: "ranked" },
  "Gulf States PGA": { id: "gulf-states-pga", short: "Gulf States PGA", type: "ranked" },
  "North Florida PGA Junior Tour": { id: "nfpga", short: "North Florida PGA", type: "ranked" },
  "South Florida PGA Junior Tour": { id: "sfpga", short: "South Florida PGA", type: "ranked" },
  "FCWT Junior Golf Tour": { id: "fcwt", short: "FCWT", type: "ranked" },
  "PKB Girls Golf Tour": { id: "pkb", short: "PKB", type: "ranked" },
  "IJGT (International Junior Golf Tour)": { id: "ijgt", short: "IJGT", type: "ranked" },
  "Drive, Chip & Putt": { id: "dcp", short: "Drive, Chip & Putt", type: "qualifier" },
  "NB3 Junior Golf National Championship": { id: "nb3", short: "NB3", type: "qualifier" },
  "USGA Championship Qualifying": { id: "usga", short: "USGA", type: "qualifier",
    notes: "Only U.S. Junior Amateur and U.S. Girls' Junior qualifying sites." },
  "Optimist Junior Golf": { id: "optimist", short: "Optimist", type: "qualifier" },
  "Press Thornton Future Masters": { id: "future-masters", short: "Future Masters", type: "national" },
  "Junior Orange Bowl": { id: "jr-orange-bowl", short: "Junior Orange Bowl", type: "national" },
  "Southern Golf Association": { id: "sga", short: "SGA", type: "national" },
};

// Not pulled: aggregators, the umbrella PGA page (covered by the section tours),
// leagues without dated public events, and school-team golf.
const SKIP = new Set([
  "Junior Golf Scoreboard",
  "AmateurGolf.com Junior Listings",
  "North & South Florida PGA Junior Tours",
  "PGA Jr. League",
  "First Tee Chapters (Gulf Coast)",
  "State High School Associations (AHSAA / FHSAA / MHSAA)",
]);

export const PULL_SOURCES = SOURCES
  .filter((s) => !SKIP.has(s.name))
  .map((s) => ({ ...s, ...(CONFIG[s.name] || { id: s.name, short: s.name, type: "ranked" }) }));

export const STATES = (process.env.PULL_STATES || "AL,FL,MS").split(",").map((s) => s.trim().toUpperCase());
export const HORIZON_DAYS = Number(process.env.PULL_HORIZON_DAYS || 365);
