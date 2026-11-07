import React, { useEffect, useRef, useState } from "react";
import { PLACES } from "../data/places.js";

const STATE_NAMES = { AL: "Alabama", FL: "Florida", MS: "Mississippi", LA: "Louisiana" };

// First-visit "Where's home?" prompt. The answer is remembered on this device.
export default function HomePrompt({ onPick, onUseLocation, onSkip }) {
  const [place, setPlace] = useState("");
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div className="sheet" role="presentation">
      <div className="sheet__panel home" role="dialog" aria-modal="true" aria-labelledby="home-title" tabIndex={-1} ref={ref}>
        <h2 id="home-title">Where's home?</h2>
        <p className="muted">We'll show tournaments near you first. You can change this any time with the <strong>Near</strong> filter.</p>
        <button type="button" className="btn btn--navy home__btn" onClick={onUseLocation}>Use my current location</button>
        <div className="home__or"><span>or pick a city</span></div>
        <form className="home__pick" onSubmit={(e) => { e.preventDefault(); if (place) onPick(place); }}>
          <select value={place} onChange={(e) => setPlace(e.target.value)} aria-label="Home city">
            <option value="">Choose a city…</option>
            {Object.entries(STATE_NAMES).map(([st, name]) => (
              <optgroup key={st} label={name}>
                {PLACES.filter((p) => p.name.endsWith(st)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            ))}
          </select>
          <button type="submit" className="btn btn--red" disabled={!place}>Show tournaments</button>
        </form>
        <button type="button" className="linkbtn home__skip" onClick={onSkip}>Skip — show the whole Gulf Coast</button>
      </div>
    </div>
  );
}
