import React, { useCallback, useEffect, useMemo, useState } from "react";
import Filters from "./components/Filters.jsx";
import TournamentCard from "./components/TournamentCard.jsx";
import TournamentSheet from "./components/TournamentSheet.jsx";
import Tours from "./components/Tours.jsx";
import { PLACES } from "./data/places.js";
import * as storage from "./lib/storage.js";
import {
  loadTournaments, filterTournaments, groupByMonth, freshness,
  filtersFromUrl, filtersToUrl, milesBetween,
} from "./lib/tournaments.js";

const TABS = [
  ["find", "Find"],
  ["saved", "Saved"],
  ["tours", "Tours", "Tours & ages"],
];

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [f, setF] = useState(() => filtersFromUrl(window.location.search));
  const [tab, setTab] = useState("find");
  const [saved, setSaved] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [me, setMe] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");

  useEffect(() => {
    loadTournaments().then(setData).catch((e) => setError(e.message));
    storage.get("saved").then((s) => Array.isArray(s) && setSaved(s));
  }, []);

  // Keep the URL in sync so a search can be bookmarked or shared.
  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}${filtersToUrl(f)}`);
  }, [f]);

  const set = useCallback((patch) => setF((prev) => ({ ...prev, ...patch })), []);

  const useLocation = useCallback(() => {
    if (!navigator.geolocation) { setLocError("Location isn't available in this browser."); return; }
    setLocating(true); setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        set({ near: "me", sort: "date" });
      },
      () => { setLocating(false); setLocError("Couldn't get your location — pick a city instead."); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }, [set]);

  const origin = f.near === "me" ? me : PLACES.find((p) => p.id === f.near) || null;
  const all = data?.tournaments || [];
  const results = useMemo(() => filterTournaments(all, f, origin), [all, f, origin]);
  const groups = useMemo(() => groupByMonth(results), [results]);

  const savedSet = new Set(saved);
  const savedList = useMemo(
    () => all.filter((t) => savedSet.has(t.id))
      .map((t) => ({ ...t, miles: origin ? milesBetween(origin, t) : null }))
      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [all, saved, origin], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const toggleSave = (id) => {
    const next = savedSet.has(id) ? saved.filter((x) => x !== id) : [...saved, id];
    setSaved(next);
    storage.set("saved", next);
  };

  const open = openId && (all.find((t) => t.id === openId));
  const openWithMiles = open ? { ...open, miles: origin ? milesBetween(origin, open) : null } : null;
  const tours = new Set(all.map((t) => t.tour)).size;

  const card = (t) => (
    <TournamentCard key={t.id} t={t} saved={savedSet.has(t.id)}
      onToggleSave={() => toggleSave(t.id)} onOpen={() => setOpenId(t.id)} />
  );

  return (
    <div className="app">
      <header className="top">
        <div className="wrap top__inner">
          <a className="logo" href="./" aria-label="PlayFinder home">
            <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" /><path d="M13 7v18M13 7l9 4-9 4" /></svg>
            PlayFinder
          </a>
          <nav className="tabs" aria-label="Sections">
            {TABS.map(([k, label, long]) => (
              <button key={k} type="button" className={tab === k ? "is-on" : ""} aria-current={tab === k ? "page" : undefined}
                onClick={() => setTab(k)}>
                {long ? <><span className="sm-only">{label}</span><span className="lg-only">{long}</span></> : label}{k === "saved" && saved.length > 0 && <span className="tabs__n">{saved.length}</span>}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {data?.sample && (
        <div className="banner" role="note">
          <strong>Preview with sample data</strong> — these tournaments are made up. Real schedules appear after the first daily pull.
        </div>
      )}

      <main className="wrap main">
        {tab === "find" && (
          <>
            <section className="hero">
              <h1>Find junior golf tournaments <span>near you</span></h1>
              <p>
                {data
                  ? <>{all.length} upcoming tournaments from {tours} tours across the Gulf Coast · {freshness(data.generatedAt)}</>
                  : "Every junior tour on the Gulf Coast, in one search."}
              </p>
            </section>

            <div className="layout">
              <aside className="layout__side">
                <Filters f={f} set={set} count={results.length} locating={locating} locError={locError}
                  onUseLocation={useLocation} />
              </aside>
              <section className="layout__main" aria-label="Results">
                {error && <div className="empty"><h2>Couldn't load tournaments</h2><p>{error}. Try refreshing.</p></div>}
                {!data && !error && <div className="skels">{[0, 1, 2, 3].map((i) => <div className="skel" key={i} />)}</div>}
                {data && results.length === 0 && (
                  <div className="empty">
                    <h2>No tournaments match yet</h2>
                    <p>Try a wider distance, a longer time window, or fewer tournament types.</p>
                  </div>
                )}
                {groups.map((g) => (
                  <section className="month" key={g.key}>
                    <h2 className="month__label">{g.label}<span>{g.items.length}</span></h2>
                    <div className="cards">{g.items.map(card)}</div>
                  </section>
                ))}
              </section>
            </div>
          </>
        )}

        {tab === "saved" && (
          <section className="saved">
            <h1 className="h1">Saved tournaments</h1>
            {savedList.length === 0
              ? <div className="empty"><h2>Nothing saved yet</h2><p>Tap the ☆ on any tournament to keep it here.
                  Saved tournaments stay on this device.</p></div>
              : <div className="cards">{savedList.map(card)}</div>}
          </section>
        )}

        {tab === "tours" && <Tours sourceStatus={data?.sources} />}
      </main>

      <footer className="foot">
        <div className="wrap">
          <p><strong>PlayFinder</strong> · Junior golf on the Gulf Coast</p>
          <p>Not affiliated with any tour. Schedules are read from each organizer's published pages and refreshed daily —
            always confirm dates, eligibility and fees with the organizer before you travel.</p>
        </div>
      </footer>

      {openWithMiles && (
        <TournamentSheet t={openWithMiles} sample={data?.sample} saved={savedSet.has(openWithMiles.id)}
          onToggleSave={() => toggleSave(openWithMiles.id)} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}
