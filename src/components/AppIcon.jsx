import { useEffect, useState } from 'react';

const cache = new Map();

export default function AppIcon({ path, name, size = 28 }) {
  const [src, setSrc] = useState(path ? cache.get(path) ?? null : null);

  useEffect(() => {
    let alive = true;
    if (!path || !window.watchtower || cache.has(path)) {
      setSrc(path ? cache.get(path) ?? null : null);
      return;
    }
    window.watchtower.appIcon(path).then((url) => {
      cache.set(path, url);
      if (alive) setSrc(url);
    });
    return () => {
      alive = false;
    };
  }, [path]);

  const letter = (name || '?').trim().charAt(0).toUpperCase();
  let h = 0;
  for (const ch of name || '') h = (h * 31 + ch.charCodeAt(0)) % 360;
  const tint = src ? undefined : { background: `linear-gradient(135deg, hsl(${h} 45% 28%), hsl(${(h + 40) % 360} 45% 20%))`, color: `hsl(${h} 80% 85%)` };
  return (
    <span className="app-icon" style={{ width: size, height: size, ...tint }}>
      {src ? <img src={src} alt="" width={size - 6} height={size - 6} /> : <span>{letter}</span>}
    </span>
  );
}
