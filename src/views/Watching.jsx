import { useMemo, useState } from 'react';
import { CAPS, CAP_ORDER, KIND_LABEL, RANGES, findings, fmtAgo, fmtDay, fmtDuration, fmtTime, inRange, isNight, sessionEnd, summarize } from '../lib/sensors.js';
import { ArrowIcon, MoonIcon, capIcon } from '../components/Icons.jsx';
import AppIcon from '../components/AppIcon.jsx';
import Timeline from '../components/Timeline.jsx';

function ScoreRing({ score }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const tone = score >= 80 ? 'var(--brand)' : score >= 55 ? 'var(--warn)' : 'var(--live)';
  const word = score >= 80 ? 'Looking good' : score >= 55 ? 'Worth a look' : 'Exposed';
  return (
    <div className="score">
      <svg width="104" height="104" viewBox="0 0 104 104">
        <circle cx="52" cy="52" r={r} stroke="rgba(255,255,255,.07)" strokeWidth="8" fill="none" />
        <circle
          cx="52" cy="52" r={r} stroke={tone} strokeWidth="8" fill="none" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 52 52)"
          style={{ transition: 'stroke-dasharray .8s ease', filter: `drop-shadow(0 0 6px ${tone})` }}
        />
      </svg>
      <div className="score-num">
        <b>{score}</b>
        <span>/ 100</span>
      </div>
      <div className="score-word" style={{ color: tone }}>{word}</div>
    </div>
  );
}

function Hero({ summary, range, setRange }) {
  const { apps, night, background, factors, score } = summary;
  return (
    <section className="hero">
      <div className="hero-text">
        <div className="eyebrow">Last {RANGES[range].label} · from Windows' own privacy log</div>
        <h1>
          {apps === 0 ? (
            <>No app touched your mic, camera or location.</>
          ) : (
            <>
              <span className="grad">{apps} app{apps === 1 ? '' : 's'}</span> used your microphone, camera or location.
            </>
          )}
        </h1>
        <p className="hero-sub">
          {night > 0 ? <><b className="t-warn">{night}</b> at night · </> : <>None at night · </>}
          {background > 0 ? <><b className="t-warn">{background}</b> background program{background === 1 ? '' : 's'}</> : <>no background programs</>}

        </p>
        <div className="seg">
          {Object.entries(RANGES).map(([k, v]) => (
            <button key={k} className={k === range ? 'on' : ''} onClick={() => setRange(k)}>{v.label}</button>
          ))}
        </div>
      </div>
      <div className="hero-score">
        <ScoreRing score={score} />
        <ul className="factors">
          {factors.map((f) => (
            <li key={f.label} className={f.cost ? 'hit' : ''}>
              <span>{f.label}</span>
              <b>{f.count}</b>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SensorCard({ cap, apps, recent, settings, now }) {
  const meta = CAPS[cap];
  const live = apps.filter((a) => a.cap === cap && a.inUse);
  const ever = apps.filter((a) => a.cap === cap && a.start).sort((a, b) => b.start - a.start);
  const last = ever[0];
  const users = [];
  for (const s of recent) if (s.cap === cap && !users.find((u) => u.name === s.name)) users.push(s);
  const access = apps.filter((a) => a.cap === cap && a.allowed).length;
  const setting = settings[`user:${cap}`] || settings[`machine:${cap}`];
  const off = setting === 'Deny';

  return (
    <div className={`sensor-card${live.length ? ' is-live' : ''}`} style={{ '--c': meta.color }}>
      <div className="sc-top">
        <span className="sc-icon">{capIcon(cap, { width: 20, height: 20 })}</span>
        <span className="sc-label">{meta.label}</span>
        <span className={`chip ${off ? 'chip-off' : 'chip-on'}`}>{off ? 'Blocked' : 'On'}</span>
      </div>

      <div className="sc-big">
        <b>{users.length}</b>
        <span>app{users.length === 1 ? '' : 's'} used it</span>
      </div>

      {live.length ? (
        <div className="sc-status live">
          <span className="pulse" /> <span>In use now by <b>{live.map((a) => a.name).join(', ')}</b></span>
        </div>
      ) : (
        <div className="sc-status">
          <span>{last ? <>Last: <b>{last.name}</b>, {fmtAgo(sessionEnd(last, now), now)}</> : 'Never used on this PC'}</span>
        </div>
      )}

      <div className="sc-foot">
        <div className="stack">
          {users.slice(0, 5).map((u) => (
            <span key={u.name} title={u.name}><AppIcon path={u.path} name={u.name} size={26} /></span>
          ))}
          {users.length > 5 && <span className="more">+{users.length - 5}</span>}
          {users.length === 0 && <span className="muted">{access} apps have access</span>}
        </div>
        <button className="link" onClick={() => window.watchtower?.openPrivacySettings(cap)}>
          Manage <ArrowIcon width={13} height={13} />
        </button>
      </div>
    </div>
  );
}

export default function Watching({ data, now }) {
  const [range, setRange] = useState('30d');
  const apps = data?.apps || [];
  const sessions = data?.sessions || [];
  const settings = data?.settings || {};

  const summary = useMemo(() => summarize(sessions, apps, now, range), [sessions, apps, now, range]);
  const items = useMemo(() => findings(sessions, apps, now, range), [sessions, apps, now, range]);
  const feed = sessions.filter((s) => inRange(s, now, range)).slice(0, 50);

  if (!data) {
    return (
      <div className="view">
        <div className="loading"><span className="pulse small" /> Reading Windows' privacy log…</div>
      </div>
    );
  }

  return (
    <div className="view">
      {data.sample && <div className="banner">Demo mode: showing a saved log, not this machine's live data.</div>}
      {!data.ok && <div className="banner error">Couldn't read the Windows log: {data.error}</div>}

      <Hero summary={summary} range={range} setRange={setRange} />

      <section className="sensor-grid">
        {CAP_ORDER.map((cap) => (
          <SensorCard key={cap} cap={cap} apps={apps} recent={summary.recent} settings={settings} now={now} />
        ))}
      </section>

      {items.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Worth a look</h2></div>
          <div className="findings">
            {items.map((f) => (
              <div key={f.id} className={`finding ${f.level}`} style={{ '--c': CAPS[f.cap].color }}>
                <AppIcon path={f.path} name={f.name} size={32} />
                <div>
                  <div className="f-title">{f.title}</div>
                  <div className="f-detail">{f.detail}</div>
                </div>
                {f.night && <MoonIcon className="f-badge" />}
                {f.level === 'live' && <span className="pulse" />}
                {(f.level === 'warn' || f.level === 'live') && (
                  <button className="btn ghost sm f-action" title={`Open Windows ${CAPS[f.cap].label.toLowerCase()} permissions`} onClick={() => window.watchtower?.openPrivacySettings(f.cap)}>
                    Review
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-head"><h2>Timeline</h2><span className="muted">Hover a bar for details</span></div>
        <Timeline sessions={sessions} now={now} range={range} />
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Activity</h2><span className="muted">{summary.recent.length} sessions</span></div>
        {feed.length === 0 ? (
          <div className="empty-state"><b>No activity in this range.</b><span>Pick a longer range above.</span></div>
        ) : (
          <div className="feed">
            {feed.map((s) => {
              const live = !s.stop;
              return (
                <div key={`${s.key}-${s.start}`} className="feed-row">
                  <AppIcon path={s.path} name={s.name} />
                  <div className="feed-main">
                    <div className="feed-name">
                      {s.name}
                      {KIND_LABEL[s.kind] && <span className={`kind kind-${s.kind}`}>{KIND_LABEL[s.kind]}</span>}
                    </div>
                    <div className="feed-when">
                      {fmtDay(s.start, now)} · {fmtTime(s.start)}
                      {live ? ' → now' : fmtTime(s.stop) !== fmtTime(s.start) ? ` → ${fmtTime(s.stop)}` : ''} · {fmtDuration(sessionEnd(s, now) - s.start)}
                    </div>
                  </div>
                  {isNight(s.start) && s.cap !== 'location' && <span className="chip chip-night"><MoonIcon width={12} height={12} /> Night</span>}
                  {live && <span className="chip chip-live">In use</span>}
                  <span className="chip cap-chip" style={{ '--c': CAPS[s.cap].color }}>
                    {capIcon(s.cap, { width: 13, height: 13 })} {CAPS[s.cap].label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
