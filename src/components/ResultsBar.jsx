import React from "react";
import { TYPES, DEFAULT_FILTERS } from "../lib/tournaments.js";

// Secondary filters above the results: type chips, boys/girls, keyword, sort.
export default function ResultsBar({ f, set, count, hasOrigin }) {
  const toggleType = (k) => set({ types: f.types.includes(k) ? f.types.filter((x) => x !== k) : [...f.types, k] });
  const changed = JSON.stringify({ ...f, sort: "" }) !== JSON.stringify({ ...DEFAULT_FILTERS, sort: "" });

  return (
    <div className="rbar">
      <div className="rbar__chips" role="group" aria-label="Tournament type">
        {Object.entries(TYPES).map(([k, t]) => (
          <button key={k} type="button" className={`chip ${f.types.includes(k) ? "is-on" : ""}`}
            aria-pressed={f.types.includes(k)} title={t.hint} onClick={() => toggleType(k)}>{t.label}</button>
        ))}
      </div>
      <div className="rbar__row">
        <div className="seg" role="group" aria-label="Boys or girls">
          {[["any", "All"], ["boys", "Boys"], ["girls", "Girls"]].map(([v, l]) => (
            <button key={v} type="button" className={f.gender === v ? "is-on" : ""} aria-pressed={f.gender === v}
              onClick={() => set({ gender: v })}>{l}</button>
          ))}
        </div>
        <input className="search" type="search" placeholder="Search tour, course or city" value={f.q}
          onChange={(e) => set({ q: e.target.value })} aria-label="Search tour, course or city" />
        <label className="rbar__sort">
          <span>Sort</span>
          <select value={f.sort} onChange={(e) => set({ sort: e.target.value })}>
            <option value="date">Soonest first</option>
            <option value="distance" disabled={!hasOrigin}>Closest first</option>
          </select>
        </label>
      </div>
      <p className="rbar__count" aria-live="polite">
        <strong>{count}</strong> tournament{count === 1 ? "" : "s"} found
        {changed && <button type="button" className="linkbtn" onClick={() => set({ ...DEFAULT_FILTERS })}>Clear filters</button>}
      </p>
    </div>
  );
}
