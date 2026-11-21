// Friendly names and "is this part of Windows?" tagging.

// Keyed by lowercase exe name (no .exe)
const EXE = {
  robloxplayerbeta: 'Roblox',
  'valorant-win64-shipping': 'VALORANT',
  cs2: 'Counter-Strike 2',
  csgo: 'Counter-Strike: GO',
  msedge: 'Microsoft Edge',
  msedgewebview2: 'Edge WebView',
  brave: 'Brave Browser',
  chrome: 'Google Chrome',
  firefox: 'Firefox',
  opera: 'Opera',
  discord: 'Discord',
  zoom: 'Zoom',
  teams: 'Microsoft Teams',
  'ms-teams': 'Microsoft Teams',
  slack: 'Slack',
  obs64: 'OBS Studio',
  steam: 'Steam',
  steamwebhelper: 'Steam',
  epicwebhelper: 'Epic Games Launcher',
  nfs13: 'Need for Speed Most Wanted',
  needforspeedheat: 'Need for Speed Heat',
  needforspeedunbound: 'Need for Speed Unbound',
  voiceai: 'Voice.ai',
  voicemoddesktop: 'Voicemod',
  nvcontainer: 'NVIDIA Container',
  'mc-fw-host': 'McAfee Firewall',
  acrocef: 'Adobe Acrobat',
  hpprintscandoctor: 'HP Print and Scan Doctor',
  hpprinterhealthmonitor: 'HP Printer Health Monitor',
  unrealcefsubprocess: 'Epic Games (web helper)',
  eacefsubprocess: 'EA App (web helper)',
  riotclientservices: 'Riot Client',
  lockdownbrowser: 'LockDown Browser',
  todoist: 'Todoist',
  spotify: 'Spotify',
  whatsapp: 'WhatsApp',
  dllhost: 'COM Surrogate',
  dashost: 'Device Association Host',
  netsh: 'Network Command Shell',
  svchost: 'Windows Service Host',
  explorer: 'File Explorer',
  searchhost: 'Windows Search',
  runtimebroker: 'Runtime Broker',
};

// Keyed by the readable part of a Store package id
const PKG = {
  WebExperience: 'Windows Widgets',
  immersivecontrolpanel: 'Windows Settings',
  WindowsSoundRecorder: 'Sound Recorder',
  ScreenSketch: 'Snipping Tool',
  WindowsCamera: 'Camera',
  WindowsMaps: 'Maps',
  'Windows.Photos': 'Photos',
  Photos: 'Photos',
  XboxGamingOverlay: 'Xbox Game Bar',
  WindowsStore: 'Microsoft Store',
  'Windows.Search': 'Windows Search',
  Search: 'Windows Search',
  WhatsAppDesktop: 'WhatsApp',
  SpotifyMusic: 'Spotify',
  TradingView: 'TradingView',
  DellSupportAssistforPCs: 'Dell SupportAssist',
  'Office.OneNote': 'OneNote',
  Codex: 'Codex',
  'MixedReality.Portal': 'Mixed Reality Portal',
  ShellExperienceHost: 'Windows Shell',
  'Windows.Cortana': 'Cortana',
};

const SYSTEM_EXE = new Set(['dllhost', 'dashost', 'netsh', 'svchost', 'explorer', 'searchhost', 'runtimebroker', 'systemsettings', 'backgroundtaskhost', 'sihost', 'taskhostw', 'lsass', 'services', 'wudfhost', 'audiodg']);
const VENDOR_AGENT = /instrumentation|telemetry|agent|helper|service|updater|container|subagent/i;

function exeBase(p) {
  return (p.split('\\').pop() || p).replace(/\.exe$/i, '');
}

function pkgReadable(id) {
  let s = id.split('_')[0];
  s = s.replace(/^[^.]*\d[^.]*\./, ''); // drop publisher ids like 31178TradingViewInc.
  s = s.replace(/^Microsoft\./, '').replace(/^MicrosoftWindows\./, '').replace(/^windows\./i, '');
  return s;
}

function lookupPkg(id) {
  const readable = pkgReadable(id);
  if (PKG[readable]) return PKG[readable];
  for (const [k, v] of Object.entries(PKG)) if (readable.endsWith(k) || readable.includes(k)) return v;
  const last = readable.split('.').pop();
  return last.replace(/([a-z])([A-Z])/g, '$1 $2').trim() || id;
}

// Returns { group, name, kind } where kind is 'app' | 'system' | 'background'
function identify(a) {
  if (a.packaged) {
    const name = lookupPkg(a.id);
    const system = /^(windows\.|MicrosoftWindows\.|Microsoft\.Windows\.)/i.test(a.id) || /Windows (Widgets|Settings|Search|Shell)/.test(name);
    return { group: `pkg:${a.id.split('_')[0].toLowerCase()}`, name, kind: system ? 'system' : 'app' };
  }
  const base = exeBase(a.path || a.id.replace(/#/g, '\\'));
  const lower = base.toLowerCase();
  let name = EXE[lower] || (a.description && a.description.trim()) || base.charAt(0).toUpperCase() + base.slice(1);
  if (name.length > 40) name = base;
  const winDir = /^c:\\windows\\/i.test(a.path || '');
  const kind = SYSTEM_EXE.has(lower) || winDir ? 'system' : VENDOR_AGENT.test(`${base} ${a.description || ''}`) ? 'background' : 'app';
  return { group: `exe:${lower}`, name, kind };
}

module.exports = { identify, exeBase };
