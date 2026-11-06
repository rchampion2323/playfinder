import React from "react";
import { PLACES, RADII } from "../data/places.js";
import { WHEN } from "../lib/tournaments.js";

const AGES = Array.from({ length: 13 }, (_, i) => String(i + 6));
const STATE_NAMES = { AL: "Alabama", FL: "Florida", MS: "Mississippi", LA: "Louisiana" };

function Field({ id, label, value, onChange, children }) {
  return (
    <label className="sp-field" htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
    </label>
  );
}

// The navy "Find tournaments near you" panel that overlaps the hero.
export default function SearchPanel({ f, set, onUseLocation, onSubmit, locating, locError }) {
  return (
    <form className="sp" onSubmit={(e) => { e.preventDefault(); onSubmit(); }} aria-label="Find tournaments">
      <h2 className="sp__title">Find tournaments near you</h2>
      <div className="sp__grid">
        <Field id="sp-age" label="Golfer's age" value={f.age} onChange={(age) => set({ age })}>
          <option value="">Any age</option>
          {AGES.map((a) => <option key={a} value={a}>{a} years old</option>)}
        </Field>
        <Field id="sp-near" label="Near" value={f.near}
          onChange={(near) => (near === "me" ? onUseLocation() : set({ near }))}>
          <option value="">Anywhere</option>
          <option value="me">My current location</option>
          {Object.entries(STATE_NAMES).map(([st, name]) => (
            <optgroup key={st} label={name}>
              {PLACES.filter((p) => p.name.endsWith(st)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </optgroup>
          ))}
        </Field>
        <Field id="sp-radius" label="Within" value={String(f.radius)} onChange={(r) => set({ radius: Number(r) })}>
          {RADII.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </Field>
        <Field id="sp-when" label="When" value={f.when} onChange={(when) => set({ when })}>
          {WHEN.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
        </Field>
        <button type="submit" className="btn btn--red sp__go">Find tournaments</button>
      </div>
      {(locating || locError) && <p className={`sp__msg ${locError ? "is-err" : ""}`}>{locError || "Finding your location…"}</p>}
    </form>
  );
}
