import { useEffect, useState } from 'react';
import { KeyForm } from '../components/AiExplain.jsx';
import { ACCENTS } from '../lib/theme.js';

const SENSOR_SPEEDS = [
  [5000, 'Fast (5s)'],
  [8000, 'Normal (8s)'],
  [15000, 'Relaxed (15s)'],
  [30000, 'Battery saver (30s)'],
];
const NET_SPEEDS = [
  [2000, 'Fast (2s)'],
  [4000, 'Normal (4s)'],
  [8000, 'Relaxed (8s)'],
  [15000, 'Battery saver (15s)'],
];
const HOURS = Array.from({ length: 24 }, (_, h) => [h, new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' })]);

function Row({ title, desc, children }) {
  return (
    <div className="set-row">
      <div className="set-text">
        <div className="set-title">{title}</div>
        {desc && <div className="set-desc">{desc}</div>}
      </div>
      <div className="set-control">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button className={`toggle${on ? ' on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <i />
    </button>
  );
}

function Select({ value, options, onChange }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {options.map(([v, label]) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  );
}

export default function SettingsView({ settings, onChange }) {
  const [ai, setAi] = useState(null);
  const [test, setTest] = useState(null);
  const [cleared, setCleared] = useState(false);
  const refreshAi = () => window.watchtower.ai.status().then(setAi);
  useEffect(() => {
    refreshAi();
  }, []);

  if (!settings) return null;
  const set = (patch) => onChange(patch);

  async function runTest() {
    setTest({ status: 'running' });
    const r = await window.watchtower.ai.test();
    setTest(r.ok ? { status: 'ok', text: `Connected (${r.model})` } : { status: 'err', text: r.error });
    refreshAi();
  }

  async function clearData() {
    if (!window.confirm('Clear Watchtower\'s saved sensor history and connection data? Windows\' own log is not touched.')) return;
    await window.watchtower.settings.clearData();
    setCleared(true);
  }

  return (
    <div className="view settings-view">
      <header>
        <div className="eyebrow">Settings</div>
        <h1 className="title">Make Watchtower yours.</h1>
      </header>

      <section className="panel">
        <h2>Appearance</h2>
        <Row title="Globe style" desc="Performance is fast and stylized. Quality shows the real Earth, lit by where the sun is right now, with city lights at night and shimmering oceans.">
          <div className="seg">
            <button className={settings.globeQuality === 'performance' ? 'on' : ''} onClick={() => set({ globeQuality: 'performance' })}>Performance</button>
            <button className={settings.globeQuality === 'quality' ? 'on' : ''} onClick={() => set({ globeQuality: 'quality' })}>Quality</button>
          </div>
        </Row>
        {settings.globeQuality === 'quality' && (
          <Row title="Live clouds" desc="Downloads today's real cloud cover (updated every 3 hours). If it can't be reached, built-in clouds are used.">
            <Toggle on={settings.liveClouds} onChange={(v) => set({ liveClouds: v })} />
          </Row>
        )}
        <Row title="Spin the globe" desc="Slow automatic rotation on the map.">
          <Toggle on={settings.spin} onChange={(v) => set({ spin: v })} />
        </Row>
        <Row title="Accent color">
          <div className="swatches">
            {Object.entries(ACCENTS).map(([name, [a, b]]) => (
              <button
                key={name}
                className={`swatch${settings.accent === name ? ' on' : ''}`}
                style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
                onClick={() => set({ accent: name })}
                title={name}
                aria-label={`${name} accent`}
              />
            ))}
          </div>
        </Row>
      </section>

      <section className="panel">
        <h2>Gemini AI</h2>
        <Row title="AI explanations" desc="Gemini explains connections on the map and answers questions in Ask Watchtower. Only the details shown in the app are sent, never your files.">
          <Toggle on={settings.aiEnabled} onChange={(v) => set({ aiEnabled: v })} />
        </Row>
        <Row
          title="API key"
          desc={ai?.hasKey ? `✓ Key saved, ${ai.source}. It ends in ${ai.keyHint}, shown only so you can tell which key it is.` : 'No key yet. Get a free one at aistudio.google.com → Get API key.'}
        >
          {ai?.hasKey ? (
            <div className="set-btns">
              <button className="btn" onClick={runTest} disabled={test?.status === 'running'}>{test?.status === 'running' ? 'Testing…' : 'Test connection'}</button>
              {ai.source === 'stored on this PC' && (
                <button className="btn ghost" onClick={async () => { await window.watchtower.ai.removeKey(); setTest(null); refreshAi(); }}>Remove</button>
              )}
            </div>
          ) : null}
        </Row>
        {!ai?.hasKey && <div className="set-wide"><KeyForm onSaved={refreshAi} /></div>}
        {test && test.status !== 'running' && <div className={`set-result ${test.status}`}>{test.text}</div>}
      </section>

      <section className="panel">
        <h2>Scanning</h2>
        <Row title="Sensor check" desc="How often Watchtower reads Windows' mic, camera and location log.">
          <Select value={settings.sensorEveryMs} options={SENSOR_SPEEDS} onChange={(v) => set({ sensorEveryMs: v })} />
        </Row>
        <Row title="Connection check" desc="How often the globe refreshes live connections. Faster feels more live, slower uses less CPU.">
          <Select value={settings.networkEveryMs} options={NET_SPEEDS} onChange={(v) => set({ networkEveryMs: v })} />
        </Row>
        <Row title="Night hours" desc="Mic or camera use in this window gets flagged as night activity.">
          <div className="set-btns">
            <Select value={settings.nightStart} options={HOURS} onChange={(v) => set({ nightStart: v })} />
            <span className="muted">to</span>
            <Select value={settings.nightEnd} options={HOURS} onChange={(v) => set({ nightEnd: v })} />
          </div>
        </Row>
      </section>

      <section className="panel">
        <h2>Privacy</h2>
        <Row title="Place servers on the map" desc="Sends server IP addresses (never your data) to ip-api.com to find their country and city. Turn off to keep everything on this PC; the globe will be empty, but the lists still work.">
          <Toggle on={settings.geoLookups} onChange={(v) => set({ geoLookups: v })} />
        </Row>
        <Row title="Clear Watchtower's data" desc={cleared ? 'Cleared. History will rebuild from Windows\' log on the next scan.' : 'Deletes the saved sensor history, location cache and connection list.'}>
          <button className="btn danger" onClick={clearData}>Clear data</button>
        </Row>
        <div className="set-foot">Data folder: {settings.dataDir}</div>
      </section>
    </div>
  );
}
