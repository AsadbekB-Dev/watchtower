// Blocks trackers with Windows Firewall outbound rules (one rule per company).
// Changing the firewall needs admin rights, so each batch runs once through an
// elevated PowerShell and Windows shows its normal UAC prompt.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const PREFIX = 'Watchtower block - ';
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6 = /^[0-9a-f:]+$/i;

const safeName = (s) => String(s).replace(/[^A-Za-z0-9 .,()&+_-]/g, '').trim().slice(0, 60) || 'Unknown';
const validIps = (ips) => [...new Set(ips)].filter((ip) => IPV4.test(ip) || (IPV6.test(ip) && ip.includes(':'))).slice(0, 200);

function runElevated(lines) {
  return new Promise((resolve, reject) => {
    const script = path.join(os.tmpdir(), `watchtower-fw-${Date.now()}.ps1`);
    fs.writeFileSync(script, ['$ErrorActionPreference = "Stop"', ...lines, 'exit 0'].join('\r\n'));
    // Outer, non-elevated PowerShell asks Windows to start the inner one as admin and waits for it
    const outer = `try { $p = Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','"${script}"'; exit $p.ExitCode } catch { Write-Output $_.Exception.Message; exit 1223 }`;
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', outer], { windowsHide: true, timeout: 120000 }, (err, stdout) => {
      try {
        fs.unlinkSync(script);
      } catch {
        /* temp file */
      }
      const code = err ? err.code : 0;
      if (code === 0) return resolve();
      if (code === 1223 || /cancel/i.test(stdout || '')) return reject(new Error('Cancelled: Windows needs your permission to change the firewall.'));
      reject(new Error(`Firewall change failed (code ${code}). ${String(stdout || '').trim()}`));
    });
  });
}

class Firewall {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'blocked.json');
    this.blocked = [];
    try {
      this.blocked = JSON.parse(fs.readFileSync(this.file, 'utf8')).blocked || [];
    } catch {
      /* none yet */
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify({ blocked: this.blocked }, null, 2));
  }

  list() {
    return this.blocked;
  }

  // items: [{ name, ips, category }]
  async block(items) {
    if (process.platform !== 'win32') throw new Error('Blocking uses Windows Firewall, so it only works on Windows.');
    const todo = [];
    for (const it of items || []) {
      const ips = validIps(it.ips || []);
      if (!ips.length) continue;
      const name = safeName(it.name);
      const rule = PREFIX + name;
      const existing = this.blocked.find((b) => b.rule === rule);
      const all = validIps([...(existing ? existing.ips : []), ...ips]);
      todo.push({ name, rule, ips: all, category: it.category || 'normal' });
    }
    if (!todo.length) throw new Error('Nothing to block: no server addresses known yet.');

    const lines = [];
    for (const t of todo) {
      lines.push(`Remove-NetFirewallRule -DisplayName '${t.rule}' -ErrorAction SilentlyContinue`);
      lines.push(`New-NetFirewallRule -DisplayName '${t.rule}' -Direction Outbound -Action Block -RemoteAddress @(${t.ips.map((ip) => `'${ip}'`).join(',')}) -Profile Any -Description 'Added by Watchtower' | Out-Null`);
    }
    await runElevated(lines);

    for (const t of todo) {
      this.blocked = this.blocked.filter((b) => b.rule !== t.rule);
      this.blocked.push({ ...t, at: Date.now() });
    }
    this.save();
    return this.blocked;
  }

  async unblock(rules) {
    const known = (rules || []).filter((r) => this.blocked.some((b) => b.rule === r));
    if (!known.length) return this.blocked;
    await runElevated(known.map((r) => `Remove-NetFirewallRule -DisplayName '${r}' -ErrorAction SilentlyContinue`));
    this.blocked = this.blocked.filter((b) => !known.includes(b.rule));
    this.save();
    return this.blocked;
  }
}

module.exports = { Firewall, safeName, validIps };
