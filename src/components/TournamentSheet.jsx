import React, { useEffect, useRef } from "react";
import { TYPES, dateParts, ageLabel, genderLabel, registration, icsFor, freshness } from "../lib/tournaments.js";
import { StarButton } from "./TournamentCard.jsx";

function downloadIcs(t) {
  const blob = new Blob([icsFor(t)], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${t.name.replace(/[^\w]+/g, "-").slice(0, 60)}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export default function TournamentSheet({ t, saved, onToggleSave, onClose, sample }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.classList.add("no-scroll");
    return () => { document.removeEventListener("keydown", onKey); document.body.classList.remove("no-scroll"); };
  }, [onClose]);

  const d = dateParts(t);
  const reg = registration(t);
  const maps = `https://maps.apple.com/?q=${encodeURIComponent([t.venue, t.city, t.state].filter(Boolean).join(", "))}`;

  return (
    <div className="sheet" role="presentation" onClick={onClose}>
      <div className="sheet__panel" role="dialog" aria-modal="true" aria-labelledby="sheet-title"
        tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" aria-hidden="true" />
        <header className="sheet__head">
          <div>
            <span className={`pill pill--${t.type}`}>{TYPES[t.type]?.label || t.type}</span>
            <h2 id="sheet-title">{t.name}</h2>
            <p className="sheet__tour">{t.tour}</p>
          </div>
          <div className="sheet__actions">
            <StarButton saved={saved} onToggle={onToggleSave} label={t.name} />
            <button type="button" className="iconbtn" aria-label="Close" onClick={onClose}>✕</button>
          </div>
        </header>

        {sample && <p className="sheet__sample">Sample tournament for previewing the design — not a real event.</p>}

        <dl className="facts">
          <div><dt>When</dt><dd>{d.range}{d.days > 1 ? ` (${d.days} days)` : ""}</dd></div>
          <div><dt>Where</dt><dd>{t.venue && <>{t.venue}<br /></>}{t.city}, {t.state}
            {t.miles != null && <span className="muted"> · {Math.round(t.miles)} mi away</span>}
            <br /><a href={maps} target="_blank" rel="noreferrer">Directions ↗</a></dd></div>
          <div><dt>Who</dt><dd>{ageLabel(t)} · {genderLabel(t.gender)}</dd></div>
          {t.divisions?.length > 0 && <div><dt>Divisions</dt><dd>{t.divisions.join(" · ")}</dd></div>}
          {t.holes && <div><dt>Format</dt><dd>{t.holes} holes</dd></div>}
          {t.feeAmount != null && <div><dt>Entry fee</dt><dd>{t.feeAmount === 0 ? "Free" : `$${t.feeAmount}`}</dd></div>}
          {reg && <div><dt>Entry</dt><dd className={`reg reg--${reg.tone}`}>{reg.text}</dd></div>}
        </dl>

        <div className="sheet__cta">
          <a className="btn btn--primary" href={t.entryUrl} target="_blank" rel="noreferrer">
            {t.status === "open" ? "Enter on " : "View on "}{t.tour} ↗
          </a>
          <button type="button" className="btn btn--ghost" onClick={() => downloadIcs(t)}>Add to calendar</button>
        </div>

        <p className="sheet__note">
          Details are read from {t.tour}'s published schedule ({freshness(t.lastVerified)}). Always confirm dates,
          eligibility and fees with the organizer before you travel.
        </p>
      </div>
    </div>
  );
}
