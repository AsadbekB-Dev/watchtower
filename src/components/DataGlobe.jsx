import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { feature } from 'topojson-client';
import world from 'world-atlas/countries-110m.json';
import { CATEGORIES, placeKey } from '../lib/network.js';
import { createQualityGlobe } from './globeQuality.js';

// Antarctica adds clutter at the bottom of the globe
const COUNTRIES = feature(world, world.objects.countries).features.filter((f) => f.id !== '010');
const DEFAULT_HOME = { lat: 33.9, lon: -118.3 };
const NEAR_DEG = 2; // servers this close to you get a dot, not an arc (a tiny arc flickers)

const capColor = () => 'rgba(56, 189, 248, 0.07)';
const sideColor = () => 'rgba(0, 0, 0, 0)';
const strokeColor = () => 'rgba(148, 197, 255, 0.38)';
const faintStroke = () => 'rgba(255, 255, 255, 0.10)';
const noCap = () => 'rgba(0, 0, 0, 0)';
const arcGap = (a) => a.gap;
const arcAnim = (a) => (a.active ? 1800 : 0);
const pointColor = (p) => (p.tracker ? '#f43f5e' : '#5eead4');
const pointRadius = (p) => Math.min(1.1, 0.45 + p.n * 0.05);
const homeLabel = () => 'You';
const labelColor = () => '#5eead4';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function DataGlobe({ flows, home, selectedApp, picked, onPick, quality = 'performance', liveClouds = true, spin = true, onQualityInfo }) {
  const wrap = useRef(null);
  const globe = useRef(null);
  const arcCache = useRef(new Map());
  const [size, setSize] = useState({ w: 600, h: 600 });

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      const h = Math.round(e.contentRect.height);
      if (w > 50 && h > 50) setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    });
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  // three must be the same version globe.gl uses (see package.json), or nothing renders
  const plainMaterial = useMemo(() => new THREE.MeshPhongMaterial({ color: '#0a1220', emissive: '#06101c', shininess: 12 }), []);

  // Quality mode: build the realistic globe; if anything fails, stay on the plain one
  const [kit, setKit] = useState(null);
  useEffect(() => {
    if (quality !== 'quality') {
      setKit(null);
      onQualityInfo && onQualityInfo(null);
      return undefined;
    }
    let alive = true;
    let made = null;
    createQualityGlobe({ liveClouds })
      .then((k) => {
        made = k;
        if (alive) setKit(k);
        else k.dispose();
      })
      .catch((e) => {
        console.warn('[globe] quality mode unavailable, using performance mode:', e.message);
        onQualityInfo && onQualityInfo({ failed: true });
      });
    return () => {
      alive = false;
      if (made) made.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, liveClouds]);
  const material = kit ? kit.material : plainMaterial;

  // Once the realistic material is on the globe, add clouds and start the sun clock
  useEffect(() => {
    if (!kit || !globe.current) return;
    const t = setTimeout(() => {
      try {
        kit.attach(globe.current);
        onQualityInfo && onQualityInfo({ clouds: kit.cloudSource() });
      } catch (e) {
        console.warn('[globe] clouds failed:', e.message);
      }
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kit]);
  const h = home || DEFAULT_HOME;

  useEffect(() => {
    const g = globe.current;
    if (!g) return;
    g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    g.pointOfView({ lat: h.lat - 8, lng: h.lon + 25, altitude: 2.3 }, 1200);
    const c = g.controls();
    c.autoRotate = spin;
    c.autoRotateSpeed = 0.35;
    c.minDistance = 160;
    c.maxDistance = 520;
  }, [h.lat, h.lon]);

  // Fly to a picked place and stop spinning; resume when the panel closes
  const pickedPlace = picked ? picked.place : null;
  useEffect(() => {
    const g = globe.current;
    if (!g) return;
    const c = g.controls();
    if (pickedPlace) {
      const [lat, lng] = pickedPlace.split(',').map(Number);
      c.autoRotate = false;
      g.pointOfView({ lat, lng, altitude: 1.7 }, 900);
    } else {
      c.autoRotate = spin;
    }
  }, [pickedPlace, spin]);

  // Only rebuild layers when the set of connections actually changes
  const remote = flows.filter((f) => !f.local && f.geo && (!selectedApp || f.app === selectedApp));
  const signature = remote.map((f) => `${f.key}:${f.active ? 1 : 0}:${f.category}`).join('|') + `@${h.lat},${h.lon}#${selectedApp || ''}`;

  // Arc objects are reused between polls so they keep animating, but a filter change
  // must start fresh: re-adding an arc object the globe already disposed freezes it.
  const lastFilter = useRef(selectedApp);
  if (lastFilter.current !== selectedApp) {
    arcCache.current = new Map();
    lastFilter.current = selectedApp;
  }

  const { arcs, points } = useMemo(() => {
    // One arc per place + category, reusing objects so arcs don't restart their animation
    const groups = new Map();
    const pts = new Map();
    for (const f of remote) {
      const place = placeKey(f.geo);
      const p = pts.get(place) || { key: place, lat: f.geo.lat, lng: f.geo.lon, n: 0, tracker: false, city: f.geo.city, country: f.geo.country, names: new Set() };
      p.n += 1;
      if (f.category !== 'normal') p.tracker = true;
      p.names.add(f.company || f.domain || f.ip);
      pts.set(place, p);

      if (Math.abs(f.geo.lat - h.lat) < NEAR_DEG && Math.abs(f.geo.lon - h.lon) < NEAR_DEG) continue;
      const id = `${place}|${f.category}`;
      const g = groups.get(id) || { id, place, category: f.category, endLat: f.geo.lat, endLng: f.geo.lon, active: false, keys: [], names: new Set(), apps: new Set(), city: f.geo.city, country: f.geo.country };
      if (f.active) g.active = true;
      g.keys.push(f.key);
      g.names.add(f.company || f.domain || f.ip);
      g.apps.add(f.app);
      groups.set(id, g);
    }
    const cache = arcCache.current;
    const next = new Map();
    for (const g of groups.values()) {
      const a = cache.get(g.id) || { gap: Math.random() };
      Object.assign(a, g, { startLat: h.lat, startLng: h.lon, color: CATEGORIES[g.category].color });
      next.set(g.id, a);
    }
    arcCache.current = next;
    return { arcs: [...next.values()], points: [...pts.values()] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const pickedFlow = picked ? picked.flow : null;
  const arcColor = useCallback((a) => (a.active ? [`${a.color}22`, a.color] : [`${a.color}11`, `${a.color}55`]), []);
  const arcStroke = useCallback((a) => (pickedFlow && a.keys.includes(pickedFlow) ? 1.1 : a.active ? 0.7 : 0.35), [pickedFlow]);
  const arcLabel = useCallback(
    (a) => `<div class="g-tip"><b>${[...a.apps].slice(0, 3).map(esc).join(', ')}</b> → ${[...a.names].slice(0, 3).map(esc).join(', ')}<br/><span>${esc(a.city || '')}${a.city ? ', ' : ''}${esc(a.country || '')} · ${esc(CATEGORIES[a.category].label)}</span><br/><em>Click for details</em></div>`,
    []
  );
  const pointLabel = useCallback(
    (p) => `<div class="g-tip"><b>${esc(p.city || p.country || '')}</b>${p.city ? `, ${esc(p.country)}` : ''}<br/><span>${[...p.names].slice(0, 5).map(esc).join(', ')}</span><br/><em>Click for details</em></div>`,
    []
  );
  const onArcClick = useCallback((a) => onPick && onPick({ place: a.place, flow: a.keys[0] }), [onPick]);
  const onPointClick = useCallback((p) => onPick && onPick({ place: p.key, flow: null }), [onPick]);
  const onGlobeClick = useCallback(() => onPick && onPick(null), [onPick]);

  const homePoint = useMemo(() => [{ lat: h.lat, lng: h.lon }], [h.lat, h.lon]);
  const rings = useMemo(() => {
    const p = pickedPlace && points.find((x) => x.key === pickedPlace);
    return p ? [...homePoint, { lat: p.lat, lng: p.lng, picked: true }] : homePoint;
  }, [pickedPlace, points, homePoint]);
  const ringColor = useCallback((r) => (t) => (r.picked ? `rgba(255, 255, 255, ${1 - t})` : `rgba(94, 234, 212, ${1 - t})`), []);

  return (
    <div className="globe-wrap" ref={wrap}>
      <Globe
        ref={globe}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        globeMaterial={material}
        showAtmosphere
        atmosphereColor={kit ? '#7cc4ff' : '#38bdf8'}
        atmosphereAltitude={kit ? 0.2 : 0.16}
        polygonsData={COUNTRIES}
        polygonAltitude={0.006}
        polygonCapColor={kit ? noCap : capColor}
        polygonSideColor={sideColor}
        polygonStrokeColor={kit ? faintStroke : strokeColor}
        backgroundImageUrl={kit ? `${import.meta.env.BASE_URL || './'}textures/night-sky.png` : null}
        polygonsTransitionDuration={0}
        arcsData={arcs}
        arcColor={arcColor}
        arcStroke={arcStroke}
        arcDashLength={0.45}
        arcDashGap={0.25}
        arcDashInitialGap={arcGap}
        arcDashAnimateTime={arcAnim}
        arcAltitudeAutoScale={0.45}
        arcsTransitionDuration={0}
        arcLabel={arcLabel}
        onArcClick={onArcClick}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor={pointColor}
        pointAltitude={0.01}
        pointRadius={pointRadius}
        pointsMerge={false}
        pointsTransitionDuration={0}
        pointLabel={pointLabel}
        onPointClick={onPointClick}
        onGlobeClick={onGlobeClick}
        ringsData={rings}
        ringLat="lat"
        ringLng="lng"
        ringColor={ringColor}
        ringMaxRadius={3.2}
        ringPropagationSpeed={1.6}
        ringRepeatPeriod={1400}
        labelsData={homePoint}
        labelLat="lat"
        labelLng="lng"
        labelText={homeLabel}
        labelSize={1.1}
        labelDotRadius={0.45}
        labelColor={labelColor}
        labelResolution={2}
      />
      <div className="globe-legend">
        {Object.entries(CATEGORIES).map(([k, c]) => (
          <span key={k}><i style={{ background: c.color }} /> {c.label}</span>
        ))}
      </div>
    </div>
  );
}

export default memo(DataGlobe);
