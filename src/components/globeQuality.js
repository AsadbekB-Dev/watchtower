// "Quality" globe: real Earth imagery lit by where the sun actually is right now,
// city lights on the night side, shimmering oceans, and a live cloud layer.
import * as THREE from 'three';

const BASE = import.meta.env.BASE_URL || './';
const tex = (f) => `${BASE}textures/${f}`;
// Near-live global cloud map, refreshed every 3 hours (github.com/matteason/live-cloud-maps)
const LIVE_CLOUDS = 'https://clouds.matteason.co.uk/images/2048x1024/clouds-alpha.png';

// Where the sun is directly overhead right now (good to about a degree)
export function subsolarPoint(date = new Date()) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = (date.getTime() - start) / 86400000;
  const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (day + 10));
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  let lng = (12 - hours) * 15;
  lng = ((lng + 540) % 360) - 180;
  return { lat: decl, lng };
}

const EARTH_VERT = `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vUv = uv;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vPosW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const EARTH_FRAG = `
uniform sampler2D dayTex;
uniform sampler2D nightTex;
uniform sampler2D waterTex;
uniform vec3 sunDir;
uniform float time;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vec3 n = normalize(vNormalW);
  float d = dot(n, sunDir);
  float light = smoothstep(-0.12, 0.22, d);
  vec3 day = texture2D(dayTex, vUv).rgb;
  vec3 night = texture2D(nightTex, vUv).rgb * 1.6 + vec3(0.006, 0.01, 0.02);
  float water = texture2D(waterTex, vUv).r;
  vec3 viewDir = normalize(cameraPosition - vPosW);
  vec3 r = reflect(-sunDir, n);
  float spec = pow(max(dot(r, viewDir), 0.0), 28.0) * water * light;
  float ripple = 0.65 + 0.35 * sin(vUv.x * 900.0 + time * 1.6) * sin(vUv.y * 650.0 - time * 1.2);
  vec3 col = mix(night, day * (0.75 + 0.35 * max(d, 0.0)), light);
  col += vec3(0.55, 0.68, 0.85) * spec * ripple * 0.9;
  // soft blue rim on the sunlit edge
  float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
  col += vec3(0.25, 0.5, 0.9) * rim * 0.25 * light;
  gl_FragColor = vec4(col, 1.0);
}`;

const CLOUD_FRAG = `
uniform sampler2D cloudTex;
uniform vec3 sunDir;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vec4 c = texture2D(cloudTex, vUv);
  float a = max(c.a < 0.99 ? c.a : c.r, 0.0);
  float light = smoothstep(-0.1, 0.25, dot(normalize(vNormalW), sunDir));
  gl_FragColor = vec4(vec3(1.0) * (0.12 + 0.88 * light), a * 0.85);
}`;

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        resolve(t);
      },
      undefined,
      () => reject(new Error(`Couldn't load ${url}`))
    );
  });
}

// Builds everything; resolves with { material, attach(globe), dispose() } or rejects
// so the caller can fall back to the plain globe.
export async function createQualityGlobe({ liveClouds }) {
  const [day, night, water] = await Promise.all([
    loadTexture(tex('earth-blue-marble.jpg')).catch(() => loadTexture(tex('earth-day.jpg'))),
    loadTexture(tex('earth-night.jpg')),
    loadTexture(tex('earth-water.png')),
  ]);
  water.colorSpace = THREE.NoColorSpace;

  const uniforms = { dayTex: { value: day }, nightTex: { value: night }, waterTex: { value: water }, sunDir: { value: new THREE.Vector3(1, 0, 0) }, time: { value: 0 } };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: EARTH_VERT, fragmentShader: EARTH_FRAG });

  // Clouds: live map first, built-in picture if the download fails (offline, blocked)
  let cloudSource = 'none';
  let cloudTex = null;
  if (liveClouds) {
    cloudTex = await loadTexture(`${LIVE_CLOUDS}?t=${Math.floor(Date.now() / 10800000)}`).then((t) => ((cloudSource = 'live'), t)).catch(() => null);
  }
  if (!cloudTex) cloudTex = await loadTexture(tex('clouds.png')).then((t) => ((cloudSource = 'built-in'), t)).catch(() => null);

  let clouds = null;
  let raf = 0;
  let globeRef = null;

  function updateSun() {
    if (!globeRef) return;
    const s = subsolarPoint();
    const c = globeRef.getCoords(s.lat, s.lng, 0);
    uniforms.sunDir.value.set(c.x, c.y, c.z).normalize();
  }

  return {
    material,
    cloudSource: () => cloudSource,
    attach(globe) {
      globeRef = globe;
      updateSun();
      if (cloudTex) {
        const R = globe.getGlobeRadius();
        const cloudMat = new THREE.ShaderMaterial({
          uniforms: { cloudTex: { value: cloudTex }, sunDir: uniforms.sunDir },
          vertexShader: EARTH_VERT,
          fragmentShader: CLOUD_FRAG,
          transparent: true,
          depthWrite: false,
        });
        // Reuse the globe's own sphere so the cloud map lines up exactly with the continents
        let earthMesh = null;
        globe.scene().traverse((o) => {
          if (o.isMesh && o.material === material) earthMesh = o;
        });
        if (earthMesh) {
          clouds = new THREE.Mesh(earthMesh.geometry, cloudMat);
          earthMesh.updateWorldMatrix(true, false);
          clouds.applyMatrix4(earthMesh.matrixWorld);
          clouds.scale.multiplyScalar(1.008);
        } else {
          clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.008, 96, 64), cloudMat);
          clouds.rotation.y = -Math.PI / 2;
        }
        clouds.userData.baseY = clouds.rotation.y;
        globe.scene().add(clouds);
      }
      const t0 = performance.now();
      let lastSun = 0;
      const tick = (t) => {
        uniforms.time.value = (t - t0) / 1000;
        if (clouds) clouds.rotation.y = clouds.userData.baseY + Math.sin(uniforms.time.value / 90) * 0.02; // gentle drift
        if (t - lastSun > 30000) {
          updateSun();
          lastSun = t;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    },
    dispose() {
      cancelAnimationFrame(raf);
      if (clouds && globeRef) {
        globeRef.scene().remove(clouds);
        if (clouds.geometry.type === 'SphereGeometry') clouds.geometry.dispose();
        clouds.material.dispose();
      }
      [day, night, water, cloudTex].forEach((t) => t && t.dispose());
      material.dispose();
    },
  };
}
