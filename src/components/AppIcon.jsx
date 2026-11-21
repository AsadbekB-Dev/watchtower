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
  return (
    <span className="app-icon" style={{ width: size, height: size }}>
      {src ? <img src={src} alt="" width={size - 6} height={size - 6} /> : <span>{letter}</span>}
    </span>
  );
}
