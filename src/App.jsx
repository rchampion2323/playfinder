import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Landscape from "./components/Landscape.jsx";
import SearchPanel from "./components/SearchPanel.jsx";
import ResultsBar from "./components/ResultsBar.jsx";
import TournamentCard from "./components/TournamentCard.jsx";
import TournamentSheet from "./components/TournamentSheet.jsx";
import TypeTiles from "./components/TypeTiles.jsx";
import Tours from "./components/Tours.jsx";
import HomePrompt from "./components/HomePrompt.jsx";
import { REGION_BLURB } from "./data/region.js";
import { PLACES } from "./data/places.js";
import { PHOTO_CREDITS } from "./data/photoCredits.js";
import * as storage from "./lib/storage.js";
import {
  loadTournaments, filterTournaments, freshness, filtersFromUrl, filtersToUrl, milesBetween, todayIso,
} from "./lib/tournaments.js";

const PAGE = 12;
const NAV = [
  ["find", "Tournaments"],
  ["tours", "Tours & ages"],
  ["saved", "Saved"],
];

function Logo() {
  return (
    <a className="logo" href="./" aria-label="PlayFinder home">
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="19" fill="#14234b" />
        <path d="M16 9v22" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M16 9.5l11 4.5-11 4.5z" fill="#e0393e" />
        <ellipse cx="20" cy="31" rx="9" ry="2.2" fill="#3c9a52" />
      </svg>
      <span className="logo__text">
        <strong>PlayFinder</strong>
        <small>Junior Golf · Gulf Coast</small>
      </span>
    </a>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [f, setF] = useState(() => filtersFromUrl(window.location.search));
  const [tab, setTab] = useState("find");
  const [menu, setMenu] = useState(false);
  const [saved, setSaved] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [me, setMe] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [askHome, setAskHome] = useState(false);
  const resultsRef = useRef(null);

  useEffect(() => {
    loadTournaments().then(setData).catch((e) => setError(e.message));
    storage.get("saved").then((s) => Array.isArray(s) && setSaved(s));
    // First visit: ask where home is (unless the link already says, e.g. a shared search).
    if (!new URLSearchParams(window.location.search).has("near")) {
      storage.get("home").then((h) => {
        if (h && h !== "skip" && PLACES.some((p) => p.id === h)) setF((prev) => ({ ...prev, near: h }));
        else if (!h) setAskHome(true);
      });
    }
  }, []);

  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}${filtersToUrl(f)}`);
    setShown(PAGE);
  }, [f]);

  const set = useCallback((patch) => setF((prev) => ({ ...prev, ...patch })), []);
  const go = (k) => { setTab(k); setMenu(false); window.scrollTo({ top: 0 }); };
  const toResults = () => setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);

  const useLocation = useCallback(() => {
    if (!navigator.geolocation) { setLocError("Location isn't available in this browser."); return; }
    setLocating(true); setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); set({ near: "me" }); },
      () => { setLocating(false); setLocError("Couldn't get your location — pick a city instead."); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }, [set]);

  const origin = f.near === "me" ? me : PLACES.find((p) => p.id === f.near) || null;
  const all = data?.tournaments || [];
  const results = useMemo(() => filterTournaments(all, f, origin), [all, f, origin]);
  const typeCounts = useMemo(() => {
    const today = todayIso(), c = {};
    for (const t of all) if ((t.endDate || t.startDate) >= today) c[t.type] = (c[t.type] || 0) + 1;
    return c;
  }, [all]);

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

  const open = openId && all.find((t) => t.id === openId);
  const openWithMiles = open ? { ...open, miles: origin ? milesBetween(origin, open) : null } : null;
  const tours = new Set(all.map((t) => t.tour)).size;
  const upcoming = all.filter((t) => (t.endDate || t.startDate) >= todayIso()).length;

  const card = (t) => (
    <TournamentCard key={t.id} t={t} saved={savedSet.has(t.id)}
      onToggleSave={() => toggleSave(t.id)} onOpen={() => setOpenId(t.id)} />
  );

  return (
    <div className="app">
      <header className="hdr">
        <div className="wrap hdr__inner">
          <Logo />
          <nav className={`nav ${menu ? "is-open" : ""}`} aria-label="Main">
            {NAV.map(([k, label]) => (
              <button key={k} type="button" className={tab === k ? "is-on" : ""} aria-current={tab === k ? "page" : undefined}
                onClick={() => go(k)}>
                {label}{k === "saved" && saved.length > 0 && <span className="nav__n">{saved.length}</span>}
              </button>
            ))}
          </nav>
          <button type="button" className="btn btn--navy hdr__cta" onClick={() => { go("find"); toResults(); }}>
            Find a tournament
          </button>
          <button type="button" className="hdr__burger" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            <span /><span /><span />
          </button>
        </div>
      </header>

      {data?.sample && (
        <div className="banner" role="note">
          <strong>Preview with sample data</strong> — these tournaments are made up. Real schedules appear after the first daily pull.
        </div>
      )}

      {tab === "find" && (
        <main>
          <section className="hero">
            <Landscape className="hero__art" />
            <picture>
              <source media="(max-width: 700px)" srcSet="images/hero-mobile.jpg" />
              <img className="hero__photo" src="images/hero.jpg" alt="" fetchpriority="high"
                onError={(e) => { e.currentTarget.style.display = "none"; }} />
            </picture>
            <div className="hero__shade" />
            <div className="wrap hero__content">
              <div className="hero__rule" />
              <h1>Junior golf tournaments<br />on the Gulf Coast</h1>
              <p>Every junior tournament around {REGION_BLURB} — plus the state events worth the drive.</p>
              <div className="hero__rule" />
              {data && (
                <ul className="hero__stats">
                  <li><strong>{upcoming}</strong> upcoming</li>
                  <li><strong>{tours}</strong> tours</li>
                  <li>{freshness(data.generatedAt)}</li>
                </ul>
              )}
            </div>
          </section>

          <div className="wrap sp-wrap">
            <SearchPanel f={f} set={set} onUseLocation={useLocation} onSubmit={toResults} locating={locating} locError={locError} />
          </div>

          <section className="results wrap" ref={resultsRef} aria-label="Results">
            <h2 className="section-title">Upcoming tournaments</h2>
            <ResultsBar f={f} set={set} count={results.length} hasOrigin={!!origin} />
            {error && <div className="empty"><h3>Couldn't load tournaments</h3><p>{error}. Try refreshing.</p></div>}
            {!data && !error && <div className="grid">{[0, 1, 2].map((i) => <div className="skel" key={i} />)}</div>}
            {data && results.length === 0 && (
              <div className="empty">
                <h3>No tournaments match yet</h3>
                <p>Try a wider distance, a longer time window, or fewer tournament types.</p>
              </div>
            )}
            <div className="grid">{results.slice(0, shown).map(card)}</div>
            {results.length > shown && (
              <div className="more">
                <button type="button" className="btn btn--outline" onClick={() => setShown((n) => n + PAGE)}>
                  Show more ({results.length - shown} more)
                </button>
              </div>
            )}
          </section>

          <TypeTiles counts={typeCounts} onPick={(k) => { set({ types: [k] }); toResults(); }} />
        </main>
      )}

      {tab === "saved" && (
        <main className="wrap page">
          <h1 className="page-title">Saved tournaments</h1>
          {savedList.length === 0
            ? <div className="empty"><h3>Nothing saved yet</h3><p>Tap the ☆ on any tournament to keep it here. Saved tournaments stay on this device.</p></div>
            : <div className="grid">{savedList.map(card)}</div>}
        </main>
      )}

      {tab === "tours" && <main className="wrap page"><Tours sourceStatus={data?.sources} /></main>}

      <footer className="ftr">
        <div className="wrap ftr__inner">
          <div>
            <Logo />
            <p>Every junior golf tournament on the Gulf Coast, refreshed daily from each tour's own schedule.</p>
          </div>
          <nav aria-label="Footer">
            {NAV.map(([k, label]) => <button key={k} type="button" onClick={() => go(k)}>{label}</button>)}
          </nav>
          <p className="ftr__fine">Not affiliated with any tour. Always confirm dates, eligibility and fees with the
            organizer before you travel.</p>
          <p className="ftr__credits">Photos (cropped) from Wikimedia Commons:{" "}
            {PHOTO_CREDITS.map((c, i) => (
              <span key={c.page}>{i > 0 && " · "}
                <a href={c.page} target="_blank" rel="noreferrer">{c.title}</a> by {c.author},{" "}
                <a href={c.licenseUrl} target="_blank" rel="noreferrer">{c.license}</a>
              </span>
            ))}
          </p>
        </div>
      </footer>

      {askHome && (
        <HomePrompt
          onPick={(id) => { storage.set("home", id); set({ near: id }); setAskHome(false); }}
          onUseLocation={() => { storage.set("home", "skip"); setAskHome(false); useLocation(); }}
          onSkip={() => { storage.set("home", "skip"); setAskHome(false); }}
        />
      )}

      {openWithMiles && (
        <TournamentSheet t={openWithMiles} sample={data?.sample} saved={savedSet.has(openWithMiles.id)}
          onToggleSave={() => toggleSave(openWithMiles.id)} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}
