import React, { useState } from "react";
import { PLACES, RADII } from "../data/places.js";
import { TYPES, WHEN, DEFAULT_FILTERS } from "../lib/tournaments.js";

const AGES = Array.from({ length: 13 }, (_, i) => String(i + 6));

function Select({ label, value, onChange, children, id }) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      <span className="field__control">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
      </span>
    </label>
  );
}

export default function Filters({ f, set, locating, locError, onUseLocation, count }) {
  const toggleType = (k) => set({ types: f.types.includes(k) ? f.types.filter((x) => x !== k) : [...f.types, k] });
  const [more, setMore] = useState(false);
  const extra = f.types.length + (f.gender !== "any") + (f.q ? 1 : 0);
  const changed = JSON.stringify({ ...f, sort: "" }) !== JSON.stringify({ ...DEFAULT_FILTERS, sort: "" });

  return (
    <section className="filters" aria-label="Search filters">
      <div className="filters__main">
        <Select id="f-age" label="Golfer's age" value={f.age} onChange={(age) => set({ age })}>
          <option value="">Any age</option>
          {AGES.map((a) => <option key={a} value={a}>{a} years old</option>)}
        </Select>

        <Select id="f-near" label="Near" value={f.near} onChange={(near) => near === "me" ? onUseLocation() : set({ near })}>
          <option value="">Anywhere</option>
          <option value="me">📍 My current location</option>
          {["AL", "FL", "MS", "LA"].map((st) => (
            <optgroup key={st} label={{ AL: "Alabama", FL: "Florida", MS: "Mississippi", LA: "Louisiana" }[st]}>
              {PLACES.filter((p) => p.name.endsWith(st)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </optgroup>
          ))}
        </Select>

        <Select id="f-radius" label="Within" value={String(f.radius)} onChange={(r) => set({ radius: Number(r) })}>
          {RADII.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </Select>

        <Select id="f-when" label="When" value={f.when} onChange={(when) => set({ when })}>
          {WHEN.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
        </Select>
      </div>
      {locating && <p className="filters__msg">Finding your location…</p>}
      {locError && <p className="filters__msg filters__msg--err">{locError}</p>}

      <button type="button" className="filters__more" aria-expanded={more} onClick={() => setMore((m) => !m)}>
        {more ? "Fewer filters" : "More filters"}{extra > 0 && <span className="badge">{extra}</span>}
      </button>

      <div className={`filters__extra ${more ? "is-open" : ""}`}>
      <div className="chips" role="group" aria-label="Tournament type">
        {Object.entries(TYPES).map(([k, t]) => (
          <button key={k} type="button" className={`chip chip--${k} ${f.types.includes(k) ? "is-on" : ""}`}
            aria-pressed={f.types.includes(k)} title={t.hint} onClick={() => toggleType(k)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="filters__row">
        <div className="seg" role="group" aria-label="Boys or girls">
          {[["any", "All"], ["boys", "Boys"], ["girls", "Girls"]].map(([v, l]) => (
            <button key={v} type="button" className={f.gender === v ? "is-on" : ""} aria-pressed={f.gender === v}
              onClick={() => set({ gender: v })}>{l}</button>
          ))}
        </div>
        <input className="search" type="search" placeholder="Search tour, course or city" value={f.q}
          onChange={(e) => set({ q: e.target.value })} aria-label="Search tour, course or city" />
      </div>
      </div>

      <div className="filters__foot">
        <span className="filters__count" aria-live="polite"><strong>{count}</strong> tournament{count === 1 ? "" : "s"}</span>
        <div className="filters__sort">
          <label htmlFor="f-sort">Sort</label>
          <select id="f-sort" value={f.sort} onChange={(e) => set({ sort: e.target.value })}>
            <option value="date">Soonest first</option>
            <option value="distance" disabled={!f.near}>Closest first</option>
          </select>
        </div>
        {changed && <button type="button" className="linkbtn" onClick={() => set({ ...DEFAULT_FILTERS })}>Reset</button>}
      </div>
    </section>
  );
}
