import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { MONTH_ABBR, REGIONS_BY_STATE } from "./data/constants.js";
import { EVENTS } from "./data/events.js";
import { SOURCES } from "./data/sources.js";
import { TIER_STYLE } from "./lib/format.js";
import * as storage from "./lib/storage.js";
import * as cache from "./lib/cache.js";
import * as api from "./lib/api.js";

const MONTH_FULL = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];

// Sources auto-queried on load, in priority order. Kept small on purpose:
// these have structured schedule pages and the best events-per-search yield.
const PRIORITY_SOURCES = {
  AL: ["SJGT", "HJGT", "Alabama Golf Association", "US Kids Golf"],
  FL: ["FSGA", "HJGT", "Emerald Coast", "US Kids Golf"],
  MS: ["Mississippi Golf Association", "SJGT", "Gulf States PGA", "US Kids Golf"],
  all: ["SJGT", "HJGT", "FSGA", "US Kids Golf"],
};

function pickPrioritySources(stateF) {
  const wanted = PRIORITY_SOURCES[stateF] || PRIORITY_SOURCES.all;
  const out = [];
  for (const frag of wanted) {
    const found = SOURCES.find(
      (s) =>
        s.name.toLowerCase().includes(frag.toLowerCase()) &&
        (stateF === "all" || s.states.includes(stateF) || s.states.includes("all"))
    );
    if (found && !out.includes(found)) out.push(found);
  }
  return out;
}

/* -------------------------------------------------------------- helpers */

function monthOf(iso) {
  const m = Number(String(iso).slice(5, 7));
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m : null;
}

function prettyDate(iso) {
  const d = new Date(iso + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return { top: "TBD", bot: "" };
  return { top: MONTH_ABBR[d.getUTCMonth()], bot: String(d.getUTCDate()) };
}

function monthWindowLabel(months) {
  if (!months?.length) return "";
  if (months.length >= 10) return "YEAR ROUND";
  const s = [...months].sort((a, b) => a - b);
  if (s.length === 1) return MONTH_ABBR[s[0] - 1];
  const contiguous = s.every((m, i) => i === 0 || m === s[i - 1] + 1);
  if (contiguous) return `${MONTH_ABBR[s[0] - 1]}–${MONTH_ABBR[s[s.length - 1] - 1]}`;
  return s.slice(0, 2).map((m) => MONTH_ABBR[m - 1]).join(" · ") + "+";
}

// Curated entries and live scan results are normalized into ONE shape so the UI
// shows a single unified list instead of two confusing panels.
function fromCurated(e) {
  return {
    key: `c-${e.id}`,
    kind: "window",
    name: e.name,
    tour: e.tour,
    st: e.st,
    region: e.region,
    venue: e.venue,
    city: e.city,
    ageMin: e.ageMin,
    ageMax: e.ageMax,
    gender: e.gender,
    months: e.when.months,
    dateLabel: e.when.label,
    windowLabel: monthWindowLabel(e.when.months),
    tier: e.tier,
    format: e.format,
    fee: e.fee,
    eligibility: e.eligibility,
    notes: e.notes,
    links: e.links,
  };
}

function fromLive(r) {
  const m = monthOf(r.startDate);
  const nums = String(r.ages || "").match(/\d+/g)?.map(Number) || [];
  return {
    key: `l-${r.name}-${r.startDate}`,
    kind: "confirmed",
    name: r.name,
    tour: r.tour || r.source || "",
    st: r.state || "",
    region: null,
    venue: r.venue || "",
    city: r.city || "",
    ageMin: nums.length ? Math.min(...nums) : 6,
    ageMax: nums.length ? Math.max(...nums) : 18,
    gender: "",
    months: m ? [m] : [],
    startDate: r.startDate,
    dateLabel: r.dates || r.startDate,
    windowLabel: "",
    tier: "Confirmed date",
    format: "",
    fee: "",
    eligibility: "",
    notes: "",
    links: r.url ? [{ label: "Event page & registration", url: r.url }] : [],
    source: r.source,
  };
}

/* ----------------------------------------------------------------- app */

export default function PlayFinder() {
  const [stateF, setStateF] = useState("AL");
  const [age, setAge] = useState("any");
  const [month, setMonth] = useState("any");
  const [region, setRegion] = useState("All areas");
  const [tour, setTour] = useState("All tours");
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [live, setLive] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [notice, setNotice] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);

  const [pinned, setPinned] = useState([]);
  const [openKey, setOpenKey] = useState(null);
  const [tab, setTab] = useState("all");

  const inFlight = useRef(new Set());

  useEffect(() => {
    (async () => {
      const v = await storage.get("pinned-events");
      if (v) setPinned(v);
    })();
  }, []);

  /* ------- auto-load live data whenever the STATE changes (no button) ------- */

  const loadLive = useCallback(async (targetState, { force = false } = {}) => {
    if (inFlight.current.has(targetState)) return;

    const cached = cache.get(targetState);
    if (cached && !cached.stale && !force) {
      setLive(cached.events);
      setFetchedAt(cached.fetchedAt);
      return;
    }
    if (cached) {
      setLive(cached.events);       // show stale immediately, refresh behind it
      setFetchedAt(cached.fetchedAt);
    } else {
      setLive([]);
    }

    const targets = pickPrioritySources(targetState);
    if (!targets.length) return;

    inFlight.current.add(targetState);
    setLoading(true);
    setNotice(null);
    setProgress({ done: 0, total: targets.length });

    const collected = [];
    const seen = new Set();
    let done = 0;
    let notConfigured = false;
    let failures = 0;

    await Promise.allSettled(
      targets.map(async (src) => {
        try {
          const data = await api.scanSource({ source: src, state: targetState });
          if (data?.error) {
            if (data.error === api.NOT_CONFIGURED) notConfigured = true;
            else failures += 1;
            return;
          }
          for (const r of data.events || []) {
            const k = `${String(r.name).toLowerCase().replace(/[^a-z0-9]/g, "")}|${r.startDate}`;
            if (!seen.has(k)) {
              seen.add(k);
              collected.push({ ...r, source: src.name });
            }
          }
        } catch {
          failures += 1;
        } finally {
          done += 1;
          setProgress({ done, total: targets.length });
        }
      })
    );

    if (collected.length) {
      collected.sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
      cache.set(targetState, collected);
      setLive(collected);
      setFetchedAt(Date.now());
    } else if (notConfigured) {
      setNotice({
        tone: "info",
        text: "Confirmed dates aren't loading yet — the API key still needs to be added in Azure. Everything below still works.",
      });
    } else if (failures === targets.length) {
      setNotice({
        tone: "warn",
        text: "Couldn't reach the schedule sources just now. Showing typical season windows instead.",
      });
    }

    setLoading(false);
    inFlight.current.delete(targetState);
  }, []);

  useEffect(() => {
    loadLive(stateF);
    setRegion("All areas");
  }, [stateF, loadLive]);

  /* ---------------------------- filtering (instant) ---------------------------- */

  const allItems = useMemo(() => {
    const curated = EVENTS
      .filter((e) => stateF === "all" || e.st === stateF || e.st === "Multi")
      .map(fromCurated);
    return [...live.map(fromLive), ...curated];
  }, [live, stateF]);

  const filtered = useMemo(() => {
    let items = allItems.filter((it) => {
      if (age !== "any") {
        const a = Number(age);
        if (a < it.ageMin || a > it.ageMax) return false;
      }
      if (month !== "any" && it.months.length && !it.months.includes(Number(month))) return false;
      if (region !== "All areas" && it.region && it.region !== region && !it.region.includes("Statewide")) return false;
      if (tour !== "All tours" && it.tour !== tour) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!`${it.name} ${it.city} ${it.venue} ${it.tour} ${it.notes}`.toLowerCase().includes(q)) return false;
      }
      if (tab === "confirmed" && it.kind !== "confirmed") return false;
      return true;
    });
    if (tab === "pinned") {
      const keys = new Set(pinned.map((p) => p.key));
      items = items.filter((it) => keys.has(it.key));
    }
    return items;
  }, [allItems, age, month, region, tour, query, tab, pinned]);

  const confirmedCount = useMemo(() => allItems.filter((i) => i.kind === "confirmed").length, [allItems]);

  const regionOptions = useMemo(() => {
    if (stateF === "all") return ["All areas", ...Object.values(REGIONS_BY_STATE).flat()];
    return ["All areas", ...(REGIONS_BY_STATE[stateF] || []), ...REGIONS_BY_STATE.Multi];
  }, [stateF]);

  const tourOptions = useMemo(() => {
    const inScope = new Set(allItems.map((i) => i.tour).filter(Boolean));
    return ["All tours", ...[...inScope].sort()];
  }, [allItems]);

  async function togglePin(item) {
    const exists = pinned.some((p) => p.key === item.key);
    const next = exists
      ? pinned.filter((p) => p.key !== item.key)
      : [...pinned, {
          key: item.key, name: item.name, dateLabel: item.dateLabel,
          venue: item.venue, city: item.city, url: item.links?.[0]?.url || "",
        }];
    setPinned(next);
    await storage.set("pinned-events", next);
  }
  const isPinned = (item) => pinned.some((p) => p.key === item.key);

  const activeFilters = [
    age !== "any" && `Age ${age}`,
    month !== "any" && MONTH_FULL[Number(month) - 1],
    region !== "All areas" && region,
    tour !== "All tours" && tour,
    query && `"${query}"`,
  ].filter(Boolean);

  function resetFilters() {
    setAge("any"); setMonth("any"); setRegion("All areas");
    setTour("All tours"); setQuery("");
  }

  /* -------------------------------- render -------------------------------- */

  return (
    <div className="pf">
      <style>{CSS}</style>

      <header className="hero">
        <div className="wrap">
          <div className="brandrow">
            <span className="mark">PlayFinder</span>
            <span className="marksub">Junior Golf &amp; Sports Directory</span>
          </div>
          <h1>Find the right tournament<br />for your junior golfer.</h1>
          <p className="lede">
            Every ranked tour and championship across Alabama, Florida, and Mississippi —
            ages 6 to 18, updated automatically.
          </p>
          <div className="states" role="group" aria-label="Choose a state">
            {[["AL", "Alabama"], ["FL", "Florida"], ["MS", "Mississippi"], ["all", "All three"]].map(([v, label]) => (
              <button key={v} className={`statebtn ${stateF === v ? "on" : ""}`}
                onClick={() => setStateF(v)} aria-pressed={stateF === v}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="controls">
        <div className="wrap">
          <div className="ctrlrow">
            <div className="chiprow" role="group" aria-label="Player age">
              <span className="chiplabel">Age</span>
              <div className="chipscroll">
                <button className={`chip ${age === "any" ? "on" : ""}`} onClick={() => setAge("any")}>Any</button>
                {Array.from({ length: 13 }, (_, i) => i + 6).map((a) => (
                  <button key={a} className={`chip ${age === String(a) ? "on" : ""}`}
                    onClick={() => setAge(String(a))}>{a}</button>
                ))}
              </div>
            </div>

            <div className="ctrlspacer" />

            <input className="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search course, city, or event…" aria-label="Search events" />

            <button className="morebtn" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
              {showFilters ? "Fewer filters" : "More filters"}
              {activeFilters.length > 0 && <span className="badge">{activeFilters.length}</span>}
            </button>
          </div>

          {showFilters && (
            <div className="morerow">
              <label className="fld">
                <span>Month</span>
                <select value={month} onChange={(e) => setMonth(e.target.value)}>
                  <option value="any">Any month</option>
                  {MONTH_FULL.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </label>
              <label className="fld">
                <span>Area</span>
                <select value={region} onChange={(e) => setRegion(e.target.value)}>
                  {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label className="fld">
                <span>Tour</span>
                <select value={tour} onChange={(e) => setTour(e.target.value)}>
                  {tourOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              {activeFilters.length > 0 && <button className="clearbtn" onClick={resetFilters}>Clear all</button>}
            </div>
          )}
        </div>
      </div>

      <main className="wrap main">
        <div className="statusbar">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === "all"} className={`tab ${tab === "all" ? "on" : ""}`}
              onClick={() => setTab("all")}>All events <span className="tabnum">{allItems.length}</span></button>
            <button role="tab" aria-selected={tab === "confirmed"} className={`tab ${tab === "confirmed" ? "on" : ""}`}
              onClick={() => setTab("confirmed")}>Confirmed dates <span className="tabnum">{confirmedCount}</span></button>
            <button role="tab" aria-selected={tab === "pinned"} className={`tab ${tab === "pinned" ? "on" : ""}`}
              onClick={() => setTab("pinned")}>Saved <span className="tabnum">{pinned.length}</span></button>
          </div>

          <div className="status">
            {loading ? (
              <span className="loadingdot">
                <i /> Checking schedules {progress.total ? `(${progress.done}/${progress.total})` : ""}
              </span>
            ) : (
              <>
                {fetchedAt && <span className="fresh">{cache.freshness(fetchedAt)}</span>}
                <button className="refresh" onClick={() => loadLive(stateF, { force: true })}
                  title="Check for newly posted events">↻ Refresh</button>
              </>
            )}
          </div>
        </div>

        {notice && <div className={`notice ${notice.tone}`}>{notice.text}</div>}

        {loading && !live.length && (
          <div className="skels">{[0, 1, 2].map((i) => <div className="skel" key={i} />)}</div>
        )}

        {!filtered.length && !loading && (
          <div className="empty">
            <strong>No events match these filters.</strong>
            <p>
              {age !== "any" && Number(age) < 8
                ? "At ages 6–7, US Kids Golf is the main ranked circuit — most other tours start at 8 or older. Try clearing the tour or month filter."
                : "Try widening the age, choosing a different month, or clearing your filters."}
            </p>
            {activeFilters.length > 0 && <button className="clearbtn" onClick={resetFilters}>Clear all filters</button>}
          </div>
        )}

        <div className="grid">
          {filtered.map((it) => (
            <EventCard key={it.key} it={it}
              open={openKey === it.key}
              onToggle={() => setOpenKey(openKey === it.key ? null : it.key)}
              pinned={isPinned(it)} onPin={() => togglePin(it)} />
          ))}
        </div>

        <section className="guide">
          <h2>Which tours fit which ages?</h2>
          <div className="guidegrid">
            {[
              ["6–9", "US Kids Golf Local Tours are the main ranked option — real leaderboards at age-appropriate yardages, leading to State Invitationals, Regionals, and Worlds at Pinehurst. Drive, Chip & Putt opens at 7 and is free."],
              ["8–11", "Add HJGT's 8–10 division, PGA Jr. League All-Stars, NB3 qualifiers, and PGA section one-day events. Future Masters opens at 10 for boys; Optimist at 10 for everyone."],
              ["11–14", "SJGT and HJGT become the core ranked schedule. Florida players add the FJT at 13. State championships open at 12; girls should look at PKB."],
              ["14–18", "State juniors, Junior PGA qualifying, Future Masters, Junior Orange Bowl, USGA qualifying, and AJGA events build college-recruiting résumés."],
            ].map(([ages, text]) => (
              <div className="guidecard" key={ages}>
                <span className="guideage">{ages}</span>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="sources">
          <h2>Where this data comes from</h2>
          <p className="sourceslede">
            There's no master registry of junior golf, so coverage means tracking every sanctioning
            organization. These {SOURCES.length} bodies run essentially every competitive junior
            event in the tri-state area.
          </p>
          <div className="sourcechips">
            {SOURCES.map((s) => (
              <a key={s.name} className="sourcechip" href={s.url} target="_blank" rel="noreferrer">
                {s.name}
                <span className="sourcest">{s.states.includes("all") ? "AL·FL·MS" : s.states.join("·")}</span>
              </a>
            ))}
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap">
          <strong>PlayFinder</strong> — Junior Golf &amp; Sports Directory
          <p>
            Not affiliated with any tour. Cards marked "typical" show when an event usually runs;
            always confirm dates, eligibility, and fees with the organizer before traveling.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ----------------------------------------------------------------- card */

function EventCard({ it, open, onToggle, pinned, onPin }) {
  const confirmed = it.kind === "confirmed";
  const d = confirmed ? prettyDate(it.startDate) : null;
  const tier = TIER_STYLE[it.tier] || { bg: "#E8F2EC", fg: "#1E6B43" };

  return (
    <article className={`card ${confirmed ? "confirmed" : ""}`}>
      <div className="cardtop" onClick={onToggle} role="button" tabIndex={0} aria-expanded={open}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}>
        <div className={`datebox ${confirmed ? "hard" : "soft"}`}>
          {confirmed ? (
            <><span className="dmon">{d.top}</span><span className="dday">{d.bot}</span></>
          ) : (
            <><span className="dwin">{it.windowLabel}</span><span className="dtyp">typical</span></>
          )}
        </div>

        <div className="cardbody">
          <div className="cardhead">
            {it.st && <span className="stpill">{it.st === "Multi" ? "AL·FL·MS" : it.st}</span>}
            <h3>{it.name}</h3>
          </div>
          <div className="metaline">
            <span className="ages">Ages {it.ageMin}–{it.ageMax}</span>
            {it.gender && <span>{it.gender}</span>}
            {(it.venue || it.city) && <span>{[it.venue, it.city].filter(Boolean).join(" · ")}</span>}
          </div>
          <div className="tagline">
            {confirmed
              ? <span className="tag hard">✓ {it.dateLabel}</span>
              : <span className="tag" style={{ background: tier.bg, color: tier.fg }}>{it.tier}</span>}
            {it.tour && <span className="tourtag">{it.tour}</span>}
            {!confirmed && it.dateLabel && <span className="softdate">{it.dateLabel}</span>}
          </div>
        </div>

        <div className="cardactions">
          <button className={`pinbtn ${pinned ? "on" : ""}`}
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            aria-label={pinned ? "Remove from saved" : "Save this event"}>
            {pinned ? "★" : "☆"}
          </button>
          <span className="chev" aria-hidden>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div className="carddet">
          {it.format && <Row k="Format" v={it.format} />}
          {it.fee && <Row k="Entry fee" v={it.fee} />}
          {it.eligibility && <Row k="Eligibility" v={it.eligibility} />}
          {it.notes && <Row k="Why it matters" v={it.notes} />}
          {confirmed && it.source && <Row k="Found via" v={it.source} />}
          {!it.format && !it.notes && confirmed && (
            <p className="detnote">
              Live listing from the organizer's schedule. Open the event page for divisions, fees,
              and entry deadlines.
            </p>
          )}
          <div className="linkrow">
            {it.links?.map((l, i) => (
              <a key={l.url + i} className={`lnk ${i ? "sec" : ""}`} href={l.url} target="_blank" rel="noreferrer">
                {l.label} ↗
              </a>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function Row({ k, v }) {
  return (
    <div className="drow">
      <span className="dk">{k}</span>
      <span className="dv">{v}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ css */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap');

.pf { --ink:#12241C; --ink2:#4A5C52; --ink3:#7C8B82;
      --grn:#0E5C3A; --grn2:#14764A; --sand:#FAF8F3;
      --line:#E6EAE4; font-family:'Inter',system-ui,sans-serif;
      color:var(--ink); background:#fff; }
.pf *, .pf *::before, .pf *::after { box-sizing:border-box; }
.wrap { max-width:1120px; margin:0 auto; padding:0 20px; }

.hero { background:linear-gradient(160deg,#0B4A2E 0%,#0E5C3A 45%,#177A4C 100%);
        color:#fff; padding:26px 0 34px; position:relative; overflow:hidden; }
.hero::after { content:""; position:absolute; right:-120px; top:-120px; width:420px; height:420px;
        background:radial-gradient(circle,rgba(184,233,134,.22),transparent 68%); pointer-events:none; }
.brandrow { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; margin-bottom:22px; }
.mark { font-family:'Outfit',sans-serif; font-weight:800; font-size:22px; letter-spacing:-.02em; }
.marksub { font-size:12px; font-weight:600; color:#9FD7B8; letter-spacing:.04em; }
.hero h1 { font-family:'Outfit',sans-serif; font-weight:800; font-size:clamp(28px,4.4vw,44px);
        line-height:1.1; letter-spacing:-.02em; margin:0 0 10px; }
.lede { margin:0 0 22px; max-width:560px; font-size:15.5px; line-height:1.55; color:#CDE8D8; }
.states { display:flex; gap:8px; flex-wrap:wrap; }
.statebtn { font-family:inherit; font-size:14.5px; font-weight:600; cursor:pointer;
        padding:11px 20px; border-radius:999px; border:1.5px solid rgba(255,255,255,.35);
        background:rgba(255,255,255,.08); color:#fff; transition:all .15s ease; }
.statebtn:hover { background:rgba(255,255,255,.18); }
.statebtn.on { background:#fff; color:var(--grn); border-color:#fff; }

.controls { background:var(--sand); border-bottom:1px solid var(--line);
        position:sticky; top:0; z-index:20; padding:14px 0; }
.ctrlrow { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
.chiprow { display:flex; align-items:center; gap:10px; min-width:0; }
.chiplabel { font-size:12px; font-weight:700; color:var(--ink3); text-transform:uppercase; letter-spacing:.08em; }
.chipscroll { display:flex; gap:6px; overflow-x:auto; padding-bottom:2px; }
.chip { font-family:inherit; font-size:13.5px; font-weight:600; cursor:pointer; flex:0 0 auto;
        min-width:36px; padding:7px 11px; border-radius:9px; border:1px solid var(--line);
        background:#fff; color:var(--ink2); transition:all .12s ease; }
.chip:hover { border-color:var(--grn2); color:var(--grn); }
.chip.on { background:var(--grn); border-color:var(--grn); color:#fff; }
.ctrlspacer { flex:1 1 auto; }
.search { font-family:inherit; font-size:14px; padding:9px 13px; border-radius:10px;
        border:1px solid var(--line); background:#fff; color:var(--ink); min-width:190px; flex:0 1 240px; }
.morebtn { font-family:inherit; font-size:13.5px; font-weight:600; cursor:pointer; white-space:nowrap;
        padding:9px 14px; border-radius:10px; border:1px solid var(--line); background:#fff;
        color:var(--ink2); display:inline-flex; align-items:center; gap:7px; }
.morebtn:hover { border-color:var(--grn2); }
.badge { background:var(--grn); color:#fff; font-size:11px; font-weight:700; min-width:18px; height:18px;
        border-radius:9px; display:inline-flex; align-items:center; justify-content:center; padding:0 5px; }
.morerow { display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end; margin-top:12px;
        padding-top:12px; border-top:1px solid var(--line); }
.fld { display:flex; flex-direction:column; gap:4px; }
.fld span { font-size:11.5px; font-weight:700; color:var(--ink3); text-transform:uppercase; letter-spacing:.07em; }
.fld select { font-family:inherit; font-size:14px; padding:8px 11px; border-radius:10px;
        border:1px solid var(--line); background:#fff; color:var(--ink); min-width:150px; }
.clearbtn { font-family:inherit; font-size:13px; font-weight:600; cursor:pointer; padding:9px 14px;
        border-radius:10px; border:1px solid var(--line); background:#fff; color:var(--grn); }

.main { padding:22px 20px 60px; }
.statusbar { display:flex; justify-content:space-between; align-items:center; gap:12px;
        flex-wrap:wrap; margin-bottom:16px; }
.tabs { display:inline-flex; background:var(--sand); border:1px solid var(--line);
        border-radius:12px; padding:3px; gap:2px; }
.tab { font-family:inherit; font-size:13.5px; font-weight:600; cursor:pointer; border:none;
        background:transparent; color:var(--ink2); padding:8px 14px; border-radius:9px;
        display:inline-flex; align-items:center; gap:7px; }
.tab.on { background:#fff; color:var(--grn); box-shadow:0 1px 3px rgba(0,0,0,.07); }
.tabnum { font-size:11.5px; font-weight:700; background:rgba(14,92,58,.1); color:var(--grn);
        padding:1px 6px; border-radius:6px; }
.status { display:flex; align-items:center; gap:12px; font-size:12.5px; color:var(--ink3); }
.refresh { font-family:inherit; font-size:12.5px; font-weight:600; cursor:pointer;
        border:1px solid var(--line); background:#fff; color:var(--ink2); padding:6px 11px; border-radius:8px; }
.refresh:hover { border-color:var(--grn2); color:var(--grn); }
.loadingdot { display:inline-flex; align-items:center; gap:8px; font-weight:600; color:var(--grn); }
.loadingdot i { width:9px; height:9px; border-radius:50%; background:var(--grn2);
        animation:pulse 1.1s ease-in-out infinite; }
@keyframes pulse { 0%,100%{opacity:.25;transform:scale(.8)} 50%{opacity:1;transform:scale(1.15)} }

.notice { border-radius:12px; padding:12px 16px; font-size:13.5px; line-height:1.5; margin-bottom:16px; }
.notice.info { background:#EEF4FF; color:#25457F; border:1px solid #D3E0F7; }
.notice.warn { background:#FFF8EC; color:#7A5312; border:1px solid #F2E0BE; }

.skels { display:grid; gap:12px; margin-bottom:16px; }
.skel { height:104px; border-radius:16px; border:1px solid var(--line);
        background:linear-gradient(90deg,#F6F7F5 25%,#EDEFEB 50%,#F6F7F5 75%);
        background-size:200% 100%; animation:shim 1.4s linear infinite; }
@keyframes shim { to { background-position:-200% 0 } }

.grid { display:grid; gap:12px; }
.card { border:1px solid var(--line); border-radius:16px; background:#fff; overflow:hidden;
        transition:box-shadow .15s ease; }
.card:hover { box-shadow:0 6px 22px rgba(18,54,38,.08); }
.card.confirmed { border-color:#CFE6D8; }
.cardtop { display:flex; gap:15px; padding:15px 16px; cursor:pointer; align-items:flex-start; }
.datebox { flex:0 0 auto; width:64px; border-radius:13px; padding:9px 4px; text-align:center;
        display:flex; flex-direction:column; gap:1px; }
.datebox.hard { background:var(--grn); color:#fff; }
.datebox.soft { background:var(--sand); border:1px solid var(--line); color:var(--ink2); }
.dmon { font-family:'Outfit',sans-serif; font-size:11.5px; font-weight:700; letter-spacing:.08em; opacity:.9; }
.dday { font-family:'Outfit',sans-serif; font-size:21px; font-weight:800; line-height:1; }
.dwin { font-family:'Outfit',sans-serif; font-size:12px; font-weight:800; color:var(--grn); line-height:1.15; }
.dtyp { font-size:9.5px; font-weight:600; color:var(--ink3); text-transform:uppercase; letter-spacing:.07em; }
.cardbody { flex:1 1 auto; min-width:0; }
.cardhead { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.stpill { font-size:10.5px; font-weight:800; color:#fff; background:var(--ink);
        padding:2px 7px; border-radius:6px; letter-spacing:.04em; }
.cardbody h3 { font-family:'Outfit',sans-serif; font-size:16.5px; font-weight:700; margin:0;
        letter-spacing:-.01em; line-height:1.25; }
.metaline { display:flex; flex-wrap:wrap; gap:3px 14px; margin-top:5px; font-size:13.5px; color:var(--ink2); }
.ages { font-weight:600; color:var(--grn); }
.tagline { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-top:9px; }
.tag { font-size:11.5px; font-weight:700; padding:3px 9px; border-radius:999px; }
.tag.hard { background:#E4F4EA; color:#0E5C3A; }
.tourtag { font-size:11.5px; font-weight:600; color:var(--ink3); background:var(--sand);
        border:1px solid var(--line); padding:2px 8px; border-radius:999px; }
.softdate { font-size:12px; color:var(--ink3); }
.cardactions { flex:0 0 auto; display:flex; align-items:center; gap:6px; }
.pinbtn { font-family:inherit; font-size:19px; line-height:1; cursor:pointer; border:1px solid var(--line);
        background:#fff; color:var(--ink3); width:34px; height:34px; border-radius:9px; }
.pinbtn:hover { border-color:var(--grn2); color:var(--grn); }
.pinbtn.on { background:#FFF6DC; border-color:#EBD08A; color:#B8860B; }
.chev { color:var(--ink3); font-size:11px; }

.carddet { border-top:1px solid var(--line); padding:14px 16px 16px; background:#FCFDFB; display:grid; gap:9px; }
.drow { display:grid; grid-template-columns:112px 1fr; gap:12px; font-size:13.5px; line-height:1.55; }
.dk { font-size:11.5px; font-weight:700; color:var(--ink3); text-transform:uppercase;
        letter-spacing:.06em; padding-top:2px; }
.dv { color:var(--ink2); }
.detnote { margin:0; font-size:13.5px; line-height:1.55; color:var(--ink2); }
.linkrow { display:flex; flex-wrap:wrap; gap:8px; margin-top:4px; }
.lnk { background:var(--grn); color:#fff; text-decoration:none; font-weight:600; font-size:13px;
        padding:9px 15px; border-radius:10px; display:inline-flex; align-items:center; gap:5px; }
.lnk:hover { background:var(--grn2); }
.lnk.sec { background:var(--sand); color:var(--grn); border:1px solid var(--line); }

.empty { border:1px dashed var(--line); border-radius:16px; padding:34px 24px; text-align:center; background:var(--sand); }
.empty strong { font-family:'Outfit',sans-serif; font-size:16px; }
.empty p { margin:8px auto 14px; max-width:520px; font-size:13.5px; line-height:1.6; color:var(--ink2); }

.guide, .sources { margin-top:40px; }
.guide h2, .sources h2 { font-family:'Outfit',sans-serif; font-size:19px; font-weight:800;
        margin:0 0 6px; letter-spacing:-.01em; }
.guidegrid { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:12px; margin-top:14px; }
.guidecard { border:1px solid var(--line); border-radius:14px; padding:15px 16px; background:var(--sand); }
.guideage { font-family:'Outfit',sans-serif; font-size:15px; font-weight:800; color:var(--grn); }
.guidecard p { margin:7px 0 0; font-size:13px; line-height:1.6; color:var(--ink2); }
.sourceslede { margin:0 0 14px; font-size:13.5px; line-height:1.6; color:var(--ink2); max-width:660px; }
.sourcechips { display:flex; flex-wrap:wrap; gap:7px; }
.sourcechip { display:inline-flex; align-items:center; gap:7px; text-decoration:none;
        border:1px solid var(--line); background:#fff; border-radius:999px; padding:6px 12px;
        font-size:12.5px; font-weight:600; color:var(--ink2); }
.sourcechip:hover { border-color:var(--grn2); color:var(--grn); }
.sourcest { font-size:10px; font-weight:800; color:#fff; background:var(--ink); padding:1px 6px; border-radius:5px; }

.foot { border-top:1px solid var(--line); background:var(--sand); padding:22px 0 30px;
        margin-top:44px; font-size:13px; color:var(--ink2); }
.foot strong { font-family:'Outfit',sans-serif; }
.foot p { margin:7px 0 0; font-size:12.5px; line-height:1.6; color:var(--ink3); max-width:640px; }

button:focus-visible, a:focus-visible, select:focus-visible, input:focus-visible,
[role="button"]:focus-visible { outline:2px solid var(--grn2); outline-offset:2px; }

@media (max-width:640px) {
  .drow { grid-template-columns:1fr; gap:2px; }
  .cardtop { gap:11px; padding:13px; }
  .datebox { width:56px; }
  .search { flex:1 1 100%; }
  .statusbar { align-items:flex-start; }
}
@media (prefers-reduced-motion:reduce) { * { animation:none !important; transition:none !important; } }
`;
