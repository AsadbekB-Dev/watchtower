export const CATEGORIES = {
  ads: { label: 'Ad tracker', color: '#f43f5e' },
  analytics: { label: 'Analytics', color: '#fbbf24' },
  social: { label: 'Social tracker', color: '#a78bfa' },
  telemetry: { label: 'Telemetry', color: '#fb923c' },
  normal: { label: 'Normal', color: '#5eead4' },
};

export const CATEGORY_INFO = {
  ads: 'Ad companies follow what you view so they can target ads at you.',
  analytics: 'Measures how you use an app or website: clicks, time spent, what you looked at.',
  social: 'Social networks can recognize you across other sites and apps.',
  telemetry: 'The app (or Windows) reporting usage and diagnostics back to its maker.',
  normal: 'Regular traffic the app needs to work.',
};

const PORTS = {
  443: { label: 'HTTPS', secure: true }, 80: { label: 'HTTP', secure: false }, 853: { label: 'DNS over TLS', secure: true },
  993: { label: 'Email (IMAP, encrypted)', secure: true }, 995: { label: 'Email (POP, encrypted)', secure: true }, 587: { label: 'Email sending', secure: true },
  5223: { label: 'Apple push', secure: true }, 5228: { label: 'Google push notifications', secure: true }, 5222: { label: 'Chat (XMPP)', secure: null },
  3478: { label: 'Voice/video relay', secure: true }, 19302: { label: 'Google voice/video', secure: true }, 27015: { label: 'Steam game server', secure: null },
  3074: { label: 'Xbox Live', secure: null }, 6881: { label: 'BitTorrent', secure: false }, 22: { label: 'SSH', secure: true }, 21: { label: 'FTP', secure: false },
  8080: { label: 'Web (alt port)', secure: false }, 8443: { label: 'HTTPS (alt port)', secure: true },
};

export function portInfo(port) {
  if (PORTS[port]) return PORTS[port];
  if (port >= 50000) return { label: 'Voice, video or game traffic', secure: null };
  return { label: `Port ${port}`, secure: null };
}

export function fmtSpan(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return 'under a minute';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export const placeKey = (geo) => `${geo.lat.toFixed(1)},${geo.lon.toFixed(1)}`;

// Everything at one map location, grouped by company
export function placeDetails(flows, place, filterApp) {
  const here = flows.filter((f) => !f.local && f.geo && placeKey(f.geo) === place && (!filterApp || f.app === filterApp));
  if (!here.length) return null;
  const groups = new Map();
  for (const f of here) {
    const k = f.company || f.domain || f.ip;
    const g = groups.get(k) || { name: k, category: f.category, domains: new Set(), apps: new Map(), ips: new Set(), ports: new Set(), active: false, firstSeen: Infinity, lastSeen: 0, keys: new Set(), network: f.geo.network || f.geo.isp };
    if (f.domain) g.domains.add(f.domain);
    g.apps.set(f.app, f.path);
    g.ips.add(f.ip);
    g.ports.add(f.port);
    g.firstSeen = Math.min(g.firstSeen, f.firstSeen);
    g.keys.add(f.key);
    if (f.active) g.active = true;
    g.lastSeen = Math.max(g.lastSeen, f.lastSeen);
    if (f.category !== 'normal') g.category = f.category;
    groups.set(k, g);
  }
  const g0 = here[0].geo;
  return {
    city: g0.city, country: g0.country, cc: g0.cc, network: g0.network || g0.isp,
    count: here.length,
    apps: new Set(here.map((f) => f.app)).size,
    groups: [...groups.values()].map((g) => ({ ...g, domains: [...g.domains], apps: [...g.apps.entries()], ips: [...g.ips], ports: [...g.ports], keys: [...g.keys] })),
  };
}

export const isTracker = (f) => f.category !== 'normal';

export function summarizeFlows(flows, filterApp) {
  const remote = flows.filter((f) => !f.local && (!filterApp || f.app === filterApp));
  const active = remote.filter((f) => f.active);
  const countries = new Set(remote.map((f) => f.geo && f.geo.country).filter(Boolean));
  const companies = new Set(remote.map((f) => f.company).filter(Boolean));
  const trackerCompanies = new Set(remote.filter(isTracker).map((f) => f.company || f.domain || f.ip));

  // Apps
  const apps = new Map();
  for (const f of flows) {
    if (f.local) continue;
    const a = apps.get(f.app) || { app: f.app, path: f.path, kind: f.kind, dests: new Set(), trackers: new Set(), countries: new Set(), active: false };
    a.dests.add(f.company || f.domain || f.ip);
    if (isTracker(f)) a.trackers.add(f.company || f.domain || f.ip);
    if (f.geo && f.geo.country) a.countries.add(f.geo.country);
    if (f.active) a.active = true;
    if (!a.path && f.path) a.path = f.path;
    apps.set(f.app, a);
  }
  const appList = [...apps.values()]
    .map((a) => ({ ...a, dests: a.dests.size, trackers: a.trackers.size, countries: a.countries.size }))
    .sort((x, y) => y.trackers - x.trackers || y.dests - x.dests);

  // Trackers by company
  const tr = new Map();
  for (const f of remote.filter(isTracker)) {
    const k = f.company || f.domain || f.ip;
    const t = tr.get(k) || { name: k, category: f.category, apps: new Set(), country: f.geo && f.geo.country, cc: f.geo && f.geo.cc, domain: f.domain };
    t.apps.add(f.app);
    tr.set(k, t);
  }
  const trackers = [...tr.values()].map((t) => ({ ...t, apps: [...t.apps] }));

  // Destinations by country
  const byCountry = new Map();
  for (const f of remote) {
    if (!f.geo) continue;
    const c = byCountry.get(f.geo.country) || { country: f.geo.country, cc: f.geo.cc, n: 0, trackers: 0 };
    c.n += 1;
    if (isTracker(f)) c.trackers += 1;
    byCountry.set(f.geo.country, c);
  }
  const countriesList = [...byCountry.values()].sort((a, b) => b.n - a.n);

  return { remote, active: active.length, countries: countries.size, companies: companies.size, trackerCount: trackerCompanies.size, apps: appList, trackers, countriesList };
}
