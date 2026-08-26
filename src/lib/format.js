// Presentation helpers shared by the event cards.

import { MONTH_ABBR } from '../data/constants.js';

export const TIER_STYLE = {
  "Elite / National field": { bg: "#FDECE7", fg: "#B23A1E" },
  "State Championship":     { bg: "#FDF4DC", fg: "#8A6410" },
  "National pathway":       { bg: "#EAF0FE", fg: "#2C4FA3" },
  "Ranked regional":        { bg: "#E7F4EC", fg: "#1E6B43" },
  "Ranked entry":           { bg: "#EAF6F7", fg: "#20707A" },
};

export function monthChip(months) {
  if (months.length >= 10) return "ALL YEAR";
  const s = [...months].sort((a, b) => a - b);
  if (s.length === 1) return MONTH_ABBR[s[0] - 1];
  const contiguous = s.every((m, i) => i === 0 || m === s[i - 1] + 1);
  if (contiguous) return `${MONTH_ABBR[s[0] - 1]}–${MONTH_ABBR[s[s.length - 1] - 1]}`;
  return s.slice(0, 2).map((m) => MONTH_ABBR[m - 1]).join(" · ") + " +";
}
