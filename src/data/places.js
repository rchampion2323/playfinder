// Home locations parents can search "near". Coordinates are city centers —
// good enough for "about how far is the drive" distances.
export const PLACES = [
  // Alabama
  { id: "mobile-al", name: "Mobile, AL", lat: 30.6954, lng: -88.0399 },
  { id: "fairhope-al", name: "Fairhope / Daphne, AL", lat: 30.5227, lng: -87.9033 },
  { id: "gulf-shores-al", name: "Gulf Shores / Orange Beach, AL", lat: 30.246, lng: -87.7008 },
  { id: "dothan-al", name: "Dothan, AL", lat: 31.2232, lng: -85.3905 },
  { id: "montgomery-al", name: "Montgomery, AL", lat: 32.3792, lng: -86.3077 },
  { id: "auburn-al", name: "Auburn / Opelika, AL", lat: 32.6099, lng: -85.4808 },
  { id: "tuscaloosa-al", name: "Tuscaloosa, AL", lat: 33.2098, lng: -87.5692 },
  { id: "birmingham-al", name: "Birmingham, AL", lat: 33.5186, lng: -86.8104 },
  { id: "huntsville-al", name: "Huntsville, AL", lat: 34.7304, lng: -86.5861 },
  // Florida
  { id: "pensacola-fl", name: "Pensacola, FL", lat: 30.4213, lng: -87.2169 },
  { id: "destin-fl", name: "Destin / Fort Walton Beach, FL", lat: 30.3935, lng: -86.4958 },
  { id: "panama-city-fl", name: "Panama City, FL", lat: 30.1766, lng: -85.8055 },
  { id: "tallahassee-fl", name: "Tallahassee, FL", lat: 30.4383, lng: -84.2807 },
  { id: "jacksonville-fl", name: "Jacksonville, FL", lat: 30.3322, lng: -81.6557 },
  { id: "orlando-fl", name: "Orlando, FL", lat: 28.5384, lng: -81.3789 },
  { id: "tampa-fl", name: "Tampa, FL", lat: 27.9506, lng: -82.4572 },
  { id: "fort-myers-fl", name: "Fort Myers / Naples, FL", lat: 26.6406, lng: -81.8723 },
  { id: "palm-beach-fl", name: "Palm Beach, FL", lat: 26.7056, lng: -80.0364 },
  { id: "miami-fl", name: "Miami, FL", lat: 25.7617, lng: -80.1918 },
  // Mississippi
  { id: "gulfport-ms", name: "Gulfport / Biloxi, MS", lat: 30.3674, lng: -89.0928 },
  { id: "hattiesburg-ms", name: "Hattiesburg, MS", lat: 31.3271, lng: -89.2903 },
  { id: "jackson-ms", name: "Jackson, MS", lat: 32.2988, lng: -90.1848 },
  { id: "tupelo-ms", name: "Tupelo, MS", lat: 34.2576, lng: -88.7034 },
  { id: "oxford-ms", name: "Oxford, MS", lat: 34.3665, lng: -89.5192 },
  // Neighbors families often drive to
  { id: "new-orleans-la", name: "New Orleans, LA", lat: 29.9511, lng: -90.0715 },
  { id: "baton-rouge-la", name: "Baton Rouge, LA", lat: 30.4515, lng: -91.1871 },
];

export const RADII = [
  { value: 50, label: "50 mi" },
  { value: 100, label: "100 mi" },
  { value: 200, label: "200 mi" },
  { value: 400, label: "400 mi" },
  { value: 0, label: "Any distance" },
];
