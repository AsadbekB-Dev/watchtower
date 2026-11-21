// Live connections -> app, domain, company, category, country, coordinates.
// Fast path every few seconds: netstat + tasklist (native, ~100 ms).
// Slow path every ~20 s: PowerShell for exe paths (icons) and the DNS cache.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { runPowerShell, parse } = require('./sensors.cjs');
const { identify } = require('./names.cjs');
const { classify } = require('./trackers.cjs');

const PROCINFO = path.join(__dirname, 'scripts', 'procinfo.ps1');
const FALLBACK = path.join(__dirname, 'scripts', 'connections.ps1');
const GEO_FIELDS = 'status,message,country,countryCode,city,lat,lon,isp,org,as,query';
const SLOW_EVERY_MS = 20000;

function run(cmd, args, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true, timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

function isPrivate(ip) {
  if (ip.includes(':')) return /^(fc|fd|fe80|::1|::$)/i.test(ip) || ip === '::';
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254);
}

// "  TCP    192.168.1.5:51234    142.250.72.14:443    ESTABLISHED    1234"
function parseNetstat(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.trim().split(/\s+/);
    if (m.length < 5 || m[0] !== 'TCP' || m[3] !== 'ESTABLISHED') continue;
    const foreign = m[2];
    const i = foreign.lastIndexOf(':');
    let ip = foreign.slice(0, i).replace(/^\[|\]$/g, '');
    ip = ip.replace(/^::ffff:/i, '').replace(/%.*$/, '');
    const port = Number(foreign.slice(i + 1));
    const pid = Number(m[4]);
    if (!ip || isPrivate(ip)) continue;
    out.push({ ip, port, pid });
  }
  return out;
}

// "\"chrome.exe\",\"1234\",\"Console\",\"1\",\"120,000 K\""
function parseTasklist(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^"([^"]+)","(\d+)"/);
    if (m) map.set(Number(m[2]), m[1]);
  }
  return map;
}

// "AS13335 Cloudflare, Inc." -> "Cloudflare, Inc."
function networkName(geo) {
  if (!geo) return null;
  const as = String(geo.as || '').replace(/^AS\d+\s*/, '').trim();
  return as || geo.isp || null;
}

class Network {
  constructor(dataDir) {
    this.cacheFile = path.join(dataDir, 'geo-cache.json');
    this.geo = new Map();
    this.flows = new Map();
    this.domains = new Map(); // ip -> domain, kept after the DNS cache entry expires
    this.procs = new Map(); // pid -> { path, desc }
    this.home = null;
    this.lastGeoCall = 0;
    this.lastSlow = 0;
    this.slowRunning = null;
    this.geoEnabled = true;
    try {
      const saved = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
      if (saved.version === 2) {
        for (const [ip, g] of Object.entries(saved.geo || {})) this.geo.set(ip, g);
        this.home = saved.home || null;
      }
    } catch {
      /* first run */
    }
  }

  saveCache() {
    try {
      fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
      const geo = Object.fromEntries([...this.geo.entries()].slice(-5000));
      fs.writeFileSync(this.cacheFile, JSON.stringify({ version: 2, home: this.home, geo }));
    } catch (e) {
      console.error('[watchtower] geo cache save failed:', e.message);
    }
  }

  slowRefresh() {
    if (this.slowRunning) return this.slowRunning;
    this.slowRunning = runPowerShell(PROCINFO, 20000)
      .then((out) => {
        const raw = parse(out);
        const procs = Array.isArray(raw.procs) ? raw.procs : raw.procs ? [raw.procs] : [];
        const dns = Array.isArray(raw.dns) ? raw.dns : raw.dns ? [raw.dns] : [];
        this.procs = new Map(procs.map((p) => [Number(p.pid), { path: p.path, desc: p.desc }]));
        const edgey = (n) => /(akamai|edgekey|edgesuite|fastly|cloudfront|trafficmanager|azureedge|1e100)/i.test(n);
        for (const r of dns) {
          if (!r.ip || !r.name) continue;
          const cur = this.domains.get(r.ip);
          if (!cur || (edgey(cur) && !edgey(r.name))) this.domains.set(r.ip, String(r.name).toLowerCase());
        }
        this.lastSlow = Date.now();
      })
      .catch((e) => console.error('[watchtower] procinfo failed:', e.message))
      .finally(() => {
        this.slowRunning = null;
      });
    return this.slowRunning;
  }

  async locateHome() {
    if (this.home && Date.now() - (this.home.at || 0) < 6 * 3600000) return;
    try {
      const r = await fetch(`http://ip-api.com/json/?fields=${GEO_FIELDS}`, { signal: AbortSignal.timeout(6000) });
      const g = await r.json();
      if (g.status === 'success') {
        this.home = { lat: g.lat, lon: g.lon, city: g.city, country: g.country, at: Date.now() };
        this.saveCache();
      }
    } catch {
      /* offline: arcs start from a default spot */
    }
  }

  async lookup(ips) {
    const need = ips.filter((ip) => !this.geo.has(ip)).slice(0, 100);
    if (!need.length || Date.now() - this.lastGeoCall < 4500) return;
    this.lastGeoCall = Date.now();
    try {
      const r = await fetch(`http://ip-api.com/batch?fields=${GEO_FIELDS}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(need),
        signal: AbortSignal.timeout(8000),
      });
      const list = await r.json();
      for (const g of list) {
        if (g.status === 'success') {
          const geo = { country: g.country, cc: g.countryCode, city: g.city, lat: g.lat, lon: g.lon, isp: g.isp, as: g.as };
          geo.network = networkName(geo);
          this.geo.set(g.query, geo);
        } else if (g.query) {
          this.geo.set(g.query, null);
        }
      }
      this.saveCache();
    } catch (e) {
      console.error('[watchtower] geo lookup failed:', e.message);
    }
  }

  async scan() {
    if (process.platform !== 'win32') return this.snapshot(Date.now(), true);

    const [ns, tl] = await Promise.all([run('netstat', ['-ano', '-p', 'TCP']).catch(() => ''), run('tasklist', ['/fo', 'csv', '/nh']).catch(() => '')]);
    const ns6 = await run('netstat', ['-ano', '-p', 'TCPv6']).catch(() => '');
    let conns = [...parseNetstat(ns), ...parseNetstat(ns6)];
    const names = parseTasklist(tl);

    // netstat blocked or broken? Fall back to PowerShell's Get-NetTCPConnection
    if (!ns && !ns6) {
      try {
        const raw = parse(await runPowerShell(FALLBACK, 20000));
        const list = Array.isArray(raw.conns) ? raw.conns : raw.conns ? [raw.conns] : [];
        conns = list.filter((c) => c.ip && !isPrivate(c.ip)).map((c) => ({ ip: c.ip, port: c.port, pid: c.pid }));
        for (const c of list) if (c.proc && !names.has(c.pid)) names.set(c.pid, `${c.proc}.exe`);
        for (const r of Array.isArray(raw.dns) ? raw.dns : []) if (r.ip && r.name && !this.domains.has(r.ip)) this.domains.set(r.ip, String(r.name).toLowerCase());
        this.method = 'powershell';
      } catch (e) {
        throw new Error(`Couldn't read connections (netstat and PowerShell both failed): ${e.message}`);
      }
    } else {
      this.method = 'netstat';
    }
    const now = Date.now();

    // Paths + DNS: first scan waits for them, later scans refresh in the background
    const unknownPid = conns.some((c) => c.pid > 4 && !this.procs.has(c.pid));
    if (!this.lastSlow) await this.slowRefresh();
    else if (now - this.lastSlow > SLOW_EVERY_MS || (unknownPid && now - this.lastSlow > 6000)) this.slowRefresh();

    if (this.geoEnabled) await Promise.all([this.locateHome(), this.lookup([...new Set(conns.map((c) => c.ip))])]);

    const activeKeys = new Set();
    for (const c of conns) {
      const image = names.get(c.pid) || null;
      const info = this.procs.get(c.pid);
      let app;
      let kind;
      let exePath = info ? info.path : null;
      if (c.pid === 4 || image === 'System') {
        app = 'Windows (System)';
        kind = 'system';
      } else if (!image && !info) {
        app = 'Closed app';
        kind = 'app';
      } else {
        const id = identify({ packaged: false, id: exePath || image, path: exePath || image, description: info && info.desc });
        app = id.name;
        kind = id.kind;
      }
      const key = `${app}|${c.ip}|${c.port}`;
      activeKeys.add(key);
      const domain = this.domains.get(c.ip) || null;
      const geo = this.geoEnabled ? this.geo.get(c.ip) || null : null;
      const cls = classify(domain, geo && geo.network);
      const prev = this.flows.get(key);
      this.flows.set(key, {
        key, app, kind, path: exePath, ip: c.ip, port: c.port, domain,
        company: cls.company || (geo && geo.network) || null,
        category: cls.category,
        local: false,
        geo,
        firstSeen: prev ? prev.firstSeen : now,
        lastSeen: now,
        active: true,
      });
    }
    for (const f of this.flows.values()) if (!activeKeys.has(f.key)) f.active = false;
    for (const [k, f] of this.flows) if (now - f.lastSeen > 30 * 60000) this.flows.delete(k);

    return this.snapshot(now, false);
  }

  clear() {
    this.flows.clear();
    this.geo.clear();
    this.saveCache();
  }

  snapshot(now, unsupported) {
    return { ok: true, unsupported, geoEnabled: this.geoEnabled, method: this.method, now, home: this.home, flows: [...this.flows.values()].sort((a, b) => b.lastSeen - a.lastSeen) };
  }
}

module.exports = { Network, isPrivate, parseNetstat, parseTasklist, networkName };
