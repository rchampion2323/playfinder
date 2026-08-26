import React, { useState, useMemo, useEffect } from "react";
import { MONTH_ABBR, STATES, REGIONS_BY_STATE } from "./data/constants.js";
import { EVENTS, TOURS } from "./data/events.js";
import { SOURCES } from "./data/sources.js";
import { TIER_STYLE, monthChip } from "./lib/format.js";
import * as storage from "./lib/storage.js";
import * as api from "./lib/api.js";

export default function PlayFinder() {
  const [stateF, setStateF] = useState("all");
  const [age, setAge] = useState("any");
  const [region, setRegion] = useState("All areas");
  const [tour, setTour] = useState("All tours");
  const [month, setMonth] = useState("any");
  const [sortBy, setSortBy] = useState("date");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);

  // Deep scan + pinned events state
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(null); // {done, total}
  const [liveResults, setLiveResults] = useState(null);   // accumulates as sources finish
  const [liveError, setLiveError] = useState(null);
  const [pinned, setPinned] = useState([]);

  // Source discovery state
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState(null);
  const [customSources, setCustomSources] = useState([]);

  // All sources = built-in + user-added
  const allSources = useMemo(() => [...SOURCES, ...customSources], [customSources]);

  // Load pinned events + custom sources from persistent storage on mount
  useEffect(() => {
    (async () => {
      try {
        const v = await storage.get("pinned-events");
        if (v) setPinned(v);
      } catch { /* none yet */ }
      try {
        const v = await storage.get("custom-sources");
        if (v) setCustomSources(v);
      } catch { /* none yet */ }
    })();
  }, []);

  async function saveCustomSources(next) {
    setCustomSources(next);
    await storage.set("custom-sources", next);
  }

  function addSource(s) {
    const exists = allSources.some((x) => x.name.toLowerCase() === String(s.name).toLowerCase());
    if (exists) return;
    saveCustomSources([...customSources, {
      name: s.name,
      url: s.url || "",
      states: s.states || ["all"],
      cat: s.cat || "Added from discovery scan",
      scan: `${s.name} junior golf tournament schedule`,
      custom: true,
    }]);
  }

  async function runDiscoveryScan() {
    setDiscovering(true); setDiscovered(null);
    try {
      const data = await api.discoverSources({
        state: stateF,
        known: allSources.map((s) => s.name),
      });
      if (data?.error) {
        setDiscovered({
          notConfigured: data.error === api.NOT_CONFIGURED,
          errorMessage: data.message || null,
          items: [],
        });
        return;
      }
      const known = new Set(allSources.map((x) => x.name.toLowerCase()));
      const items = (Array.isArray(data?.sources) ? data.sources : [])
        .filter((r) => r.name && !known.has(String(r.name).toLowerCase()));
      setDiscovered({ items });
    } catch (err) {
      console.error("Discovery error:", err);
      setDiscovered({ items: [] });
    } finally {
      setDiscovering(false);
    }
  }

  const regionOptions = useMemo(() => {
    if (stateF === "all") return ["All areas", ...Object.values(REGIONS_BY_STATE).flat()];
    return ["All areas", ...REGIONS_BY_STATE[stateF], ...REGIONS_BY_STATE.Multi];
  }, [stateF]);

  const filtered = useMemo(() => {
    let list = EVENTS.filter((e) => {
      if (stateF !== "all" && e.st !== stateF && e.st !== "Multi") return false;
      if (age !== "any") { const a = Number(age); if (a < e.ageMin || a > e.ageMax) return false; }
      if (region !== "All areas" && e.region !== region && !e.region.includes("Statewide") && e.st !== "Multi") return false;
      if (region !== "All areas" && (e.region.includes("Statewide") || e.st === "Multi")) {
        // statewide/multi events show for any area within a matching state
        const areaState = Object.entries(REGIONS_BY_STATE).find(([, regs]) => regs.includes(region))?.[0];
        if (areaState && areaState !== "Multi" && e.st !== "Multi" && !e.region.startsWith(areaState)) return false;
      }
      if (tour !== "All tours" && e.tour !== tour) return false;
      if (month !== "any" && !e.when.months.includes(Number(month))) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!`${e.name} ${e.city} ${e.venue} ${e.tour} ${e.notes} ${e.format}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    if (sortBy === "date") list = [...list].sort((a, b) => Math.min(...a.when.months) - Math.min(...b.when.months) || a.name.localeCompare(b.name));
    return list;
  }, [stateF, age, region, tour, month, sortBy, query]);

  const grouped = useMemo(() => {
    if (sortBy !== "area") return null;
    const g = {};
    filtered.forEach((e) => { (g[e.region] = g[e.region] || []).push(e); });
    return g;
  }, [filtered, sortBy]);

  async function scanSource(src, seen) {
    // Calls YOUR backend, which holds the Anthropic key server-side.
    const data = await api.scanSource({ source: src, state: stateF, age, month });
    if (data?.error) {
      const e = new Error(data.message || data.error);
      e.code = data.error;
      throw e;
    }
    const rows = Array.isArray(data?.events) ? data.events : [];
    const tagged = rows.map((r) => ({ ...r, source: src.name }));
    setLiveResults((prev) => {
      const merged = [...(prev || [])];
      tagged.forEach((r) => {
        const k = String(r.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (k && !seen.has(k)) { seen.add(k); merged.push(r); }
      });
      return merged;
    });
  }

  async function runDeepScan() {
    // Pick the sources relevant to the selected state, capped to keep the scan fast
    const targets = allSources
      .filter((s) => stateF === "all" || s.states.includes(stateF) || s.states.includes("all"))
      .slice(0, 10);
    setScanning(true); setLiveError(null); setLiveResults([]);
    setScanProgress({ done: 0, total: targets.length });
    const seen = new Set();
    let done = 0;
    const results = await Promise.allSettled(
      targets.map((src) =>
        scanSource(src, seen).finally(() => {
          done += 1;
          setScanProgress({ done, total: targets.length });
        })
      )
    );
    const codes = results
      .filter((r) => r.status === "rejected")
      .map((r) => r.reason?.code);
    const allFailed = results.every((r) => r.status === "rejected");

    if (codes.includes(api.NOT_CONFIGURED)) {
      setLiveError(
        "Live scanning isn't available yet — the API key hasn't been added in Azure. " +
        "Everything else (filters, reference events, pins) works without it."
      );
    } else if (codes.includes("BAD_KEY")) {
      setLiveError("The Anthropic API key was rejected. Check it in Azure → Environment variables.");
    } else if (codes.includes("RATE_LIMITED")) {
      setLiveError("Too many scans in the last hour. Try again shortly.");
    } else if (allFailed) {
      setLiveError("The scan couldn't reach the server — try again in a moment.");
    }
    setScanning(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F6F7F4", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", color: "#182420" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap');
        .disp { font-family:'Plus Jakarta Sans','Inter',sans-serif; }
        .card { background:#fff; border:1px solid #E4E8E2; border-radius:16px; transition:box-shadow .15s ease; }
        .card:hover { box-shadow:0 6px 24px rgba(24,60,45,.08); }
        .lnk { background:#173F2F; color:#fff; text-decoration:none; font-weight:600; font-size:13px; padding:9px 14px; border-radius:10px; display:inline-flex; align-items:center; gap:6px; }
        .lnk:hover { background:#1E5540; }
        .lnk.sec { background:#EDF2EE; color:#173F2F; }
        .lnk.sec:hover { background:#E1EAE3; }
        select, input { outline:none; background:#fff; border:1px solid #DDE3DC; border-radius:10px; padding:9px 12px; font-size:14px; font-family:inherit; color:#182420; }
        select:focus-visible, input:focus-visible, a:focus-visible, .card:focus-visible, button:focus-visible { outline:2px solid #1E5540; outline-offset:2px; }
        .seg { border:1px solid #DDE3DC; background:#fff; border-radius:10px; overflow:hidden; display:inline-flex; }
        .seg button { border:none; background:transparent; padding:9px 14px; font-size:13px; font-weight:600; cursor:pointer; color:#5A6A61; font-family:inherit; }
        .seg button.on { background:#173F2F; color:#fff; }
        .livebtn { border:none; cursor:pointer; font-family:inherit; background:linear-gradient(135deg,#B4622A,#D07B2F); color:#fff; font-weight:700; font-size:13.5px; padding:10px 18px; border-radius:10px; display:inline-flex; align-items:center; gap:8px; }
        .livebtn:disabled { opacity:.6; cursor:wait; }
        .livebtn.alt { background:linear-gradient(135deg,#2C4FA3,#3C68C8); }
        .spin { width:14px; height:14px; border:2px solid rgba(255,255,255,.4); border-top-color:#fff; border-radius:50%; animation:spin .8s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { * { transition:none !important; animation:none !important; } }
      `}</style>

      {/* ---- Header ---- */}
      <header style={{ background: "linear-gradient(135deg,#12352A 0%,#1E5540 60%,#2A6E52 100%)", color: "#fff", padding: "40px 20px 88px" }}>
        <div style={{ maxWidth: 1020, margin: "0 auto" }}>
          <div className="disp" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#9FD7B8" }}>
            Junior Golf &amp; Sports Directory · Ages 6–18
          </div>
          <h1 className="disp" style={{ margin: "10px 0 8px", fontSize: "clamp(30px,5vw,46px)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.01em" }}>
            PlayFinder
          </h1>
          <div className="disp" style={{ fontSize: "clamp(15px,2.6vw,22px)", fontWeight: 700, color: "#9FD7B8", marginBottom: 10 }}>
            Gulf Coast Junior Golf · Alabama · Florida · Mississippi
          </div>
          <p style={{ margin: 0, maxWidth: 600, fontSize: 15, lineHeight: 1.55, color: "#CFE7DA" }}>
            Every ranked tour and championship pathway across the tri-state Gulf region — filter by age, state, area, and time of year, then pull live current-season dates with one tap.
          </p>
        </div>
      </header>

      {/* ---- Filter bar ---- */}
      <section style={{ maxWidth: 1020, margin: "-56px auto 0", padding: "0 16px", position: "relative", zIndex: 2 }}>
        <div className="card" style={{ padding: "18px 18px 14px", boxShadow: "0 10px 34px rgba(18,53,42,.12)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
            <Field label="State">
              <select value={stateF} onChange={(e) => { setStateF(e.target.value); setRegion("All areas"); }}>
                <option value="all">All three states</option>
                <option value="AL">Alabama</option>
                <option value="FL">Florida</option>
                <option value="MS">Mississippi</option>
              </select>
            </Field>
            <Field label="Player age">
              <select value={age} onChange={(e) => setAge(e.target.value)}>
                <option value="any">Any age</option>
                {Array.from({ length: 13 }, (_, i) => i + 6).map((a) => <option key={a} value={a}>{a} years old</option>)}
              </select>
            </Field>
            <Field label="Area">
              <select value={region} onChange={(e) => setRegion(e.target.value)}>
                {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Time of year">
              <select value={month} onChange={(e) => setMonth(e.target.value)}>
                <option value="any">Any month</option>
                {MONTH_ABBR.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </Field>
            <Field label="Tour">
              <select value={tour} onChange={(e) => setTour(e.target.value)}>
                {TOURS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Search" grow>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Course, city, event…" style={{ width: "100%" }} />
            </Field>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 14 }}>
            <div className="seg" role="group" aria-label="Sort results">
              <button className={sortBy === "date" ? "on" : ""} onClick={() => setSortBy("date")}>By time of year</button>
              <button className={sortBy === "area" ? "on" : ""} onClick={() => setSortBy("area")}>By area</button>
            </div>
            <button className="livebtn" onClick={runDeepScan} disabled={scanning}>
              {scanning
                ? <><span className="spin" /> Scanning {scanProgress ? `${scanProgress.done}/${scanProgress.total}` : ""} sources…</>
                : <>⚡ Deep scan — search every source</>}
            </button>
            <button className="livebtn alt" onClick={runDiscoveryScan} disabled={discovering}>
              {discovering ? <><span className="spin" /> Finding new tours…</> : <>🔍 Find missing tours</>}
            </button>
            <span style={{ fontSize: 13, color: "#5A6A61", fontWeight: 500 }}>
              {filtered.length} event{filtered.length === 1 ? "" : "s"} · tap a card for details
            </span>
          </div>
        </div>
        <p style={{ fontSize: 12.5, color: "#71806F", margin: "10px 4px 0", lineHeight: 1.5 }}>
          Reference cards show typical annual windows. <b>Deep scan</b> runs a separate web search against each sanctioning organization for your state/age/month and merges the verified results — pin the ones you like and they'll be saved here for next time.
        </p>
      </section>

      {/* ---- Discovered tours ---- */}
      {discovered && (
        <section style={{ maxWidth: 1020, margin: "20px auto 0", padding: "0 16px" }}>
          <div className="card" style={{ padding: "18px 20px", border: "1px solid #C6D3EE", background: "#F7F9FF" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span className="disp" style={{ fontSize: 15, fontWeight: 800, color: "#2C4FA3" }}>🔍 Tours not yet in the app</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "#5C79BC" }}>Add one and it joins every future deep scan</span>
            </div>
            {discovered.notConfigured && (
              <p style={{ margin: 0, fontSize: 13.5, color: "#3C5590" }}>
                Tour discovery needs the API key added in Azure. Until then, the checklist below is the master source list.
              </p>
            )}
            {!discovered.notConfigured && discovered.errorMessage && (
              <p style={{ margin: 0, fontSize: 13.5, color: "#3C5590" }}>{discovered.errorMessage}</p>
            )}
            {!discovered.notConfigured && !discovered.errorMessage && discovered.items.length === 0 && (
              <p style={{ margin: 0, fontSize: 13.5, color: "#3C5590" }}>
                No new organizations found this time — the source list looks complete for these filters. Try switching states and scanning again.
              </p>
            )}
            <div style={{ display: "grid", gap: 10 }}>
              {discovered.items.map((d, i) => (
                <div key={i} style={{ background: "#fff", border: "1px solid #C6D3EE", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <span className="disp" style={{ fontSize: 15, fontWeight: 700, color: "#12352A" }}>{d.name}</span>
                    {Array.isArray(d.states) && (
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: "#2C4FA3", padding: "1px 6px", borderRadius: 5 }}>{d.states.join("·")}</span>
                    )}
                    <button onClick={() => addSource(d)}
                      style={{ marginLeft: "auto", border: "1px solid #2C4FA3", background: "#2C4FA3", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", borderRadius: 8, padding: "5px 12px" }}>
                      + Add to sources
                    </button>
                  </div>
                  {d.cat && <div style={{ fontSize: 13, color: "#42544B", marginTop: 4, lineHeight: 1.45 }}>{d.cat}</div>}
                  {d.url && <a href={d.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "#1E5540" }}>{d.url.replace(/^https?:\/\//, "")} ↗</a>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---- Pinned events (persistent) ---- */}
      {pinned.length > 0 && (
        <section style={{ maxWidth: 1020, margin: "20px auto 0", padding: "0 16px" }}>
          <div className="card" style={{ padding: "18px 20px", border: "1px solid #C4DCC9", background: "#F4FAF5" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span className="disp" style={{ fontSize: 15, fontWeight: 800, color: "#1E5540" }}>📌 Your pinned events</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "#5A8A6B" }}>Saved across sessions</span>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {pinned.map((r, i) => (
                <div key={i} style={{ background: "#fff", border: "1px solid #C4DCC9", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "baseline" }}>
                    <span className="disp" style={{ fontSize: 15, fontWeight: 700, color: "#12352A" }}>{r.name}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#1E6B43" }}>{r.dates}</span>
                    <button onClick={() => unpin(r)} style={{ marginLeft: "auto", border: "none", background: "transparent", color: "#8A9A8E", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Unpin ✕</button>
                  </div>
                  <div style={{ fontSize: 13, color: "#42544B", marginTop: 3 }}>
                    {[r.venue, r.city, r.state].filter(Boolean).join(" · ")}{r.ages ? ` · Ages ${String(r.ages).replace(/^ages\s*/i, "")}` : ""}{r.tour ? ` · ${r.tour}` : ""}
                  </div>
                  {r.url && <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "#1E5540" }}>Event page ↗</a>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---- Live scan results ---- */}
      {(liveResults || liveError) && (
        <section style={{ maxWidth: 1020, margin: "20px auto 0", padding: "0 16px" }}>
          <div className="card" style={{ padding: "18px 20px", border: "1px solid #EBD3B8", background: "#FFFBF5" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span className="disp" style={{ fontSize: 15, fontWeight: 800, color: "#8A4A14" }}>⚡ Live results from the web</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "#A9743B" }}>
                {scanning
                  ? `Scanning source ${scanProgress?.done ?? 0} of ${scanProgress?.total ?? 0} — results appear as they're found`
                  : "Verify details on the linked page before registering · pin to save"}
              </span>
            </div>
            {liveError && <p style={{ margin: 0, fontSize: 13.5, color: "#8A4A14" }}>{liveError}</p>}
            {liveResults && liveResults.length === 0 && !scanning && !liveError && (
              <p style={{ margin: 0, fontSize: 13.5, color: "#8A4A14" }}>No verified events found for these filters — try widening the month or picking a different state.</p>
            )}
            {liveResults && liveResults.length > 0 && (
              <div style={{ display: "grid", gap: 10 }}>
                {liveResults.map((r, i) => (
                  <div key={i} style={{ background: "#fff", border: "1px solid #EBD3B8", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "baseline" }}>
                      <span className="disp" style={{ fontSize: 15, fontWeight: 700, color: "#12352A" }}>{r.name}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "#B4622A" }}>{r.dates}</span>
                      <button onClick={() => (isPinned(r) ? unpin(r) : pin(r))}
                        style={{ marginLeft: "auto", border: `1px solid ${isPinned(r) ? "#1E6B43" : "#DDC49E"}`, background: isPinned(r) ? "#E7F4EC" : "#fff", color: isPinned(r) ? "#1E6B43" : "#8A4A14", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", borderRadius: 8, padding: "4px 10px" }}>
                        {isPinned(r) ? "Pinned ✓" : "📌 Pin"}
                      </button>
                    </div>
                    <div style={{ fontSize: 13, color: "#42544B", marginTop: 3 }}>
                      {[r.venue, r.city, r.state].filter(Boolean).join(" · ")}{r.ages ? ` · Ages ${String(r.ages).replace(/^ages\s*/i, "")}` : ""}{r.tour ? ` · ${r.tour}` : ""}
                      {r.source && <span style={{ color: "#A9743B", fontWeight: 600 }}> · via {r.source}</span>}
                    </div>
                    {r.url && <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "#1E5540" }}>Event page ↗</a>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---- Results ---- */}
      <main style={{ maxWidth: 1020, margin: "0 auto", padding: "24px 16px 64px" }}>
        {filtered.length === 0 && (
          <div className="card" style={{ padding: 32, textAlign: "center", color: "#5A6A61" }}>
            No reference events match these filters. For ages 6–7, US Kids Golf is essentially the only ranked circuit — most tours start at 8, 10, or 11–13. Try clearing the tour or month filter.
          </div>
        )}

        {sortBy === "area" && grouped && Object.entries(grouped).map(([reg, events]) => (
          <section key={reg} style={{ marginBottom: 26 }}>
            <h2 className="disp" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#1E5540", margin: "0 0 10px 4px" }}>{reg}</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {events.map((e) => <EventCard key={e.id} e={e} open={openId === e.id} toggle={() => setOpenId(openId === e.id ? null : e.id)} />)}
            </div>
          </section>
        ))}

        {sortBy === "date" && (
          <div style={{ display: "grid", gap: 12 }}>
            {filtered.map((e) => <EventCard key={e.id} e={e} open={openId === e.id} toggle={() => setOpenId(openId === e.id ? null : e.id)} showRegion />)}
          </div>
        )}

        <section className="card" style={{ marginTop: 20, padding: "22px 24px" }}>
          <h2 className="disp" style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 800, color: "#12352A" }}>
            Source coverage checklist <span style={{ fontSize: 13, fontWeight: 700, color: "#5A6A61" }}>· {allSources.length} organizations</span>
          </h2>
          <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.55, color: "#5A6A61" }}>
            There's no master registry of junior golf, so completeness comes from covering every sanctioning organization. Every event belongs to one of these. Use <b>🔍 Find missing tours</b> above to have Claude search for organizations that aren't on this list yet — added sources are saved and included in every future deep scan.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {allSources.map((s) => (
              <div key={s.name} style={{ border: `1px solid ${s.custom ? "#C6D3EE" : "#E4E8E2"}`, borderRadius: 12, padding: "10px 12px", background: s.custom ? "#F7F9FF" : "#FBFCFA" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <a href={s.url} target="_blank" rel="noreferrer" className="disp" style={{ fontSize: 13.5, fontWeight: 700, color: "#12352A", textDecoration: "none" }}>{s.name} ↗</a>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: s.custom ? "#2C4FA3" : "#173F2F", padding: "1px 6px", borderRadius: 5, letterSpacing: "0.04em" }}>
                    {s.states.includes("all") ? "AL·FL·MS" : s.states.join("·")}
                  </span>
                  {s.custom && (
                    <button onClick={() => saveCustomSources(customSources.filter((c) => c.name !== s.name))}
                      style={{ marginLeft: "auto", border: "none", background: "transparent", color: "#8A9AB8", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#5A6A61", marginTop: 3, lineHeight: 1.45 }}>{s.cat}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card" style={{ marginTop: 36, padding: "22px 24px" }}>
          <h2 className="disp" style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 800, color: "#12352A" }}>Which tour fits which age?</h2>
          <Guide age="6–9">US Kids Golf Local Tours (all three states) are the main ranked option — points lead to State Invitationals → Regionals → Worlds at Pinehurst. Drive, Chip & Putt opens at 7 and is free.</Guide>
          <Guide age="8–11">Add HJGT's 8–10 division, PGA Jr. League All-Stars, NB3 qualifiers, FCWT's young divisions (FL), and PGA section one-day events. Future Masters opens at 10 for boys; Optimist at 10 for everyone.</Guide>
          <Guide age="11–14">SJGT and HJGT become the core ranked schedule region-wide; Florida players add the FJT at 13. State championships (AGA, FSGA, MGA) open at 12; girls should look at PKB.</Guide>
          <Guide age="14–18">State juniors, Junior PGA qualifying, Future Masters, Southern Junior, Junior Orange Bowl, and AJGA events build college-recruiting résumés, with SJGT/HJGT/FJT filling the calendar and feeding AJGA Performance Stars.</Guide>
        </section>
      </main>

      <footer style={{ borderTop: "1px solid #E4E8E2", padding: 18, textAlign: "center", fontSize: 12, color: "#71806F" }}>
        PlayFinder — Junior Golf &amp; Sports Directory. Not affiliated with any tour. Confirm eligibility, dates, and fees with each organizer.
      </footer>
    </div>
  );
}

function EventCard({ e, open, toggle, showRegion }) {
  const tier = TIER_STYLE[e.tier] || { bg: "#EEE", fg: "#444" };
  return (
    <article className="card" tabIndex={0} role="button" aria-expanded={open}
      onClick={toggle}
      onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); } }}
      style={{ padding: "16px 18px", cursor: "pointer" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flexShrink: 0, width: 78, textAlign: "center", background: "#F0F5F1", border: "1px solid #DCE7DE", borderRadius: 12, padding: "10px 4px" }}>
          <div className="disp" style={{ fontSize: 14.5, fontWeight: 800, color: "#173F2F", lineHeight: 1.15 }}>{monthChip(e.when.months)}</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#71806F", marginTop: 3, letterSpacing: "0.06em" }}>TYPICAL</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: "#173F2F", padding: "2px 7px", borderRadius: 6, letterSpacing: "0.04em" }}>{e.st === "Multi" ? "AL·FL·MS" : e.st}</span>
            <span className="disp" style={{ fontSize: 16.5, fontWeight: 700, color: "#12352A" }}>{e.name}</span>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", background: tier.bg, color: tier.fg, padding: "3px 9px", borderRadius: 999 }}>{e.tier}</span>
          </div>
          <div style={{ marginTop: 5, fontSize: 13.5, color: "#42544B", display: "flex", flexWrap: "wrap", gap: "3px 16px" }}>
            <span style={{ fontWeight: 600, color: "#1E5540" }}>Ages {e.ageMin}–{e.ageMax} · {e.gender}</span>
            <span>{e.venue} — {e.city}</span>
            {showRegion && <span style={{ color: "#71806F" }}>{e.region}</span>}
          </div>
          <div style={{ marginTop: 3, fontSize: 12.5, color: "#71806F" }}>{e.when.label}</div>
        </div>
        <span aria-hidden style={{ color: "#9AAC9F", fontSize: 14, paddingTop: 4 }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div onClick={(ev) => ev.stopPropagation()} style={{ marginTop: 14, borderTop: "1px solid #ECF0EA", paddingTop: 14, display: "grid", gap: 9, cursor: "default" }}>
          <Detail label="Format" value={e.format} />
          <Detail label="Typical fee" value={e.fee} />
          <Detail label="Eligibility" value={e.eligibility} />
          <Detail label="Why it matters" value={e.notes} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            {e.links.map((l, i) => (
              <a key={l.url + l.label} className={`lnk${i > 0 ? " sec" : ""}`} href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function Detail({ label, value }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 12, fontSize: 13.5, lineHeight: 1.55 }}>
      <span style={{ color: "#71806F", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", paddingTop: 2 }}>{label}</span>
      <span style={{ color: "#2A3A32" }}>{value}</span>
    </div>
  );
}

function Field({ label, children, grow }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontWeight: 600, color: "#5A6A61", textTransform: "uppercase", letterSpacing: "0.06em", flex: grow ? "1 1 160px" : "0 0 auto" }}>
      {label}
      {children}
    </label>
  );
}

function Guide({ age, children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 14, marginBottom: 10, alignItems: "start" }}>
      <span className="disp" style={{ background: "#F0F5F1", color: "#173F2F", fontWeight: 800, fontSize: 13, borderRadius: 10, padding: "6px 0", textAlign: "center" }}>{age}</span>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "#42544B" }}>{children}</p>
    </div>
  );
}
