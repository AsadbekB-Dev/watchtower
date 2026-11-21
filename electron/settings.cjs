// User settings, saved as JSON in the app's data folder.
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  sensorEveryMs: 8000, // how often to read the mic/camera/location log
  networkEveryMs: 4000, // how often to read live connections
  nightStart: 0, // hour (0-23) when "night" starts for night-use alerts
  nightEnd: 5, // hour when night ends
  geoLookups: true, // send server IPs to ip-api.com to place them on the map
  aiEnabled: true, // allow Gemini explanations and Ask Watchtower
  globeQuality: 'performance', // 'performance' (fast, stylized) or 'quality' (realistic Earth)
  liveClouds: true, // quality mode: download the live cloud map
  spin: true, // globe slowly rotates
  accent: 'teal', // UI accent color
};

const CHOICES = {
  globeQuality: ['performance', 'quality'],
  accent: ['teal', 'blue', 'purple', 'orange', 'pink'],
};

const LIMITS = {
  sensorEveryMs: [3000, 120000],
  networkEveryMs: [2000, 60000],
  nightStart: [0, 23],
  nightEnd: [0, 23],
};

class Settings {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'settings.json');
    this.values = { ...DEFAULTS };
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      for (const k of Object.keys(DEFAULTS)) if (k in saved) this.values[k] = saved[k];
    } catch {
      /* defaults */
    }
  }

  get() {
    return { ...this.values };
  }

  set(patch) {
    for (const [k, v] of Object.entries(patch || {})) {
      if (!(k in DEFAULTS)) continue;
      if (CHOICES[k]) {
        if (CHOICES[k].includes(v)) this.values[k] = v;
      } else if (typeof DEFAULTS[k] === 'boolean') this.values[k] = !!v;
      else {
        const n = Number(v);
        if (!Number.isFinite(n)) continue;
        const [lo, hi] = LIMITS[k];
        this.values[k] = Math.min(hi, Math.max(lo, Math.round(n)));
      }
    }
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.values, null, 2));
    } catch (e) {
      console.error('[watchtower] settings save failed:', e.message);
    }
    return this.get();
  }
}

module.exports = { Settings, DEFAULTS };
