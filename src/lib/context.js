// Turns what Watchtower has seen into compact text for Gemini (Ask Watchtower).
import { CAPS, findings, fmtDuration, isNight, nightLabel, sessionEnd } from './sensors.js';
import { summarizeFlows } from './network.js';

const DAY = 86400000;

const stamp = (ms) =>
  new Date(ms).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function buildContext(sensors, net) {
  const now = Date.now();
  const lines = [];
  const sessions = sensors?.sessions || [];
  const apps = sensors?.apps || [];

  lines.push(`== Sensors (microphone, camera, location) ==`);
  lines.push(`Source: Windows' own privacy log plus Watchtower's recording. Night hours are ${nightLabel()}.`);
  const live = apps.filter((a) => a.inUse);
  lines.push(live.length ? `In use RIGHT NOW: ${live.map((a) => `${a.name} (${CAPS[a.cap].noun})`).join(', ')}` : 'Nothing is using the mic, camera or location right now.');

  const recent = sessions.filter((s) => s.start > now - 30 * DAY).sort((a, b) => b.start - a.start).slice(0, 120);
  lines.push(`Sessions in the last 30 days (newest first, ${recent.length} shown):`);
  for (const s of recent) {
    const tags = [s.kind === 'background' ? 'background program' : s.kind === 'system' ? 'part of Windows' : null, isNight(s.start) ? 'NIGHT' : null].filter(Boolean);
    lines.push(`- ${stamp(s.start)}, ${fmtDuration(sessionEnd(s, now) - s.start)} | ${CAPS[s.cap].noun} | ${s.name}${tags.length ? ` [${tags.join(', ')}]` : ''}${s.stop ? '' : ' (still in use)'}`);
  }

  const byCap = {};
  for (const a of apps) if (a.start) (byCap[a.cap] ||= []).push(a);
  for (const [cap, list] of Object.entries(byCap)) {
    list.sort((x, y) => y.start - x.start);
    lines.push(`All apps that ever used the ${CAPS[cap].noun} (last use): ${list.slice(0, 25).map((a) => `${a.name} (${stamp(a.start)})`).join('; ')}`);
  }

  const f = findings(sessions, apps, now, '30d');
  if (f.length) {
    lines.push(`Watchtower's flags (last 30 days):`);
    for (const x of f) lines.push(`- ${x.title}. ${x.detail}`);
  }

  lines.push('');
  lines.push(`== Internet connections (since Watchtower opened) ==`);
  const flows = net?.flows || [];
  if (!flows.length) lines.push('No connection data yet.');
  else {
    const s = summarizeFlows(flows, null);
    lines.push(`${s.active} live connections; ${s.companies} companies; ${s.countries} countries; ${s.trackerCount} trackers spotted.`);
    for (const a of s.apps.slice(0, 15)) {
      const companies = [...new Set(flows.filter((x) => x.app === a.app).map((x) => x.company || x.domain || x.ip))].slice(0, 8);
      lines.push(`- ${a.app}${a.kind === 'system' ? ' (Windows)' : a.kind === 'background' ? ' (background)' : ''}: ${a.dests} destinations in ${a.countries} countries, ${a.trackers} trackers. Talks to: ${companies.join(', ')}`);
    }
    if (s.identityCount) lines.push(`ID trackers / data brokers seen: ${s.identityCount}.`);
    for (const b of s.bursts) lines.push(`Likely cookie syncing: ${b.app} connected to ${b.companies.length} ad/ID companies within ${b.seconds}s: ${b.companies.join(', ')}`);
    if (s.trackers.length) {
      lines.push('Trackers:');
      for (const t of s.trackers.slice(0, 20)) lines.push(`- ${t.name} (${t.category}) via ${t.apps.join(', ')}${t.country ? `, server in ${t.country}` : ''}`);
    }
    lines.push(`Countries: ${s.countriesList.map((c) => `${c.country} (${c.n})`).join(', ')}`);
    const insecure = flows.filter((x) => x.port === 80);
    if (insecure.length) lines.push(`Unencrypted (HTTP, port 80) connections: ${[...new Set(insecure.map((x) => `${x.app} → ${x.company || x.domain || x.ip}`))].slice(0, 10).join('; ')}`);
  }

  return { nowLocal: stamp(now), text: lines.join('\n') };
}
