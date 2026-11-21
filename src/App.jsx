import { useCallback, useEffect, useRef, useState } from 'react';
import Watching from './views/Watching.jsx';
import DataMap from './views/DataMap.jsx';
import Ask from './views/Ask.jsx';
import SettingsView from './views/Settings.jsx';
import { EyeIcon, GlobeIcon, SparkIcon, TowerLogo } from './components/Icons.jsx';
import { setNightHours } from './lib/sensors.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { applyAccent } from './lib/theme.js';


const GearIcon = (p) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
);

const NAV = [
  { id: 'watching', label: "Who's Watching", icon: EyeIcon },
  { id: 'map', label: 'Where Data Goes', icon: GlobeIcon },
  { id: 'ask', label: 'Ask Watchtower', icon: SparkIcon },
];

// Polls a main-process scanner without stacking calls
function usePoll(fn, ms) {
  const [data, setData] = useState(null);
  const busy = useRef(false);
  useEffect(() => {
    if (!ms) return undefined;
    let alive = true;
    async function tick() {
      if (busy.current || !window.watchtower) return;
      busy.current = true;
      try {
        const res = await fn();
        if (alive) setData(res);
      } catch (e) {
        if (alive) setData((d) => ({ ...(d || {}), ok: false, error: e.message }));
      } finally {
        busy.current = false;
      }
    }
    tick();
    const id = setInterval(tick, ms);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms]);
  return data;
}

export default function App() {
  const [view, setView] = useState('watching');
  const [now, setNow] = useState(Date.now());
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    window.watchtower?.settings.get().then((s) => {
      setNightHours(s.nightStart, s.nightEnd);
      applyAccent(s.accent);
      setSettings(s);
    });
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);

  const changeSettings = useCallback(async (patch) => {
    const s = await window.watchtower.settings.set(patch);
    setNightHours(s.nightStart, s.nightEnd);
    applyAccent(s.accent);
    setSettings(s);
  }, []);

  const sensors = usePoll(() => window.watchtower.sensors(), settings?.sensorEveryMs);
  const net = usePoll(() => window.watchtower.network(), settings?.networkEveryMs);

  const liveCount = (sensors?.apps || []).filter((a) => a.inUse && a.cap !== 'location').length;
  const trackerCount = new Set((net?.flows || []).filter((f) => f.active && f.category !== 'normal').map((f) => f.company)).size;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <TowerLogo />
          <span>Watchtower</span>
        </div>
        <nav>
          {NAV.map((n) => (
            <button key={n.id} className={`nav-item${view === n.id ? ' active' : ''}`} onClick={() => setView(n.id)}>
              <n.icon />
              <span>{n.label}</span>
              {n.id === 'watching' && liveCount > 0 && <span className="nav-live">{liveCount}</span>}
              {n.id === 'map' && trackerCount > 0 && <span className="nav-live">{trackerCount}</span>}
            </button>
          ))}
        </nav>
        <div className="side-foot-wrap">
          <button className={`nav-item${view === 'settings' ? ' active' : ''}`} onClick={() => setView('settings')}>
            <GearIcon />
            <span>Settings</span>
          </button>
          <div className="side-foot">
            <span className="dot" /> Local-first · no account
          </div>
        </div>
      </aside>
      <main className="main">
        {!window.watchtower && <div className="banner error">Open Watchtower through Electron (npm run dev), not a normal browser.</div>}
        <ErrorBoundary key={view} name={NAV.find((n) => n.id === view)?.label || 'Settings'}>
          {view === 'watching' && <Watching data={sensors} now={now} net={net} />}
          {view === 'map' && <DataMap net={net} settings={settings} />}
          {view === 'ask' && <Ask sensors={sensors} net={net} goSettings={() => setView('settings')} />}
          {view === 'settings' && <SettingsView settings={settings} onChange={changeSettings} />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
