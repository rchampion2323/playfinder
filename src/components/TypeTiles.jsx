import React from "react";
import { TYPES } from "../lib/tournaments.js";

// AJGO-style photo tiles. Each uses public/images/tile-<type>.jpg when present,
// otherwise a drawn golf scene.
const SCENES = {
  entry: ["#1f6f8b", "#5bb0c9"],
  ranked: ["#1b4d2e", "#4f9a4e"],
  championship: ["#7a4b12", "#d39b3a"],
  national: ["#14234b", "#3b5f8a"],
  qualifier: ["#4a2366", "#8c5bb3"],
};

function Scene({ type }) {
  const [a, b] = SCENES[type];
  return (
    <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`tile-${type}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="400" height="260" fill={`url(#tile-${type})`} />
      <path d="M0 190 C90 170 180 182 260 176 C320 172 370 180 400 178 L400 260 L0 260Z" fill="#000" opacity=".22" />
      <path d="M0 214 C120 196 240 210 400 202 L400 260 L0 260Z" fill="#000" opacity=".25" />
      <line x1="300" y1="182" x2="300" y2="118" stroke="#fff" strokeWidth="2.5" opacity=".85" />
      <path d="M300 120 L330 130 L300 140Z" fill="#e0393e" />
    </svg>
  );
}

export default function TypeTiles({ counts, onPick }) {
  return (
    <section className="tiles-wrap">
      <div className="wrap">
        <h2 className="section-title">Browse by tournament type</h2>
        <div className="tiles">
          {Object.entries(TYPES).map(([k, t]) => (
            <button key={k} type="button" className="tile" onClick={() => onPick(k)}>
              <Scene type={k} />
              <img src={`images/tile-${k}.jpg`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              <span className="tile__shade" />
              <span className="tile__text">
                <span className="tile__bar" />
                <strong>{t.label}</strong>
                <small>{counts[k] || 0} upcoming</small>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
