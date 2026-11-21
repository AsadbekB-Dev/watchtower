import { useEffect, useMemo, useState } from 'react';
import DataGlobe from '../components/DataGlobe.jsx';
import AppIcon from '../components/AppIcon.jsx';
import AiExplain from '../components/AiExplain.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import { CATEGORIES, CATEGORY_INFO, SEVERITY, fmtSpan, placeDetails, placeKey, portInfo, summarizeFlows } from '../lib/network.js';
import { KIND_LABEL } from '../lib/sensors.js';

function ago(ms) {
  const d = Date.now() - ms;
  if (d < 60000) return 'just now';
  return `${Math.round(d / 60000)} min ago`;
}

function PlacePanel({ details, picked, onClose, isBlocked, onBlock, busy }) {
  if (!details) return null;
  const groups = [...details.groups].sort((a, b) => {
    const pa = picked.flow && a.keys.includes(picked.flow) ? -1 : 0;
    const pb = picked.flow && b.keys.includes(picked.flow) ? -1 : 0;
    return pa - pb || SEVERITY[a.category] - SEVERITY[b.category];
  });
  return (
    <div className="place-panel">
      <div className="pp-head">
        <div>
          <div className="pp-title">{details.city ? `${details.city}, ` : ''}{details.country}</div>
          <div className="pp-sub">{details.count} connection{details.count === 1 ? '' : 's'} from {details.apps} app{details.apps === 1 ? '' : 's'}{details.network ? ` · network: ${details.network}` : ''}</div>
        </div>
        <button className="pp-close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="pp-list">
        <AiExplain details={details} />
        {groups.map((g) => {
          const hot = picked.flow && g.keys.includes(picked.flow);
          return (
            <div key={g.name} className={`pp-item${hot ? ' hot' : ''}`} style={{ '--c': CATEGORIES[g.category].color }}>
              <div className="pp-row1">
                <b>{g.name}</b>
                <span className="pp-cat">{CATEGORIES[g.category].label}</span>
              </div>
              <div className="pp-info">{CATEGORY_INFO[g.category]}</div>
              <div className="pp-apps">
                {g.apps.map(([name, path]) => (
                  <span key={name} className="pp-app"><AppIcon path={path} name={name} size={18} /> {name}</span>
                ))}
              </div>
              {g.category === 'normal' && g.domains.length === 0 && (
                <div className="pp-note">No website name was recorded for this server, so it's named after the network that runs it. That's usually a content-delivery network, a game or voice server, or an app's background service.</div>
              )}
              <div className="pp-meta">
                <div><span>Website</span>{g.domains.length ? g.domains.slice(0, 3).join(', ') : <i className="dim">none recorded</i>}</div>
                <div><span>Run by</span>{g.network || <i className="dim">unknown</i>}</div>
                <div>
                  <span>Security</span>
                  {g.ports.map((p) => portInfo(p)).map((pi, i) => (
                    <em key={i} className={pi.secure === true ? 'ok' : pi.secure === false ? 'bad' : ''}>
                      {pi.secure === true ? '🔒 Encrypted' : pi.secure === false ? '⚠ Not encrypted' : 'Unknown'} · {pi.label}{i < g.ports.length - 1 ? ', ' : ''}
                    </em>
                  )).slice(0, 2)}
                </div>
                <div><span>Server</span>{g.ips.slice(0, 2).join(', ')}{g.ips.length > 2 ? ` +${g.ips.length - 2} more` : ''}</div>
                <div><span>Status</span>{g.active ? <em className="on">Connected now · for {fmtSpan(g.lastSeen - g.firstSeen)}</em> : <>Last seen {ago(g.lastSeen)}</>}</div>
              </div>
              <div className="pp-actions">
                {isBlocked(g.name) ? (
                  <span className="blocked-tag">⛔ Blocked</span>
                ) : g.category !== 'normal' ? (
                  <button className="btn danger sm" disabled={busy} onClick={() => onBlock([{ name: g.name, ips: g.ips, category: g.category }])}>Block this tracker</button>
                ) : (
                  <button
                    className="btn ghost sm"
                    disabled={busy}
                    onClick={() => {
                      const apps = g.apps.map(([n]) => n).join(', ');
                      if (window.confirm(`${g.name} looks like regular traffic. Blocking it may break ${apps}. Block anyway?`)) onBlock([{ name: g.name, ips: g.ips, category: g.category }]);
                    }}
                  >
                    Block…
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ value, label, tone }) {
  return (
    <div className={`stat ${tone || ''}`}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

export default function DataMap({ net, settings }) {
  const [qInfo, setQInfo] = useState(null);
  const [selected, setSelected] = useState(null);
  const [picked, setPicked] = useState(null);
  const [blocked, setBlocked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    window.watchtower.firewall.list().then(setBlocked);
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const blockedIps = useMemo(() => new Set(blocked.flatMap((b) => b.ips)), [blocked]);
  const blockedNames = useMemo(() => new Set(blocked.map((b) => b.name)), [blocked]);
  const isBlocked = (name) => blockedNames.has(String(name).replace(/[^A-Za-z0-9 .,()&+_-]/g, '').trim().slice(0, 60));

  async function block(items) {
    setBusy(true);
    setToast({ kind: 'info', text: 'Windows will ask for permission to change the firewall…' });
    const r = await window.watchtower.firewall.block(items);
    setBusy(false);
    setBlocked(r.blocked || []);
    setToast(r.ok ? { kind: 'ok', text: `Blocked ${items.length === 1 ? items[0].name : `${items.length} trackers`}. Their connections are now refused by Windows Firewall.` } : { kind: 'err', text: r.error });
  }

  async function unblock(rules) {
    setBusy(true);
    const r = await window.watchtower.firewall.unblock(rules);
    setBusy(false);
    setBlocked(r.blocked || []);
    setToast(r.ok ? { kind: 'ok', text: 'Unblocked.' } : { kind: 'err', text: r.error });
  }

  // Blocked servers drop off the globe and the lists right away
  const allFlows = net?.flows || [];
  const flows = useMemo(() => allFlows.filter((f) => !blockedIps.has(f.ip)), [allFlows, blockedIps]);

  const blockAllTrackers = () => {
    const by = new Map();
    for (const f of flows) {
      if (f.local || f.category === 'normal') continue;
      const name = f.company || f.domain || f.ip;
      const it = by.get(name) || { name, ips: [], category: f.category };
      it.ips.push(f.ip);
      by.set(name, it);
    }
    if (by.size) block([...by.values()]);
  };
  const s = useMemo(() => summarizeFlows(flows, selected), [flows, selected]);
  const details = useMemo(() => (picked ? placeDetails(flows, picked.place, selected) : null), [flows, picked, selected]);

  // If the picked place disappears (filter changed, connections expired), close the panel
  useEffect(() => {
    if (picked && !details) setPicked(null);
  }, [picked, details]);

  const pickApp = (app) => {
    setPicked(null);
    setSelected((cur) => (cur === app ? null : app));
  };

  return (
    <div className="view view-wide">
      <header className="map-head">
        <div>
          <div className="eyebrow">Live · this session</div>
          <h1 className="title">
            {selected ? <>{selected} talked to </> : <>Your PC talked to </>}<span className="grad">{s.companies} compan{s.companies === 1 ? 'y' : 'ies'}</span> in <span className="grad">{s.countries} countr{s.countries === 1 ? 'y' : 'ies'}</span>
            {s.trackerCount > 0 && <>, including <span className="t-live">{s.trackerCount} tracker{s.trackerCount === 1 ? '' : 's'}</span></>}
            {s.identityCount > 0 && <> ({s.identityCount} building an ID on you)</>}.
          </h1>
        </div>
        {selected && (
          <button className="pill" onClick={() => pickApp(selected)}>
            Showing {selected} only <span>✕</span>
          </button>
        )}
      </header>

      {net && !net.ok && <div className="banner error">Couldn't read connections: {net.error}</div>}
      {net?.unsupported && <div className="banner">Live connections need Windows. Run Watchtower on your PC.</div>}

      <div className="map-grid">
        <section className="globe-panel">
          {!net ? <div className="loading"><span className="pulse small" /> Mapping your connections…</div> : (
            <ErrorBoundary
              name="Globe"
              fallback={(err, retry) => (
                <div className="crash">
                  <b>The 3D globe couldn't start on this PC.</b>
                  <span>{String(err.message || err)}. The lists on the right still work.</span>
                  <button className="btn" onClick={retry}>Try again</button>
                </div>
              )}
            >
              <DataGlobe
                flows={flows}
                home={net.home}
                selectedApp={selected}
                picked={picked}
                onPick={setPicked}
                quality={settings?.globeQuality}
                liveClouds={settings?.liveClouds}
                spin={settings?.spin !== false}
                onQualityInfo={setQInfo}
              />
            </ErrorBoundary>
          )}
          {settings?.globeQuality === 'quality' && qInfo && (
            <div className="q-badge">
              {qInfo.failed ? 'Quality mode unavailable, showing performance mode' : qInfo.clouds === 'live' ? '● Live clouds · real sun position' : qInfo.clouds === 'built-in' ? 'Real sun position · built-in clouds (live clouds offline)' : 'Real sun position'}
            </div>
          )}
          {net && net.geoEnabled === false && <div className="q-badge">Map placement is off in Settings</div>}
          {picked && details && <PlacePanel details={details} picked={picked} onClose={() => setPicked(null)} isBlocked={isBlocked} onBlock={block} busy={busy} />}
          {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
          <div className="globe-stats">
            <Stat value={s.active} label="live connections" />
            <Stat value={s.countries} label="countries" />
            <Stat value={s.companies} label="companies" />
            <Stat value={s.trackerCount} label="trackers" tone={s.trackerCount ? 'bad' : ''} />
          </div>
        </section>

        <aside className="side-panel">
          <div className="side-block">
            <h2>Apps on the internet</h2>
            <div className="app-list">
              {s.apps.length === 0 && <div className="muted">Waiting for connections…</div>}
              {s.apps.map((a) => (
                <button key={a.app} className={`app-row${selected === a.app ? ' on' : ''}`} onClick={() => pickApp(a.app)}>
                  <AppIcon path={a.path} name={a.app} size={28} />
                  <div className="app-main">
                    <div className="app-name">
                      {a.app}
                      {a.active && <span className="live-dot" />}
                      {KIND_LABEL[a.kind] && <span className={`kind kind-${a.kind}`}>{KIND_LABEL[a.kind]}</span>}
                    </div>
                    <div className="app-meta">{a.dests} destination{a.dests === 1 ? '' : 's'} · {a.countries} countr{a.countries === 1 ? 'y' : 'ies'}</div>
                  </div>
                  {a.trackers > 0 && <span className="tcount">{a.trackers}</span>}
                </button>
              ))}
            </div>
          </div>

          {s.bursts.length > 0 && (
            <div className="side-block sync-block">
              <h2>ID sharing spotted</h2>
              {s.bursts.slice(0, 3).map((b) => (
                <div key={b.app + b.start} className="sync-row">
                  <div className="tr-name">{b.app}: {b.companies.length} ad{b.identity ? ' and ID' : ''} companies in {b.seconds}s</div>
                  <div className="tr-meta">{b.companies.slice(0, 6).join(', ')}{b.companies.length > 6 ? ` +${b.companies.length - 6}` : ''}</div>
                </div>
              ))}
              <div className="sync-note">When one tracker loads, it often calls others right away so they can match their IDs for you ("cookie syncing"). That's how your profile gets shared between companies. Where they send it after that happens on their servers, out of sight of any PC.</div>
            </div>
          )}

          <div className="side-block">
            <div className="side-head">
              <h2>Trackers spotted</h2>
              {s.trackers.length > 0 && (
                <button className="btn danger sm" disabled={busy} onClick={blockAllTrackers}>Block all ({s.trackers.length})</button>
              )}
            </div>
            {s.trackers.length === 0 ? (
              <div className="muted">None yet. Open a news site in your browser and watch.</div>
            ) : (
              <div className="tracker-list">
                {s.trackers.map((t) => (
                  <div key={t.name} className="tracker-row clickable" onClick={() => {
                    const f = flows.find((x) => !x.local && x.geo && (x.company || x.domain || x.ip) === t.name);
                    if (f) {
                      if (selected && f.app !== selected) setSelected(null);
                      setPicked({ place: placeKey(f.geo), flow: f.key });
                    }
                  }}>
                    <i style={{ background: CATEGORIES[t.category].color }} />
                    <div>
                      <div className="tr-name">{t.name}</div>
                      <div className="tr-meta">{CATEGORIES[t.category].label} · via {t.apps.join(', ')}{t.country ? ` · ${t.country}` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {blocked.length > 0 && (
            <div className="side-block">
              <h2>Blocked by Watchtower</h2>
              <div className="tracker-list">
                {blocked.map((b) => (
                  <div key={b.rule} className="tracker-row">
                    <i style={{ background: (CATEGORIES[b.category] || CATEGORIES.normal).color }} />
                    <div style={{ flex: 1 }}>
                      <div className="tr-name">{b.name}</div>
                      <div className="tr-meta">{b.ips.length} server{b.ips.length === 1 ? '' : 's'} · firewall rule</div>
                    </div>
                    <button className="btn ghost sm" disabled={busy} onClick={() => unblock([b.rule])}>Unblock</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="side-block">
            <h2>Countries</h2>
            <div className="country-list">
              {s.countriesList.slice(0, 8).map((c) => (
                <div key={c.country} className="country-row">
                  <span className="cc">{c.cc}</span>
                  <span className="cn">{c.country}</span>
                  <span className="bar"><i style={{ width: `${(c.n / (s.countriesList[0]?.n || 1)) * 100}%` }} /></span>
                  <b>{c.n}</b>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
