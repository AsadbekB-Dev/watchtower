const { app, BrowserWindow, ipcMain, shell, Notification } = require('electron');
const path = require('path');
const { scan, History } = require('./sensors.cjs');
const { Network } = require('./network.cjs');
const { Gemini } = require('./gemini.cjs');
const { Settings } = require('./settings.cjs');
const { Firewall } = require('./firewall.cjs');

const DEV = process.env.WATCHTOWER_DEV === '1';
const ICON = path.join(__dirname, '..', 'build', 'icon.ico');

// Proper app identity: own taskbar entry, notifications say "Watchtower"
app.setName('Watchtower');
if (process.platform === 'win32') app.setAppUserModelId('dev.asadbek.watchtower');

// One Watchtower at a time: opening the shortcut again just brings the window back
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
}
let win = null;
let history = null;
let scanning = null;
let lastGoodSensors = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: '#07090d',
    title: 'Watchtower',
    icon: ICON,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());

  // Show renderer warnings/errors in the terminal so bugs are easy to report
  win.webContents.on('console-message', (_e, level, message, line, source) => {
    if (level >= 2) console.log(`[renderer] ${message} (${String(source).split('/').pop()}:${line})`);
  });
  win.webContents.on('render-process-gone', (_e, d) => console.log('[renderer] gone:', d.reason));
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
  });

  // Lock navigation to our own page
  win.webContents.on('will-navigate', (e, url) => {
    const ok = DEV ? url.startsWith('http://localhost:5173') : url.startsWith('file://');
    if (!ok) e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  if (DEV) win.loadURL('http://localhost:5173');
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

// Pop a Windows notification when an app starts using the mic or camera
const liveSeen = new Set();
let firstScan = true;
function notifyNewUse(apps) {
  const live = (apps || []).filter((a) => a.inUse && a.cap !== 'location');
  const nowKeys = new Set(live.map((a) => a.key));
  for (const a of live) {
    if (liveSeen.has(a.key) || firstScan || !Notification.isSupported()) continue;
    const h = new Date().getHours();
    const night = h < (settings ? settings.get().nightEnd : 5) && h >= (settings ? settings.get().nightStart : 0);
    const n = new Notification({
      title: `${a.name} is using your ${a.cap === 'webcam' ? 'camera' : 'microphone'}`,
      body: night ? 'This is happening during your night hours. Open Watchtower to review it.' : 'Open Watchtower to see the details.',
      icon: ICON,
    });
    n.on('click', () => {
      if (win) {
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
      }
    });
    n.show();
  }
  liveSeen.clear();
  for (const k of nowKeys) liveSeen.add(k);
  firstScan = false;
}

ipcMain.handle('sensors:scan', async () => {
  // Don't stack PowerShell runs if a scan is slow
  if (!scanning) {
    scanning = scan()
      .then((result) => {
        history.merge(result.sessions, result.now);
        notifyNewUse(result.apps);
        lastGoodSensors = result;
        return { ok: true, ...result, sessions: history.sessions };
      })
      // Keep showing the last good read; the banner says the latest check failed
      .catch((e) => ({ ...(lastGoodSensors || { apps: [], settings: {} }), ok: false, error: e.message, sessions: history.sessions }))
      .finally(() => {
        scanning = null;
      });
  }
  return scanning;
});

let network = null;
let gemini = null;

let settings = null;
let firewall = null;

ipcMain.handle('fw:list', () => firewall.list());
ipcMain.handle('fw:block', async (_e, items) => {
  try {
    return { ok: true, blocked: await firewall.block(items) };
  } catch (e) {
    return { ok: false, error: e.message, blocked: firewall.list() };
  }
});
ipcMain.handle('fw:unblock', async (_e, rules) => {
  try {
    return { ok: true, blocked: await firewall.unblock(rules) };
  } catch (e) {
    return { ok: false, error: e.message, blocked: firewall.list() };
  }
});

const aiOff = () => ({ ok: false, error: 'AI is turned off in Settings.', code: 'AI_OFF' });
ipcMain.handle('ai:status', () => ({ ...gemini.status(), enabled: settings.get().aiEnabled }));
ipcMain.handle('ai:setKey', (_e, k) => {
  try {
    return { ok: true, ...gemini.setKey(k) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
ipcMain.handle('ai:removeKey', () => ({ ok: true, ...gemini.removeKey() }));
ipcMain.handle('ai:test', async () => {
  if (!settings.get().aiEnabled) return aiOff();
  try {
    const t = await gemini.call('Reply with exactly: Watchtower is connected.', { maxTokens: 30, timeoutMs: 8000, rounds: 1 });
    return { ok: true, text: t, model: gemini.model };
  } catch (e) {
    return { ok: false, error: e.message, code: e.code || null };
  }
});
ipcMain.handle('ai:explainPlace', async (_e, details) => {
  if (!settings.get().aiEnabled) return aiOff();
  try {
    return { ok: true, result: await gemini.explainPlace(details) };
  } catch (e) {
    return { ok: false, error: e.message, code: e.code || null };
  }
});
ipcMain.handle('ai:ask', async (_e, { question, context, history: chat }) => {
  if (!settings.get().aiEnabled) return aiOff();
  try {
    return { ok: true, text: await gemini.ask(question, context, chat) };
  } catch (e) {
    return { ok: false, error: e.message, code: e.code || null };
  }
});

ipcMain.handle('ai:briefing', async (_e, { context, force }) => {
  if (!settings.get().aiEnabled) return aiOff();
  try {
    return { ok: true, result: await gemini.briefing(context, force) };
  } catch (e) {
    return { ok: false, error: e.message, code: e.code || null };
  }
});

ipcMain.handle('settings:get', () => ({ ...settings.get(), dataDir: app.getPath('userData') }));
ipcMain.handle('settings:set', (_e, patch) => {
  const v = settings.set(patch);
  network.geoEnabled = v.geoLookups;
  return { ...v, dataDir: app.getPath('userData') };
});
ipcMain.handle('data:clear', () => {
  history.sessions = [];
  history.save();
  network.clear();
  return true;
});
let netScanning = null;
let lastDump = 0;
ipcMain.handle('network:scan', async () => {
  if (!netScanning) {
    netScanning = network
      .scan()
      .then((r) => {
        // In dev, keep a snapshot in the project folder (git-ignored) for debugging
        if (DEV && Date.now() - lastDump > 15000) {
          lastDump = Date.now();
          network.dumpDiagnostics(path.join(__dirname, '..', 'debug-network.json'));
        }
        return r;
      })
      .catch((e) => ({ ok: false, error: e.message, flows: [], home: network.home }))
      .finally(() => {
        netScanning = null;
      });
  }
  return netScanning;
});

const iconCache = new Map();
// Windows returns the same blank "program" icon for exes without their own icon;
// grab that one once so we can recognise it and show a letter avatar instead.
let genericIcon;
async function getGenericIcon() {
  if (genericIcon !== undefined) return genericIcon;
  try {
    const img = await app.getFileIcon(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'dllhost.exe'), { size: 'normal' });
    genericIcon = img.isEmpty() ? null : img.toDataURL();
  } catch {
    genericIcon = null;
  }
  return genericIcon;
}
ipcMain.handle('app:icon', async (_e, exePath) => {
  if (typeof exePath !== 'string' || !/\.exe$/i.test(exePath)) return null;
  if (iconCache.has(exePath)) return iconCache.get(exePath);
  // Old app versions no longer exist on disk; Windows would hand back a blank generic icon
  if (!require('fs').existsSync(exePath)) {
    iconCache.set(exePath, null);
    return null;
  }
  try {
    const img = await app.getFileIcon(exePath, { size: 'normal' });
    let url = img.isEmpty() ? null : img.toDataURL();
    if (url && url === (await getGenericIcon())) url = null;
    iconCache.set(exePath, url);
    return url;
  } catch {
    iconCache.set(exePath, null);
    return null;
  }
});

const SETTINGS_PAGES = {
  microphone: 'ms-settings:privacy-microphone',
  webcam: 'ms-settings:privacy-webcam',
  location: 'ms-settings:privacy-location',
};
ipcMain.handle('settings:open', async (_e, cap) => {
  const url = SETTINGS_PAGES[cap];
  if (!url || process.platform !== 'win32') return false;
  await shell.openExternal(url);
  return true;
});

process.on('uncaughtException', (e) => console.error('[watchtower] uncaught:', e));

app.whenReady().then(() => {
  history = new History(path.join(app.getPath('userData'), 'watchtower-history.json'));
  settings = new Settings(app.getPath('userData'));
  firewall = new Firewall(app.getPath('userData'));
  network = new Network(app.getPath('userData'));
  network.geoEnabled = settings.get().geoLookups;
  gemini = new Gemini(app.getPath('userData'), path.join(__dirname, '..'));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Closing the window fully exits Watchtower (no background process left running)
app.on('window-all-closed', () => app.quit());
