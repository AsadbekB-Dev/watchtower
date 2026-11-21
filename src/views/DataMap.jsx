import { useEffect, useMemo, useState } from 'react';
import DataGlobe from '../components/DataGlobe.jsx';
import AppIcon from '../components/AppIcon.jsx';
import AiExplain from '../components/AiExplain.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import { CATEGORIES, CATEGORY_INFO, fmtSpan, placeDetails, placeKey, portInfo, summarizeFlows } from '../lib/network.js';
import { KIND_LABEL } from '../lib/sensors.js';

function ago(ms) {
  const d = Date.now() - ms;
  if (d < 60000) return 'just now';
  return `${Math.round(d / 60000)} min ago`;
}

function PlacePanel({ details, picked, onClose }) {
  if (!details) return null;
  const groups = [...details.groups].sort((a, b) => {
    const pa = picked.flow && a.keys.includes(picked.flow) ? -1 : 0;
    const pb = picked.flow && b.keys.includes(picked.flow) ? -1 : 0;
    return pa - pb || (a.category === 'normal') - (b.category === 'normal');
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
  const flows = net?.flows || [];
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
            {s.trackerCount > 0 && <>, including <span className="t-live">{s.trackerCount} trackers</span></>}.
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
          {picked && details && <PlacePanel details={details} picked={picked} onClose={() => setPicked(null)} />}
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

          <div className="side-block">
            <h2>Trackers spotted</h2>
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
