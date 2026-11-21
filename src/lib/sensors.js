export const CAPS = {
  microphone: { label: 'Microphone', short: 'Mic', noun: 'microphone', color: 'var(--mic)' },
  webcam: { label: 'Camera', short: 'Camera', noun: 'camera', color: 'var(--cam)' },
  location: { label: 'Location', short: 'Location', noun: 'location', color: 'var(--loc)' },
};
export const CAP_ORDER = ['microphone', 'webcam', 'location'];

const HOUR = 3600000;
const DAY = 24 * HOUR;

export const RANGES = {
  '24h': { label: '24 hours', ms: DAY },
  '7d': { label: '7 days', ms: 7 * DAY },
  '30d': { label: '30 days', ms: 30 * DAY },
  '1y': { label: '12 months', ms: 365 * DAY },
};

export function fmtTime(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function fmtDay(ms, now = Date.now()) {
  const d = new Date(ms);
  const today = new Date(now).setHours(0, 0, 0, 0);
  const diff = Math.round((today - new Date(ms).setHours(0, 0, 0, 0)) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString([], { weekday: diff < 7 ? 'short' : undefined, month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' });
}

export function fmtDuration(ms) {
  if (ms < 0) ms = 0;
  const s = Math.round(ms / 1000);
  if (s < 1) return 'a moment';
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function fmtAgo(ms, now = Date.now()) {
  const d = now - ms;
  if (d < 45000) return 'just now';
  if (d < HOUR) return `${Math.round(d / 60000)} min ago`;
  if (d < DAY) return `${Math.round(d / HOUR)} h ago`;
  const days = Math.round(d / DAY);
  if (days < 60) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  return months < 18 ? `${months} months ago` : `${Math.round(days / 365)} years ago`;
}

// Night hours come from Settings (default midnight to 5 AM)
let NIGHT = { start: 0, end: 5 };
export function setNightHours(start, end) {
  NIGHT = { start, end };
}
export const getNight = () => NIGHT;
export function nightLabel() {
  const f = (h) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' });
  return `${f(NIGHT.start)}–${f(NIGHT.end)}`;
}
export const isNight = (ms) => {
  const h = new Date(ms).getHours();
  return NIGHT.start <= NIGHT.end ? h >= NIGHT.start && h < NIGHT.end : h >= NIGHT.start || h < NIGHT.end;
};
export const sessionEnd = (s, now) => (s.stop && s.stop >= s.start ? s.stop : now);
export const inRange = (s, now, range) => sessionEnd(s, now) >= now - RANGES[range].ms;
export const KIND_LABEL = { system: 'Windows', background: 'Background', app: '' };

// Summary numbers + a transparent privacy score
export function summarize(sessions, apps, now, range) {
  const recent = sessions.filter((s) => inRange(s, now, range));
  const appKeys = new Set(recent.map((s) => s.name));
  const night = recent.filter((s) => s.cap !== 'location' && isNight(s.start));
  const background = new Set(recent.filter((s) => s.kind === 'background').map((s) => s.name));
  const camMic = new Set(recent.filter((s) => s.cap !== 'location').map((s) => s.name));
  const live = apps.filter((a) => a.inUse && a.cap !== 'location');

  const factors = [
    { label: 'Mic or camera used at night', count: night.length, cost: Math.min(30, night.length * 10) },
    { label: 'Background programs on a sensor', count: background.size, cost: Math.min(24, background.size * 6) },
    { label: 'Apps that used your mic or camera', count: camMic.size, cost: Math.min(20, camMic.size * 2) },
    { label: 'Mic or camera in use right now', count: live.length, cost: live.length ? 10 : 0 },
  ];
  const score = Math.max(0, 100 - factors.reduce((t, f) => t + f.cost, 0));
  return { recent, apps: appKeys.size, night: night.length, background: background.size, factors, score };
}

export function findings(sessions, apps, now, range) {
  const out = [];
  const recent = sessions.filter((s) => inRange(s, now, range));

  for (const a of apps) {
    if (!a.inUse) continue;
    out.push({
      id: `live-${a.key}`, level: 'live', cap: a.cap, name: a.name, path: a.path,
      title: `${a.name} is using your ${CAPS[a.cap].noun} right now`,
      detail: `Started ${fmtTime(a.start)}, ${fmtDuration(now - a.start)} so far.`,
    });
  }

  for (const s of recent) {
    if (s.cap === 'location' || !isNight(s.start)) continue;
    out.push({
      id: `night-${s.key}-${s.start}`, level: 'warn', cap: s.cap, name: s.name, path: s.path, night: true,
      title: `${s.name} used your ${CAPS[s.cap].noun} at ${fmtTime(s.start)}`,
      detail: `${fmtDay(s.start, now)}, for ${fmtDuration(sessionEnd(s, now) - s.start)}. That's the middle of the night.`,
    });
  }

  const seenBg = new Set();
  for (const s of recent) {
    if (s.kind !== 'background' || seenBg.has(s.key)) continue;
    seenBg.add(s.key);
    out.push({
      id: `bg-${s.key}`, level: 'warn', cap: s.cap, name: s.name, path: s.path,
      title: `${s.name} accessed your ${CAPS[s.cap].noun} in the background`,
      detail: `A helper program, not an app you opened. Last time: ${fmtDay(s.start, now)} at ${fmtTime(s.start)}.`,
    });
  }

  const counts = new Map();
  for (const s of recent) {
    if (s.cap === 'location') continue;
    const k = `${s.cap}|${s.name}`;
    counts.set(k, (counts.get(k) || { n: 0, s }));
    counts.get(k).n += 1;
  }
  const top = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  if (top && top.n >= 3) {
    out.push({
      id: `top-${top.s.key}`, level: 'info', cap: top.s.cap, name: top.s.name, path: top.s.path,
      title: `${top.s.name} used your ${CAPS[top.s.cap].noun} ${top.n} times`,
      detail: `The most of any app in the last ${RANGES[range].label}.`,
    });
  }

  for (const s of recent) {
    if (s.cap === 'location' || !s.stop) continue;
    const dur = s.stop - s.start;
    if (dur > 2 * HOUR) {
      out.push({
        id: `long-${s.key}-${s.start}`, level: 'info', cap: s.cap, name: s.name, path: s.path,
        title: `${s.name} kept your ${CAPS[s.cap].noun} on for ${fmtDuration(dur)}`,
        detail: `${fmtDay(s.start, now)}, ${fmtTime(s.start)} to ${fmtTime(s.stop)}.`,
      });
    }
  }

  const rank = { live: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]).slice(0, 6);
}
