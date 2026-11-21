// Builds Watchtower and creates Desktop + Start Menu shortcuts that launch it like a
// normal app (no terminal). Run with: npm run shortcut
// Re-run it after code changes so the shortcut uses the newest build.
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const electronExe = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
const icon = path.join(root, 'build', 'icon.ico');

if (process.platform !== 'win32') {
  console.error('Shortcuts are for Windows.');
  process.exit(1);
}
if (!fs.existsSync(electronExe)) {
  console.error('Electron is not installed yet. Run "npm install" first.');
  process.exit(1);
}

console.log('1/2  Building Watchtower...');
const build = spawnSync('npx', ['vite', 'build'], { cwd: root, stdio: 'inherit', shell: true });
if (build.status !== 0) {
  console.error('Build failed, shortcut not created.');
  process.exit(build.status || 1);
}

console.log('2/2  Creating shortcuts...');
const desktop = path.join(os.homedir(), 'Desktop');
const startMenu = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs');
const ps = (s) => s.replace(/'/g, "''");
const targets = [desktop, startMenu].filter((d) => d && fs.existsSync(d)).map((d) => path.join(d, 'Watchtower.lnk'));

const script = targets
  .map(
    (lnk) => `$s = (New-Object -ComObject WScript.Shell).CreateShortcut('${ps(lnk)}');
$s.TargetPath = '${ps(electronExe)}';
$s.Arguments = '"${ps(root)}"';
$s.WorkingDirectory = '${ps(root)}';
$s.IconLocation = '${ps(icon)},0';
$s.Description = 'Watchtower: see what your PC is secretly doing';
$s.Save();`
  )
  .join('\n');

execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: 'inherit' });
for (const t of targets) console.log(`     Created ${t}`);
console.log('\nDone. Open Watchtower from your Desktop or the Start menu.');
