// Shared constants — months, state labels, region taxonomy.
// To add a new region/vertical, extend REGIONS_BY_STATE and STATES.

export const MONTH_ABBR = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
export const STATES = { AL: "Alabama", FL: "Florida", MS: "Mississippi", Multi: "Multi-state" };

export const REGIONS_BY_STATE = {
  AL: ["Birmingham Metro", "Huntsville / North AL", "Montgomery / Central AL", "Auburn / East AL", "Mobile / AL Gulf Coast", "Wiregrass / Dothan", "AL Statewide"],
  FL: ["Panhandle / Emerald Coast", "North FL / Jacksonville", "Central FL / Orlando–Tampa", "South FL / Miami", "FL Statewide"],
  MS: ["Jackson / Central MS", "MS Gulf Coast", "North MS", "MS Statewide"],
  Multi: ["Multi-state / National pathway"],
};

export const ALL_MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12];
