import React from "react";
import { SOURCES } from "../data/sources.js";

const GUIDE = [
  ["6–9", "US Kids Golf local tours are the main ranked option — real leaderboards at age-appropriate yardages, leading to State Invitationals, Regionals and Worlds at Pinehurst. Drive, Chip & Putt opens at 7 and is free."],
  ["8–11", "Add HJGT's 8–10 division, PGA Jr. League All-Stars, NB3 qualifiers and PGA section one-day events. Future Masters opens at 10 for boys; Optimist at 10 for everyone."],
  ["11–14", "SJGT and HJGT become the core ranked schedule. Florida players add the FJT at 13. State championships open at 12; girls should look at PKB."],
  ["14–18", "State juniors, Junior PGA qualifying, Future Masters, Junior Orange Bowl, USGA qualifying and AJGA events build college-recruiting résumés."],
];

export default function Tours({ sourceStatus = [] }) {
  const status = Object.fromEntries(sourceStatus.map((s) => [s.name, s]));
  return (
    <div className="tours">
      <section>
        <h2 className="h2">Which tours fit which ages?</h2>
        <div className="guide">
          {GUIDE.map(([ages, text]) => (
            <div className="guide__card" key={ages}>
              <span className="guide__age">{ages}</span>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="h2">Tours we track</h2>
        <p className="muted">There's no master list of junior golf, so PlayFinder reads each organization's own
          schedule every day. These {SOURCES.length} organizations run nearly every competitive junior event in the region.</p>
        <ul className="tourlist">
          {SOURCES.map((s) => (
            <li key={s.name}>
              <a href={s.url} target="_blank" rel="noreferrer">{s.name} ↗</a>
              <span>{s.cat}</span>
              <small>{s.states.includes("all") ? "AL · FL · MS" : s.states.join(" · ")}
                {status[s.name] && ` · ${status[s.name].count} upcoming`}</small>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
