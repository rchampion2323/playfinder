import React from "react";
import { TYPES, dateParts, ageLabel, genderLabel, registration } from "../lib/tournaments.js";

export function StarButton({ saved, onToggle, label }) {
  return (
    <button
      type="button"
      className={`star ${saved ? "is-on" : ""}`}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${label} from saved` : `Save ${label}`}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
      </svg>
    </button>
  );
}

export default function TournamentCard({ t, saved, onToggleSave, onOpen }) {
  const d = dateParts(t);
  const reg = registration(t);
  return (
    <article className="tcard" onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()} tabIndex={0}
      aria-label={`${t.name}, ${d.range}`}>
      <div className="tcard__date" aria-hidden="true">
        <span className="tcard__mon">{d.mon}</span>
        <span className="tcard__day">{d.day}</span>
        <span className="tcard__dow">{d.days > 1 ? `${d.days} days` : d.dow}</span>
      </div>
      <div className="tcard__body">
        <div className="tcard__top">
          <span className={`pill pill--${t.type}`}>{TYPES[t.type]?.short || t.type}</span>
          <span className="tcard__tour">{t.tour}</span>
        </div>
        <h3 className="tcard__name">{t.name}</h3>
        <p className="tcard__where">
          {[t.venue, `${t.city}, ${t.state}`].filter(Boolean).join(" · ")}
          {t.miles != null && <strong className="tcard__miles"> · {t.miles < 5 ? "nearby" : `${Math.round(t.miles)} mi`}</strong>}
        </p>
        <ul className="tcard__facts">
          <li>{ageLabel(t)}</li>
          {t.gender !== "coed" && <li>{genderLabel(t.gender)}</li>}
          {t.holes && <li>{t.holes} holes</li>}
          {t.feeAmount != null && <li>{t.feeAmount === 0 ? "Free" : `$${t.feeAmount}`}</li>}
        </ul>
        {reg && <p className={`reg reg--${reg.tone}`}>{reg.text}</p>}
      </div>
      <StarButton saved={saved} onToggle={onToggleSave} label={t.name} />
    </article>
  );
}
