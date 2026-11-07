// What "Gulf Coast" means for PlayFinder — shared by the site and the daily pull.
//
//   core       every tournament within CORE_RADIUS_MILES of a Gulf Coast anchor city
//   statewide  state championships, national/elite events and qualifiers anywhere
//              in the covered states (the events coastal families travel for)
//
// Anything else (e.g. a regular ranked event in Orlando or Huntsville) is left out.

export const STATES = ["AL", "FL", "MS", "LA"];

export const ANCHORS = [
  { name: "Mobile, AL", lat: 30.6954, lng: -88.0399 },
  { name: "Pensacola, FL", lat: 30.4213, lng: -87.2169 },
  { name: "Panama City, FL", lat: 30.1588, lng: -85.6602 },
  { name: "Gulfport, MS", lat: 30.3674, lng: -89.0928 },
  { name: "New Orleans, LA", lat: 29.9511, lng: -90.0715 },
];

export const CORE_RADIUS_MILES = 125;
export const STATEWIDE_TYPES = ["championship", "national", "qualifier"];

export const REGION_BLURB = "Mobile, Pensacola, the Panhandle, coastal Mississippi and New Orleans";

function miles(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}

/** "core" | "statewide" | null (outside PlayFinder's region). */
export function classify(t) {
  if (!STATES.includes(t.state)) return null;
  if (t.lat != null && t.lng != null && ANCHORS.some((a) => miles(a, t) <= CORE_RADIUS_MILES)) return "core";
  if (STATEWIDE_TYPES.includes(t.type)) return "statewide";
  return null;
}
