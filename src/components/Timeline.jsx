import { useMemo, useState } from 'react';
import { CAPS, KIND_LABEL, RANGES, fmtDay, fmtDuration, fmtTime, getNight, nightLabel, sessionEnd } from '../lib/sensors.js';
import AppIcon from './AppIcon.jsx';

const HOUR = 3600000;
const DAY = 24 * HOUR;

function ticks(range, start, end) {
  const out = [];
  if (range === '24h') {
    const t = new Date(start);
    t.setMinutes(0, 0, 0);
    let x = t.getTime() + HOUR;
    while (x < end) {
      if (new Date(x).getHours() % 4 === 0) out.push({ t: x, label: new Date(x).toLocaleTimeString([], { hour: 'numeric' }) });
      x += HOUR;
    }
  } else if (range === '7d') {
    for (let x = new Date(start).setHours(24, 0, 0, 0); x < end; x += DAY) out.push({ t: x, label: fmtDay(x, end) });
  } else if (range === '30d') {
    for (let x = new Date(start).setHours(24, 0, 0, 0); x < end; x += DAY) {
      const d = new Date(x);
      if (d.getDay() === 1) out.push({ t: x, label: d.toLocaleDateString([], { month: 'short', day: 'numeric' }) });
    }
  } else {
    const d = new Date(start);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() + 1);
    while (d.getTime() < end) {
      out.push({ t: d.getTime(), label: d.toLocaleDateString([], { month: 'short' }) });
      d.setMonth(d.getMonth() + 1);
    }
  }
  return out;
}

function nights(range, start, end) {
  if (range !== '24h' && range !== '7d') return [];
  const out = [];
  const { start: ns, end: ne } = getNight();
  const len = ((ne - ns + 24) % 24 || 24) * HOUR;
  for (let x = new Date(start).setHours(0, 0, 0, 0) - DAY; x < end; x += DAY) {
    const a = x + ns * HOUR;
    out.push([Math.max(a, start), Math.min(a + len, end)]);
  }
  return out.filter(([a, b]) => b > a);
}

// One row per app + sensor; a bar for every session in the range.
export default function Timeline({ sessions, now, range }) {
  const [hover, setHover] = useState(null);
  const end = now;
  const start = now - RANGES[range].ms;
  const span = end - start;
  const x = (t) => ((Math.min(Math.max(t, start), end) - start) / span) * 100;

  const rows = useMemo(() => {
    const map = new Map();
    for (const s of sessions) {
      if (sessionEnd(s, now) < start) continue;
      const k = `${s.cap}|${s.name}`;
      if (!map.has(k)) map.set(k, { k, cap: s.cap, name: s.name, kind: s.kind, path: s.path, items: [], latest: 0 });
      const r = map.get(k);
      r.items.push(s);
      r.latest = Math.max(r.latest, s.start);
      if (!r.path && s.path) r.path = s.path;
    }
    return [...map.values()].sort((a, b) => b.latest - a.latest).slice(0, 12);
  }, [sessions, now, start]);

  if (!rows.length) {
    return (
      <div className="empty-state">
        <b>Nothing in the last {RANGES[range].label}.</b>
        <span>Try a longer range above, or open the Camera app for a few seconds and watch it appear here.</span>
      </div>
    );
  }

  const tk = ticks(range, start, end);
  const nt = nights(range, start, end);

  return (
    <div className="timeline">
      <div className="tl-row tl-axis">
        <div />
        <div className="tl-track bare">
          {tk.map((t) => (
            <span key={t.t} className="tl-tick" style={{ left: `${x(t.t)}%` }}>{t.label}</span>
          ))}
          <span className="tl-now">Now</span>
        </div>
      </div>
      {rows.map((r) => (
        <div className="tl-row" key={r.k}>
          <div className="tl-label">
            <AppIcon path={r.path} name={r.name} size={24} />
            <span className="tl-name" title={r.name}>{r.name}</span>
            <span className="tl-cap" style={{ color: CAPS[r.cap].color }}>{CAPS[r.cap].short}</span>
          </div>
          <div className="tl-track">
            {nt.map(([a, b]) => (
              <span key={a} className="tl-night" style={{ left: `${x(a)}%`, width: `${x(b) - x(a)}%` }} />
            ))}
            {tk.map((t) => (
              <span key={t.t} className="tl-grid" style={{ left: `${x(t.t)}%` }} />
            ))}
            {r.items.map((s) => {
              const e = sessionEnd(s, now);
              return (
                <span
                  key={s.start}
                  className={`tl-bar${s.stop ? '' : ' live'}`}
                  style={{ left: `${x(s.start)}%`, width: `max(5px, ${x(e) - x(s.start)}%)`, '--c': CAPS[s.cap].color }}
                  onMouseEnter={(ev) => setHover({ s, x: ev.clientX, y: ev.clientY })}
                  onMouseMove={(ev) => setHover({ s, x: ev.clientX, y: ev.clientY })}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}
          </div>
        </div>
      ))}
      <div className="tl-legend">
        {(range === '24h' || range === '7d') && <span><i className="sw night" /> Night ({nightLabel()})</span>}
        {Object.entries(CAPS).map(([k, c]) => (
          <span key={k}><i className="sw" style={{ background: c.color }} /> {c.label}</span>
        ))}
      </div>
      {hover && (
        <div
          className="tooltip"
          style={{
            // Flip to the left/up near the window edges so it never gets squashed
            left: hover.x + 260 > window.innerWidth ? hover.x - 254 : hover.x + 14,
            top: hover.y + 120 > window.innerHeight ? hover.y - 110 : hover.y + 14,
          }}
        >
          <b>{hover.s.name}{KIND_LABEL[hover.s.kind] ? ` · ${KIND_LABEL[hover.s.kind]}` : ''}</b>
          <span style={{ color: CAPS[hover.s.cap].color }}>{CAPS[hover.s.cap].label}</span>
          <span>
            {fmtDay(hover.s.start, now)} · {fmtTime(hover.s.start)}
            {!hover.s.stop ? ' → now' : fmtTime(hover.s.stop) !== fmtTime(hover.s.start) ? ` → ${fmtTime(hover.s.stop)}` : ''}
          </span>
          <span>{fmtDuration(sessionEnd(hover.s, now) - hover.s.start)}</span>
        </div>
      )}
    </div>
  );
}
