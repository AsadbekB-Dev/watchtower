// Reads Windows' sensor-access log and keeps our own history of sessions.
// Windows keeps only the LAST use per registry entry, but every app version
// (Discord app-1.0.9028, app-1.0.9030, ...) gets its own entry, so the log
// already holds a long trail of past sessions. We group them per app and keep
// recording new ones while Watchtower runs.
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

// In the installed app, scripts live in app.asar.unpacked so PowerShell can read them
const scriptPath = (name) => path.join(__dirname, 'scripts', name).replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
const { identify } = require('./names.cjs');

const SCRIPT = scriptPath('sensors.ps1');
const KEEP_DAYS = 400;
const MAX_SESSIONS = 8000;

function runPowerShell(file, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file],
      { windowsHide: true, timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve(stdout);
      }
    );
  });
}

function parse(text) {
  const t = String(text).replace(/^﻿/, '').trim();
  return t ? JSON.parse(t) : { apps: [] };
}

// raw registry entries -> { apps (one per sensor+app), sessions (one per logged use) }
function normalize(raw) {
  const entries = Array.isArray(raw.apps) ? raw.apps : raw.apps ? [raw.apps] : [];
  const groups = new Map();
  const sessions = [];

  for (const a of entries) {
    const id = identify(a);
    const key = `${a.cap}|${id.group}`;
    const start = Number(a.start) || 0;
    const stop = Number(a.stop) || 0;
    const exists = !!a.description || !!a.packaged; // description is only read when the exe still exists
    const g =
      groups.get(key) ||
      { key, cap: a.cap, name: id.name, kind: id.kind, path: null, packaged: !!a.packaged, start: 0, stop: 0, inUse: false, allowed: false, entries: 0 };
    g.entries += 1;
    if (a.allowed === 'Allow' || start > 0) g.allowed = true;
    if (a.path && (exists || !g.path)) g.path = a.path;
    if (start > 0 && stop === 0) g.inUse = true;
    if (start > g.start) {
      g.start = start;
      g.stop = stop;
    }
    groups.set(key, g);
    if (start > 0) sessions.push({ key, cap: a.cap, name: id.name, kind: id.kind, path: a.path || null, start, stop });
  }

  return {
    now: Number(raw.now) || Date.now(),
    settings: raw.settings || {},
    apps: [...groups.values()],
    sessions,
  };
}

class History {
  constructor(file) {
    this.file = file;
    this.sessions = [];
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data.version === 2 && Array.isArray(data.sessions)) this.sessions = data.sessions;
    } catch {
      /* first run */
    }
  }

  merge(fresh, now) {
    let changed = false;
    const index = new Map(this.sessions.map((s, i) => [`${s.key}|${s.start}`, i]));
    for (const s of fresh) {
      const id = `${s.key}|${s.start}`;
      if (index.has(id)) {
        const cur = this.sessions[index.get(id)];
        if (cur.stop !== s.stop || cur.name !== s.name || cur.path !== s.path) {
          Object.assign(cur, s);
          changed = true;
        }
      } else {
        this.sessions.push({ ...s });
        index.set(id, this.sessions.length - 1);
        changed = true;
      }
    }
    const cutoff = now - KEEP_DAYS * 86400000;
    const before = this.sessions.length;
    this.sessions = this.sessions.filter((s) => s.start >= cutoff).sort((x, y) => y.start - x.start);
    if (this.sessions.length > MAX_SESSIONS) this.sessions.length = MAX_SESSIONS;
    if (changed || this.sessions.length !== before) this.save();
  }

  save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify({ version: 2, sessions: this.sessions }));
      fs.renameSync(tmp, this.file);
    } catch (e) {
      console.error('[watchtower] history save failed:', e.message);
    }
  }
}

function sampleRaw() {
  const sample = path.join(__dirname, '..', 'debug.json');
  if (fs.existsSync(sample)) return parse(fs.readFileSync(sample, 'utf8'));
  return { now: Date.now(), settings: {}, apps: [] };
}

async function scan() {
  if (process.platform !== 'win32' || process.env.WATCHTOWER_SAMPLE === '1') {
    return { ...normalize(sampleRaw()), sample: true };
  }
  const raw = parse(await runPowerShell(SCRIPT));
  return { ...normalize(raw), sample: false };
}

module.exports = { scan, History, normalize, parse, runPowerShell };
