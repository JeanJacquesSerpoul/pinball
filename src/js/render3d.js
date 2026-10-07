import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const glc = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02020c);
const pmrem = new THREE.PMREMGenerator(renderer);
// Environnement de reflets : studio sombre avec panneaux néon (pour le chrome et la bille)
{
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.MeshBasicMaterial({ color: 0x0a0c22, side: THREE.BackSide }));
  env.add(room);
  const panel = (w, h, color, k, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
  };
  panel(90, 40, 0xfff4e8, 3, 0, 80, 20);        // softbox au plafond
  panel(10, 120, 0x30d8ff, 4, 80, 10, 30);      // néon cyan
  panel(10, 120, 0xff3fc8, 4, -80, 10, -30);    // néon rose
  panel(120, 8, 0xffb020, 3, 0, 20, -90);       // bandeau doré
  panel(60, 20, 0x6a4aff, 2, 30, -40, 80);
  scene.environment = pmrem.fromScene(env, 0.02).texture;
}

const camera = new THREE.PerspectiveCamera(40, STW / STH, 1, 8000);
const V = (x, y, h = 0) => new THREE.Vector3(x - 210, h, y - 390);   // plan 2D -> monde 3D
const rand = (a, b) => a + Math.random() * (b - a);

/* ---------- Textures procédurales ---------- */
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
}
const glowTex = canvasTex(64, 64, c => {
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.2, 'rgba(255,255,255,.8)'); g.addColorStop(.5, 'rgba(255,255,255,.2)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
}, false);

/* ---------- Lumières ---------- */
scene.add(new THREE.HemisphereLight(0x8fa0ff, 0x1a0520, 0.35));
const key = new THREE.DirectionalLight(0xfff4e8, 2.0);
key.position.set(-160, 700, 380); key.target.position.set(0, 0, -20);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -330, right: 330, top: 520, bottom: -520, near: 200, far: 1700 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.6;
scene.add(key, key.target);
const rimA = new THREE.PointLight(0xff3fd0, 30000, 0, 2); rimA.position.set(-300, 140, -150); scene.add(rimA);
const rimB = new THREE.PointLight(0x30d8ff, 30000, 0, 2); rimB.position.set(300, 140, 160); scene.add(rimB);
const holeLight = new THREE.PointLight(0xa040ff, 3000, 160, 2); holeLight.position.copy(V(hole.x, hole.y, 20)); scene.add(holeLight);

/* ---------- Matériaux ---------- */
const M = {
  chrome: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: .12 }),
  darkChrome: new THREE.MeshStandardMaterial({ color: 0x8890a8, metalness: 1, roughness: .3 }),
  wall: new THREE.MeshPhysicalMaterial({ color: 0x0b1030, metalness: .3, roughness: .4, clearcoat: 1, clearcoatRoughness: .1, envMapIntensity: .35 }),
  cabinet: new THREE.MeshPhysicalMaterial({ color: 0x5a0814, metalness: .6, roughness: .35, clearcoat: 1, clearcoatRoughness: .06, envMapIntensity: .5 }),
  rubberW: new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: .55 }),
  rubberR: new THREE.MeshStandardMaterial({ color: 0xd0141c, roughness: .45 }),
  black: new THREE.MeshStandardMaterial({ color: 0x050508, roughness: .8 }),
};
const neonMat = c => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: c, emissiveIntensity: 2.2, toneMapped: false });
const glowMat = (c, op = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

/* ---------- Helpers de géométrie ---------- */
function shadowed(m, cast = true) { m.castShadow = cast; m.receiveShadow = true; return m; }
function bar(x1, y1, x2, y2, w, h, mat, y0 = 0) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
  const m = new THREE.Mesh(new THREE.BoxGeometry(L, h, w), mat);
  m.position.copy(V((x1 + x2) / 2, (y1 + y2) / 2, y0 + h / 2)); m.rotation.y = -Math.atan2(dy, dx);
  return shadowed(m);
}
function post(x, y, r, h, mat, y0 = 0, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); m.position.copy(V(x, y, y0 + h / 2)); return shadowed(m);
}
function capsule(s, w, h, mat, y0 = 0) {
  const g = new THREE.Group(); g.add(bar(s.x1, s.y1, s.x2, s.y2, w, h, mat, y0), post(s.x1, s.y1, w / 2, h, mat, y0), post(s.x2, s.y2, w / 2, h, mat, y0)); return g;
}
function extrude(shape, depth, mat, bevel = 0) {   // forme dans le plan (x, y2D) -> volume posé sur la table
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 48 });
  g.rotateX(Math.PI / 2); g.translate(0, depth, 0);
  return shadowed(new THREE.Mesh(g, mat));
}
function tube(points, r, mat) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), points.length * 4, r, 8, false), mat);
}

/* ---------- Plateau ---------- */
const artTex = canvasTex(TW * 4, TH * 4, c => { c.setTransform(4, 0, 0, 4, 0, 0); drawArt(c, false); });
const field = new THREE.Mesh(new THREE.PlaneGeometry(TW, TH).rotateX(-Math.PI / 2),
  new THREE.MeshPhysicalMaterial({ map: artTex, emissive: 0xffffff, emissiveMap: artTex, emissiveIntensity: .75, roughness: .45, clearcoat: .7, clearcoatRoughness: .08, envMapIntensity: .15 }));
field.receiveShadow = true; scene.add(field);
const under = new THREE.Mesh(new THREE.PlaneGeometry(TW + 40, 120).rotateX(-Math.PI / 2), M.black);
under.position.set(0, -.5, 420); scene.add(under);

/* ---------- Murs ---------- */
const arcShape = new THREE.Shape();
arcShape.absarc(0, -190, 204, Math.PI, Math.PI * 2, false);
arcShape.absarc(0, -190, 188, Math.PI * 2, Math.PI, true);
scene.add(extrude(arcShape, 30, M.wall));
const arcPts = []; for (let i = 0; i <= 48; i++) { const a = Math.PI + Math.PI * i / 48; arcPts.push(new THREE.Vector3(189 * Math.cos(a), 30, -190 + 189 * Math.sin(a))); }
const neonCyan = neonMat(0x30e0ff), neonPink = neonMat(0xff3fc8), neonGold = neonMat(0xffb020);
scene.add(tube(arcPts, 1.8, neonCyan));

for (const s of walls) {
  switch (s.kind) {
    case 'arc': case 'drop': case 'fuel': case 'plunger': case 'slingside': case 'sling': break;
    case 'outer': {
      const off = s.x1 < 200 ? -6 : 6;
      scene.add(bar(s.x1 + off, s.y1, s.x2 + off, s.y2, 12, 30, M.wall));
      scene.add(bar(s.x1 + off * .58, s.y1, s.x2 + off * .58, s.y2 - 60, 3, 3, neonPink, 30));
      break;
    }
    case 'gate': scene.add(bar(s.x1, s.y1, s.x2, s.y2, 2.5, 16, M.chrome)); break;
    case 'post': scene.add(capsule(s, 2 * s.r + 2, 20, M.chrome)); scene.add(post(s.x1, s.y1, 3.5, 4, neonCyan, 20)); break;
    default:
      scene.add(capsule(s, 2 * s.r + 1.5, 20, M.chrome));
      if (s.kind === 'rail') scene.add(bar(s.x1, s.y1, s.x2, s.y2, 1.4, 1.2, neonCyan, 20));
  }
}

/* ---------- Meuble ---------- */
const cab = (w, h, d, x, y, z, mat) => { const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)); m.position.set(x, y, z); scene.add(m); return m; };
cab(30, 54, 940, -210 - 7, 27 - 8, 40, M.cabinet);
cab(30, 54, 940, 210 + 7, 27 - 8, 40, M.cabinet);
cab(464, 54, 40, 0, 19, -390 - 18, M.cabinet);
cab(464, 54, 40, 0, 19, 470, M.cabinet);
cab(34, 4, 940, -217, 48, 40, M.chrome); cab(34, 4, 940, 217, 48, 40, M.chrome);
const lockbar = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 470, 32).rotateZ(Math.PI / 2), M.chrome);
lockbar.position.set(0, 52, 460); scene.add(lockbar);
// Tablier (apron) imprimé
const apronTex = canvasTex(704, 130, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1a1f4a'); g.addColorStop(1, '#06081c'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#ffb020'; c.lineWidth = 4; c.strokeRect(6, 6, w - 12, h - 12);
  c.textAlign = 'center'; c.font = 'italic 900 52px "Arial Black",Impact'; c.fillStyle = '#ffd23a'; c.shadowColor = '#ff6a00'; c.shadowBlur = 18;
  c.fillText('SPACE CADET', w / 2, 72); c.shadowBlur = 0;
  c.font = 'bold 20px Tahoma'; c.fillStyle = '#8fd8ff'; c.fillText('3D PINBALL  ·  BILLE SPATIALE', w / 2, 108);
});
const apronMat = new THREE.MeshPhysicalMaterial({ map: apronTex, emissive: 0xffffff, emissiveMap: apronTex, emissiveIntensity: .6, roughness: .3, clearcoat: 1 });
const apron = shadowed(new THREE.Mesh(new THREE.BoxGeometry(352, 22, 66), [M.wall, M.wall, apronMat, M.wall, M.wall, M.wall]));
apron.position.copy(V(196, 776, 11)); scene.add(apron);

/* ---------- Slingshots ---------- */
const slingMeshes = slings.map((s, i) => {
  const xs = i === 0 ? [82, 82, 118] : [MX(82), MX(82), MX(118)], ys = [500, 575, 611];
  const sh = new THREE.Shape(); sh.moveTo(xs[0] - 210, ys[0] - 390); sh.lineTo(xs[1] - 210, ys[1] - 390); sh.lineTo(xs[2] - 210, ys[2] - 390); sh.closePath();
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xff6a10, emissive: 0xff4a00, emissiveIntensity: .5, roughness: .15, clearcoat: 1, transparent: true, opacity: .92 });
  const m = extrude(sh, 15, mat, 1.2); scene.add(m);
  const rub = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .5, emissive: 0xffffff, emissiveIntensity: 0 });
  scene.add(capsule(s, 5, 13, rub, 1));
  for (let k = 0; k < 3; k++) scene.add(post(xs[k], ys[k], 3.5, 34, M.chrome));
  return { mat, rub };
});
// Plastiques transparents imprimés, posés sur les colonnettes (comme sur un vrai flipper)
const plasticTex = canvasTex(256, 256, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#2a6cff'); g.addColorStop(.5, '#9a3cff'); g.addColorStop(1, '#ff3c9a');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(255,255,255,${Math.random() * .8})`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, Math.random() * 2.2, 0, 7); c.fill(); }
  c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 3;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(w * .3, h * .7, 30 + i * 26, -1.2, .4); c.stroke(); }
});
[[[72, 486], [72, 586], [130, 626]], [[MX(72), 486], [MX(72), 586], [MX(130), 626]]].forEach(pts => {
  const sh = new THREE.Shape(); pts.forEach(([x, y], i) => i ? sh.lineTo(x - 210, y - 390) : sh.moveTo(x - 210, y - 390)); sh.closePath();
  const xs_ = pts.map(q => q[0] - 210), ys_ = pts.map(q => q[1] - 390), mnx = Math.min(...xs_), mny = Math.min(...ys_), w = Math.max(...xs_) - mnx, h = Math.max(...ys_) - mny;
  const tex = plasticTex.clone(); tex.needsUpdate = true; tex.repeat.set(1 / w, 1 / h); tex.offset.set(-mnx / w, -mny / h);
  const mat = new THREE.MeshPhysicalMaterial({ map: tex, transparent: true, opacity: .62, roughness: .08, clearcoat: 1, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .25, side: THREE.DoubleSide, depthWrite: false });
  const m = extrude(sh, 1.6, mat); m.position.y = 34; m.castShadow = false; scene.add(m);
  const cx = pts.reduce((a, q) => a + q[0], 0) / 3, cy = pts.reduce((a, q) => a + q[1], 0) / 3;
  const gi = new THREE.PointLight(0xffb070, 2600, 150, 2); gi.position.copy(V(cx, cy, 26)); scene.add(gi);
});
// Lampes d'ambiance (« GI ») en haut de la table
[[70, 150, 0xffb070], [322, 150, 0xffb070], [196, 140, 0x9fc0ff]].forEach(([x, y, c]) => { const l = new THREE.PointLight(c, 2200, 170, 2); l.position.copy(V(x, y, 30)); scene.add(l); });

/* ---------- Bumpers ---------- */
const capTex = canvasTex(256, 256, (c) => {
  const g = c.createRadialGradient(128, 128, 10, 128, 128, 128); g.addColorStop(0, '#ffffff'); g.addColorStop(.55, '#ffe7a0'); g.addColorStop(1, '#ff8a00');
  c.fillStyle = g; c.fillRect(0, 0, 256, 256);
  c.fillStyle = '#d0101a'; c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 42 : 100; c.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); }
  c.fill(); c.fillStyle = '#fff'; c.font = 'bold 44px Arial Black,Impact'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('500', 128, 132);
});
const bumperObjs = bumpers.map(b => {
  const g = new THREE.Group(); g.position.copy(V(b.x, b.y, 0)); scene.add(g);
  const base = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(b.r + 4, b.r + 5, 4, 40), M.darkChrome)); base.position.y = 2; g.add(base);
  const skirtMat = new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x2060ff, emissiveIntensity: .8, roughness: .3 });
  const skirt = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(b.r + 2, b.r + 3, 4, 40), skirtMat)); skirt.position.y = 6; g.add(skirt);
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0xff3020, emissive: 0xff2010, emissiveIntensity: .6, roughness: .1, transmission: 0, clearcoat: 1 });
  const body = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(b.r - 4, b.r - 2, 14, 40), bodyMat)); body.position.y = 15; g.add(body);
  const capSide = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .15, clearcoat: 1, emissive: 0xffaa40, emissiveIntensity: .2 });
  const capTop = new THREE.MeshPhysicalMaterial({ map: capTex, roughness: .15, clearcoat: 1, emissive: 0xffffff, emissiveMap: capTex, emissiveIntensity: .35 });
  const cap = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(b.r + 1, b.r - 1, 5, 40), [capSide, capTop, capSide])); cap.position.y = 24.5; g.add(cap);
  const light = new THREE.PointLight(0xff8030, 0, 200, 2); light.position.y = 34; g.add(light);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffa030, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); halo.scale.set(110, 110, 1); halo.position.y = 18; g.add(halo);
  return { b, g, bodyMat, skirtMat, capTop, cap, light, halo };
});

/* ---------- Cibles ---------- */
const dropMeshes = drops.map(d => {
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffc81a, emissive: 0xffa000, emissiveIntensity: .5, roughness: .2, clearcoat: 1 });
  const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(6, 20, 22), mat)); m.position.copy(V(d.x1, (d.y1 + d.y2) / 2, 10)); scene.add(m); return { d, m, mat };
});
const fuelMeshes = fuels.map(f => {
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xff6a10, emissive: 0xff5000, emissiveIntensity: .5, roughness: .2, clearcoat: 1 });
  const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(5, 18, 22), mat)); m.position.copy(V(f.x1, (f.y1 + f.y2) / 2, 9)); scene.add(m); return { m, mat };
});

/* ---------- Inserts lumineux ---------- */
const domeGeo = new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);
const inserts = [];
function insert(x, y, r, color, on) {
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x151520, emissive: color, emissiveIntensity: .1, roughness: .1, clearcoat: 1, toneMapped: false });
  const m = new THREE.Mesh(domeGeo, mat); m.scale.set(r, r * .4, r); m.position.copy(V(x, y, 0)); scene.add(m);
  const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  h.scale.set(r * 6, r * 6, 1); h.position.copy(V(x, y, 2)); scene.add(h);
  inserts.push({ mat, h, on, lvl: 0, i: inserts.length });
}
const blink = (hz = 4) => Math.floor(G.t * hz) % 2 === 0;
lanesPos.forEach((x, i) => insert(x, 95, 6, 0x30e0ff, () => G.lanes[i]));
multPos.forEach((x, i) => insert(x, 480, 9, 0xffd000, () => G.mult >= i + 2));
drops.forEach((d, i) => insert(116, 301 + i * 25, 5, 0xff2a2a, () => !d.on));
fuels.forEach((f, i) => insert(348, 311 + i * 28, 5, 0xff9010, () => G.fuel[i]));
insert(196, 632, 7, 0x30ff60, () => G.save > 0 && (G.save > 2 || blink(6)));
rankPos.forEach(([x, y], i) => insert(x, y, 4.5, 0xff40c8, () => i <= G.rank));
// Flèches d'orbite
const arrowShape = new THREE.Shape(); arrowShape.moveTo(0, -15); arrowShape.lineTo(10, 6); arrowShape.lineTo(0, 1); arrowShape.lineTo(-10, 6); arrowShape.closePath();
const arrowMats = [40, 352].map(x => {
  const mat = new THREE.MeshStandardMaterial({ color: 0x050a10, emissive: 0x30e0ff, emissiveIntensity: .1, toneMapped: false });
  const m = extrude(arrowShape, .6, mat); m.position.x += x - 210; m.position.z += 280 - 390; scene.add(m); return mat;
});

/* ---------- Trou noir (shader) ---------- */
const vortexMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uTime: { value: 0 }, uBoost: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uBoost;
    void main(){
      vec2 p=vUv*2.0-1.0; float r=length(p); float a=atan(p.y,p.x);
      float s=sin(a*3.0+9.0*log(r+0.04)-uTime*(3.0+uBoost*10.0));
      float arms=smoothstep(0.1,1.0,s);
      float ring=smoothstep(1.0,0.45,r)*smoothstep(0.12,0.38,r);
      vec3 col=mix(vec3(0.45,0.08,1.0),vec3(0.2,0.85,1.0),arms*0.7);
      col*= (0.5+arms*2.6)*(1.0+uBoost*2.5);
      float alpha=ring*(0.25+arms*0.75);
      float core=smoothstep(0.36,0.22,r);
      col=mix(col,vec3(0.0),core); alpha=max(alpha,core);
      float rim=smoothstep(0.05,0.0,abs(r-0.38))*1.5; col+=vec3(0.8,0.5,1.0)*rim*(1.0+uBoost);
      gl_FragColor=vec4(col,alpha);
    }`,
});
const vortex = new THREE.Mesh(new THREE.PlaneGeometry(76, 76).rotateX(-Math.PI / 2), vortexMat);
vortex.position.copy(V(hole.x, hole.y, .6)); scene.add(vortex);
const holeRingMat = glowMat(0xc060ff, 0);
const holeRing = new THREE.Mesh(new THREE.TorusGeometry(24, 1.2, 8, 64).rotateX(Math.PI / 2), holeRingMat);
holeRing.position.copy(V(hole.x, hole.y, 2)); scene.add(holeRing);

/* ---------- Flippers ---------- */
function flipShape(L, r1, r2) {
  const s = new THREE.Shape(); s.absarc(0, 0, r1, Math.PI / 2, Math.PI * 1.5, false); s.lineTo(L, -r2); s.absarc(L, 0, r2, -Math.PI / 2, Math.PI / 2, false); s.lineTo(0, r1); return s;
}
const flipBody = new THREE.MeshPhysicalMaterial({ color: 0xf4f6ff, roughness: .18, clearcoat: 1, clearcoatRoughness: .05 });
const flipObjs = [flL, flR].map(f => {
  const g = new THREE.Group(); g.position.copy(V(f.x, f.y, 0)); scene.add(g);
  const body = extrude(flipShape(f.len, 7.5, 4.2), 14, flipBody, .8); body.position.y = 1; g.add(body);
  const rub = extrude(flipShape(f.len, 8.9, 5.4), 6, M.rubberR); rub.position.y = 5; g.add(rub);
  const capm = post(f.x, f.y, 4, 3, M.chrome, 16); capm.position.set(0, 17.5, 0); g.add(capm);
  return { f, g };
});

/* ---------- Lanceur ---------- */
const plungerG = new THREE.Group(); scene.add(plungerG);
const knob = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 8, 32).rotateX(Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xff2a2a, roughness: .2, clearcoat: 1 })));
knob.position.set(0, 9, 4); plungerG.add(knob);
const rod = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 90, 16).rotateX(Math.PI / 2), M.chrome)); rod.position.set(0, 9, 50); plungerG.add(rod);
const springPts = []; for (let i = 0; i <= 160; i++) { const t = i / 160, a = t * Math.PI * 2 * 12; springPts.push(new THREE.Vector3(Math.cos(a) * 7, 9 + Math.sin(a) * 7, t * 60)); }
const spring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(springPts), 400, .9, 6, false), M.chrome);
scene.add(spring);

/* ---------- Bille chromée avec reflets temps réel ---------- */
const cubeRT = new THREE.WebGLCubeRenderTarget(256, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
const cubeCam = new THREE.CubeCamera(2, 3000, cubeRT); scene.add(cubeCam);
const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: .14, envMap: cubeRT.texture, envMapIntensity: 1.1 }));
ballMesh.castShadow = true; scene.add(ballMesh);
const ballGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x80c8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
ballGlow.scale.set(60, 60, 1); scene.add(ballGlow);
const contactTex = canvasTex(64, 64, c => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,.85)'); g.addColorStop(.45, 'rgba(0,0,0,.4)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }, false);
const contact = new THREE.Mesh(new THREE.PlaneGeometry(26, 26).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false }));
contact.renderOrder = 1; scene.add(contact);
let ballFx = 0;   // intensité lissée du halo et de la traînée (évite le scintillement)

// Traînée de comète
const TRN = 34, trailPos = new Float32Array(TRN * 3), trailCol = new Float32Array(TRN * 3), hist = [];
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3)); trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
const trail = new THREE.Points(trailGeo, new THREE.PointsMaterial({ size: 17, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
trail.frustumCulled = false; scene.add(trail);

/* ---------- Particules ---------- */
const PN = 1600, pPos = new Float32Array(PN * 3).fill(-1e4), pCol = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pBase = new Float32Array(PN * 3), pLife = new Float32Array(PN), pMax = new Float32Array(PN), pGrav = new Float32Array(PN);
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const parts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 7, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
parts.frustumCulled = false; scene.add(parts);
let pi = 0;
const tmpC = new THREE.Color();
function spawn(p, v, color, life, grav = 700) {
  if (Q.particles < 1 && Math.random() > Q.particles) return;
  const k = pi++ % PN, k3 = k * 3;
  pPos[k3] = p.x; pPos[k3 + 1] = p.y; pPos[k3 + 2] = p.z; pVel[k3] = v.x; pVel[k3 + 1] = v.y; pVel[k3 + 2] = v.z;
  tmpC.set(color); pBase[k3] = tmpC.r * 3; pBase[k3 + 1] = tmpC.g * 3; pBase[k3 + 2] = tmpC.b * 3;
  pLife[k] = pMax[k] = life; pGrav[k] = grav;
}
const _v = new THREE.Vector3();
function burstW(p, n, color, spd, up = 1, life = .9) {
  for (let i = 0; i < n; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * .5 * up, s = spd * rand(.3, 1);
    _v.set(Math.cos(th) * Math.cos(ph) * s, Math.sin(ph) * s * 1.3 + 40, Math.sin(th) * Math.cos(ph) * s);
    spawn(p, _v, Array.isArray(color) ? color[i % color.length] : color, rand(.4, life));
  }
}
const burst = (x, y, n, c, s, h = 10, up = 1, life) => burstW(V(x, y, h), n, c, s, up, life);
function updParts(dt) {
  for (let k = 0; k < PN; k++) {
    if (pLife[k] <= 0) continue;
    const k3 = k * 3;
    pLife[k] -= dt;
    if (pLife[k] <= 0) { pPos[k3 + 1] = -1e4; continue; }
    pVel[k3 + 1] -= pGrav[k] * dt;
    pPos[k3] += pVel[k3] * dt; pPos[k3 + 1] += pVel[k3 + 1] * dt; pPos[k3 + 2] += pVel[k3 + 2] * dt;
    if (pPos[k3 + 1] < 1 && pGrav[k] > 0) { pPos[k3 + 1] = 1; pVel[k3 + 1] *= -.4; pVel[k3] *= .7; pVel[k3 + 2] *= .7; }
    const f = pLife[k] / pMax[k], b = f * f;
    pCol[k3] = pBase[k3] * b; pCol[k3 + 1] = pBase[k3 + 1] * b; pCol[k3 + 2] = pBase[k3 + 2] * b;
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
}
// Ondes de choc
const shocks = Array.from({ length: 12 }, () => {
  const m = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 64).rotateX(-Math.PI / 2), glowMat(0xffffff, 0)); m.visible = false; scene.add(m); m.userData = { t: 9, size: 60 }; return m;
});
let si = 0;
function shock(x, y, color, size = 60, h = 3) {
  const m = shocks[si++ % shocks.length]; m.position.copy(V(x, y, h)); m.material.color.set(color).multiplyScalar(2.5); m.userData.t = 0; m.userData.size = size; m.visible = true;
}
function updShocks(dt) {
  for (const m of shocks) {
    if (!m.visible) continue; const u = m.userData; u.t += dt; const k = u.t / .5;
    if (k >= 1) { m.visible = false; continue; }
    const s = 4 + u.size * (1 - Math.pow(1 - k, 3)); m.scale.set(s, 1, s); m.material.opacity = (1 - k);
  }
}

/* ---------- Décor spatial : étoiles, nébuleuses, planète, fusée ---------- */
{
  const n = 3500, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.acos(rand(-.2, 1)), r = rand(2500, 4000);
    pos.set([Math.sin(ph) * Math.cos(th) * r, Math.cos(ph) * r * .8 - 300, Math.sin(ph) * Math.sin(th) * r], i * 3);
    tmpC.setHSL(rand(.55, .75), .6, rand(.6, 1)); col.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false })));
  [[-1400, 300, -2600, 0x6020a0, 2600], [1500, -200, -2400, 0x103a90, 2400], [0, 900, -3000, 0xa02060, 2200]].forEach(([x, y, z, c, s]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: c, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.position.set(x, y, z); sp.scale.set(s, s, 1); scene.add(sp);
  });
}
const planetTex = canvasTex(1024, 512, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h);
  ['#1b1450', '#3a2a8a', '#7a4ab8', '#d07a5a', '#f2c27a', '#7a4ab8', '#2a3a9a', '#141040'].forEach((col, i, a) => g.addColorStop(i / (a.length - 1), col));
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(${rand(150, 255) | 0},${rand(100, 200) | 0},${rand(150, 255) | 0},${rand(.03, .12)})`; c.fillRect(0, rand(0, h), w, rand(1, 8)); }
  for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${rand(.03, .08)})`; c.beginPath(); c.ellipse(rand(0, w), rand(0, h), rand(20, 90), rand(4, 12), 0, 0, Math.PI * 2); c.fill(); }
});
const planet = new THREE.Group(); planet.position.set(40, 170, -760); scene.add(planet);
const planetMesh = new THREE.Mesh(new THREE.SphereGeometry(140, 64, 48), new THREE.MeshStandardMaterial({ map: planetTex, roughness: .8, emissive: 0x302060, emissiveIntensity: .35 }));
planet.add(planetMesh);
const ringTex = canvasTex(512, 512, (c) => {
  for (let r = 150; r < 256; r += 1) { c.strokeStyle = `rgba(${200 + rand(0, 55) | 0},${150 + rand(0, 80) | 0},${120 + rand(0, 60) | 0},${(Math.sin(r * .35) * .5 + .5) * .55 * (r < 170 ? (r - 150) / 20 : 1)})`; c.lineWidth = 1.2; c.beginPath(); c.arc(256, 256, r, 0, Math.PI * 2); c.stroke(); }
});
const rings3D = new THREE.Mesh(new THREE.RingGeometry(170, 290, 128), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
rings3D.rotation.x = -Math.PI / 2 + .35; rings3D.rotation.y = .25; planet.add(rings3D);
// Coordonnées UV radiales pour l'anneau
{ const g = rings3D.geometry, p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); uv.setXY(i, .5 + x / 580, .5 + y / 580); } }
const atmo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x6a4aff, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false }));
atmo.scale.set(480, 480, 1); planet.add(atmo);

const rocket = new THREE.Group(); scene.add(rocket);
{
  const prof = [[0, 0], [9, 2], [12, 10], [13, 30], [12.5, 50], [10, 62]].map(([r, h]) => new THREE.Vector2(r, h));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), new THREE.MeshStandardMaterial({ color: 0xeef2ff, metalness: .6, roughness: .25 }));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(10, 22, 40), new THREE.MeshStandardMaterial({ color: 0xd8202a, metalness: .4, roughness: .3 })); nose.position.y = 73;
  const win_ = new THREE.Mesh(new THREE.SphereGeometry(4.5, 24, 16), new THREE.MeshStandardMaterial({ color: 0x0a2040, emissive: 0x40b0ff, emissiveIntensity: 3, toneMapped: false })); win_.position.set(0, 44, 11.5);
  rocket.add(body, nose, win_);
  const finShape = new THREE.Shape(); finShape.moveTo(0, 0); finShape.lineTo(14, -8); finShape.lineTo(14, 6); finShape.lineTo(0, 24); finShape.closePath();
  for (let i = 0; i < 3; i++) {
    const fg = new THREE.ExtrudeGeometry(finShape, { depth: 2, bevelEnabled: false }); fg.translate(11, 4, -1);
    const fin = new THREE.Mesh(fg, nose.material); fin.rotation.y = i * Math.PI * 2 / 3; rocket.add(fin);
  }
}
const flame = new THREE.Mesh(new THREE.ConeGeometry(7, 34, 24, 1, true), glowMat(0xff8a20, .9));
flame.rotation.x = Math.PI; flame.position.y = -16; rocket.add(flame);
const flameCore = new THREE.Mesh(new THREE.ConeGeometry(3.5, 20, 16, 1, true), glowMat(0xfff0c0, 1));
flameCore.rotation.x = Math.PI; flameCore.position.y = -9; rocket.add(flameCore);
const rocketLight = new THREE.PointLight(0xff8a30, 20000, 600, 2); rocketLight.position.y = -25; rocket.add(rocketLight);
rocket.scale.setScalar(1.3);

/* ---------- Post-traitement ---------- */
// Cible de rendu multi-échantillonnée : bords nets malgré le post-traitement
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(STW, STH, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(STW, STH), .3, .2, 1.3);
composer.addPass(bloom);
composer.addPass(new OutputPass());
// Étalonnage façon caméra : contraste, saturation, vignettage, légère aberration chromatique et grain
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(STW, STH) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
    void main(){
      vec2 d=vUv-0.5; float r2=dot(d,d); float ca=0.006*r2;
      vec3 col=vec3(texture2D(tDiffuse,vUv+d*ca).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-d*ca).b);
      float l=dot(col,vec3(0.299,0.587,0.114)); col=mix(vec3(l),col,1.12); col=(col-0.5)*1.07+0.5;
      col*=1.0-smoothstep(0.15,0.6,r2*1.5)*0.35;
      float n=fract(sin(dot(vUv*uRes+fract(uTime)*97.0,vec2(12.9898,78.233)))*43758.5453); col+=(n-0.5)*0.022;
      gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);
    }`,
});
composer.addPass(grade);

/* ---------- Effets déclenchés par le jeu ---------- */
const S = { shake: 0, shx: 0, shz: 0, pulse: 0, fov: 0, hole: 0, rocketT: 0, rocketMode: 0, drainT: 0, startT: 0, hyper: 0 };
const ROCKET_HOME = new THREE.Vector3();
function fireworks(n = 6, cols = [0xff40c8, 0x30e0ff, 0xffd000, 0x30ff60]) {
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      const x = rand(60, 340), y = rand(150, 600), c = cols[i % cols.length];
      burstW(V(x, y, rand(60, 140)), 70, [c, 0xffffff], 260, 2, 1.4); shock(x, y, c, 90);
    }, i * 160);
  }
}
window.FX3D = (type, a, b, c) => {
  switch (type) {
    case 'bump': burst(a, b, 36, [0xffd040, 0xff6020, 0xffffff], 260); shock(bumpers[c].x, bumpers[c].y, 0xffa020, 70, 8); S.shake = Math.max(S.shake, 3); S.pulse = Math.max(S.pulse, .35); break;
    case 'sling': burst(a, b, 24, [0xffffff, 0xff8a20], 220, 8); S.shake = Math.max(S.shake, 2.5); break;
    case 'drop': burst(a, b, 34, [0xffd23a, 0xffffff], 200, 10); shock(a, b, 0xffd23a, 40); break;
    case 'fuel': burst(a, b, 22, [0xff8a10, 0xffe0a0], 180, 10); break;
    case 'lane': burst(a, b, 20, 0x30e0ff, 140, 6); shock(a, b, 0x30e0ff, 30); break;
    case 'spark': burst(a, b, Math.min(30, (c - 600) / 40) | 0, [0xffffff, 0xa0d8ff], 160, 6, .6, .5); break;
    case 'hole': S.hole = 1.6; S.pulse = .9;
      for (let i = 0; i < 90; i++) { const th = Math.random() * Math.PI * 2, r = rand(40, 90); const p = V(hole.x + Math.cos(th) * r, hole.y + Math.sin(th) * r, rand(2, 30)); spawn(p, _v.set(-Math.cos(th) * r * 1.6 - Math.sin(th) * 120, -p.y * 1.5, -Math.sin(th) * r * 1.6 + Math.cos(th) * 120), i % 2 ? 0xc060ff : 0x40c8ff, rand(.5, .8), 0); }
      break;
    case 'eject': burst(hole.x, hole.y, 80, [0xc060ff, 0x40c8ff, 0xffffff], 320, 6, 1, 1.1); shock(hole.x, hole.y, 0xc060ff, 120); S.shake = 7; S.pulse = 1; break;
    case 'orbit': S.fov = 1; S.hyper = 1.2; S.pulse = 1.2; S.shake = 4;
      for (let i = 0; i < 140; i++) { const a = Math.PI + Math.PI * Math.random(), p = V(210 + 175 * Math.cos(a), 200 + 175 * Math.sin(a), rand(5, 40)); spawn(p, _v.set(-Math.sin(a) * 600, rand(0, 60), Math.cos(a) * 600), i % 3 ? 0x30e0ff : 0xffffff, rand(.3, .7), 0); }
      break;
    case 'mission': fireworks(8); S.pulse = 1.6; S.shake = 6; S.rocketT = 0; S.rocketMode = 1; break;
    case 'rank': fireworks(6, [0xff40c8, 0xffffff, 0xffd000]); S.pulse = 1.3; break;
    case 'drain': S.drainT = 1; S.shake = 5; break;
    case 'tilt': S.shake = 16; break;
    case 'nudge': S.shake = Math.max(S.shake, 5); S.shx = a * 6; S.shz = b * 6; break;
    case 'launch': burst(386, 718, 30 + a * 40 | 0, [0xffffff, 0x80c0ff], 180 + a * 200, 6, .5); S.shake = 1 + a * 4; break;
    case 'start': S.startT = 1; fireworks(4); break;
  }
};

/* ---------- Caméra ---------- */
const camPos = new THREE.Vector3(0, 900, 1100), camLook = new THREE.Vector3(0, 0, -100), tgtPos = new THREE.Vector3(), tgtLook = new THREE.Vector3();
function cameraTarget(t) {
  if (G.state !== 'play') {
    const a = t * .12;
    tgtPos.set(Math.sin(a) * 900, 560 + Math.sin(t * .27) * 120, Math.cos(a) * 900 + 60);
    tgtLook.set(0, 40, -120);
    return;
  }
  const by = ball.live ? ball.y : 650, bx = ball.live ? ball.x : 196;
  if (OPT.zoom && ball.live) {
    // Caméra rapprochée : légèrement derrière et au-dessus de la bille
    // Anticipation : la caméra vise là où va la bille (évite de perdre les flippers quand elle tombe vite)
    const lx = bx + Math.max(-120, Math.min(120, ball.vx * .18)), ly = by + Math.max(-120, Math.min(200, ball.vy * .22));
    const zx = Math.max(-150, Math.min(150, lx - 210)), zz = Math.max(-330, Math.min(220, ly - 390));
    tgtPos.set(zx * .8, 330, zz + 330);
    tgtLook.set(zx * .9, 0, zz + 25);
    return;
  }
  const f = OPT.cam ? Math.min(1, Math.max(0, (by - 120) / 600)) : .75;
  const fx_ = OPT.cam ? (bx - 210) * .12 : 0;
  tgtPos.set(fx_ * .6, 850 - f * 30, 715 + f * 20);
  tgtLook.set(fx_, 0, -135 + f * 55);
}

/* ---------- Boucle de rendu 3D ---------- */
let t3 = 0, frameNo = 0;
const tmpV = new THREE.Vector3();
function render3D(dt, realDt) {
  t3 += realDt;
  const t = G.t;
  const attract = G.state !== 'play';

  // Flippers
  flipObjs.forEach(o => o.g.rotation.y = -o.f.a);
  // Bille
  ballMesh.visible = ball.live;
  if (ball.live) {
    let sc = 1, sink = 0;
    if (ball.cap > 0) { const k = Math.min(1, (1.3 - ball.cap) / .4), out = Math.max(0, 1 - ball.cap / .25); sc = Math.max(.05, 1 - k + out); sink = (1 - sc) * 10; }
    ballMesh.scale.setScalar(sc);
    ballMesh.position.copy(V(ball.x, ball.y, R * sc - sink));
    const sp = Math.hypot(ball.vx, ball.vy);
    ballFx += (Math.min(1, Math.max(0, (sp - 600) / 1000)) - ballFx) * Math.min(1, realDt * 5);
    contact.position.set(ballMesh.position.x, .35, ballMesh.position.z); contact.scale.setScalar(sc); contact.visible = true;
    ballGlow.position.copy(ballMesh.position); ballGlow.material.opacity = ballFx * .15 * sc;
    hist.unshift(ballMesh.position.clone()); if (hist.length > TRN) hist.pop();
    const inten = ballFx * 1.1;
    for (let i = 0; i < TRN; i++) {
      const p = hist[Math.min(i, hist.length - 1)], k = (1 - i / TRN) * inten;
      trailPos.set([p.x, p.y, p.z], i * 3); trailCol.set([.25 * k, .7 * k, 1.4 * k], i * 3);
    }
  } else { contact.visible = false; hist.length = 0; trailCol.fill(0); ballGlow.material.opacity = 0; ballFx = 0; }
  trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.color.needsUpdate = true;

  // Lanceur
  const py = plunger.y1;
  plungerG.position.copy(V(386, py, 0));
  spring.position.copy(V(386, py + 8, 0)); spring.scale.z = Math.max(.2, (800 - (py + 8)) / 60);
  // Cibles
  dropMeshes.forEach(o => { const ty = o.d.on ? 10 : -12; o.m.position.y += (ty - o.m.position.y) * Math.min(1, dt * 18); o.mat.emissiveIntensity = o.d.on ? .5 + (attract ? .3 * Math.sin(t3 * 3) : 0) : .1; });
  fuelMeshes.forEach((o, i) => o.mat.emissiveIntensity = G.fuel[i] ? 3 : .5);
  // Bumpers
  bumperObjs.forEach((o, i) => {
    const fl = Math.max(0, o.b.fl) / .15, chase = attract ? (Math.sin(t3 * 4 + i * 2) > .6 ? .6 : 0) : 0, k = Math.max(fl, chase);
    o.bodyMat.emissiveIntensity = .6 + k * 6; o.capTop.emissiveIntensity = .35 + k * 2.5; o.skirtMat.emissiveIntensity = .8 + k * 4;
    o.light.intensity = k * 30000; o.halo.material.opacity = k * .3; o.cap.position.y = 24.5 - fl * 3;
  });
  slings.forEach((s, i) => { const k = Math.max(0, s.fl) / .12; slingMeshes[i].mat.emissiveIntensity = .5 + k * 5; slingMeshes[i].rub.emissiveIntensity = k * 3; });
  // Inserts
  const dim = G.tilt ? .2 : 1;
  inserts.forEach(o => {
    let on = attract ? ((Math.floor(t3 * 9) + o.i) % 7 < 2) : !!o.on();
    o.lvl += ((on ? 1 : 0) - o.lvl) * Math.min(1, dt * 20 || realDt * 20);
    o.mat.emissiveIntensity = (.08 + o.lvl * 3) * dim; o.h.material.opacity = o.lvl * .3 * dim;
  });
  const m = MISSIONS[G.mIdx % MISSIONS.length];
  const orbOn = (!attract && m.ev === 'orbit' && blink()) || G.orbitFlash > 0 && blink(10) || attract && blink(2);
  arrowMats.forEach(a => a.emissiveIntensity = orbOn ? 5 : .15);
  holeRingMat.opacity = (!attract && m.ev === 'hole') ? (.5 + .5 * Math.sin(t3 * 8)) : S.hole > 0 ? 1 : 0;
  // Trou noir
  S.hole = Math.max(0, S.hole - dt);
  vortexMat.uniforms.uTime.value = t3; vortexMat.uniforms.uBoost.value = S.hole + (ball.cap > 0 ? 1 : 0);
  holeLight.intensity = 3000 + S.hole * 20000;
  // Décor
  planetMesh.rotation.y += realDt * .05; rings3D.rotation.z += realDt * .02;
  const orbitA = t3 * .4;
  ROCKET_HOME.set(planet.position.x + Math.cos(orbitA) * 320, planet.position.y + 40 + Math.sin(orbitA * 1.3) * 50, planet.position.z + Math.sin(orbitA) * 140);
  if (S.rocketMode) {
    S.rocketT += realDt; const k = S.rocketT;
    rocket.position.set(ROCKET_HOME.x * (1 - Math.min(1, k)), 120 + k * k * 260, -500 + k * 60);
    rocket.rotation.set(0, k * 6, 0);
    flame.scale.set(1.6, 2.5 + Math.random(), 1.6);
    if (frameNo % 2 === 0) burstW(rocket.localToWorld(tmpV.set(0, -30, 0)), 6, [0xff8a20, 0xffe0a0], 120, -1, .9);
    if (k > 3.5) S.rocketMode = 0;
  } else {
    rocket.position.lerp(ROCKET_HOME, Math.min(1, realDt * 2));
    rocket.rotation.set(Math.sin(t3) * .15, t3 * .8, -Math.cos(orbitA) * .5 - .3);
    flame.scale.set(1, 1 + Math.random() * .4, 1);
  }
  flameCore.scale.copy(flame.scale);

  updParts(realDt); updShocks(realDt);

  // Caméra
  cameraTarget(t3);
  const sm = 1 - Math.exp(-realDt * (attract ? 1.2 : OPT.zoom ? 7 : 3.2));
  camPos.lerp(tgtPos, sm); camLook.lerp(tgtLook, sm);
  S.shake *= Math.exp(-realDt * 7);
  const sh = OPT.fx ? S.shake : 0;
  camera.position.set(camPos.x + (Math.random() - .5) * sh + S.shx * sh * .3, camPos.y + (Math.random() - .5) * sh, camPos.z + (Math.random() - .5) * sh);
  camera.lookAt(camLook);
  S.shx *= .9;
  S.fov = Math.max(0, S.fov - realDt * 1.4);
  camera.fov = 40 + Math.sin(Math.min(1, S.fov) * Math.PI) * 14; camera.updateProjectionMatrix();

  // Bloom & exposition
  S.pulse = Math.max(0, S.pulse - realDt * 1.8);
  S.drainT = Math.max(0, S.drainT - realDt * .8);
  bloom.strength = .3 + S.pulse * .35;
  renderer.toneMappingExposure = (G.tilt ? .55 : 1.08) * (1 - S.drainT * .45) * (G.paused ? .4 : 1);
  rimA.intensity = 30000 * (1 + S.pulse); rimB.intensity = 30000 * (1 + S.pulse);

  autoQuality(realDt);
  renderer.shadowMap.needsUpdate = Q.shadows > 0;
  grade.uniforms.uTime.value = t3;
  composer.render();

  // Reflets dynamiques de la bille (1 image sur 2)
  frameNo++;
  if (ball.live && frameNo % Q.cubeEvery === 0) {
    ballMesh.visible = false; trail.visible = false; ballGlow.visible = false;
    cubeCam.position.copy(ballMesh.position); cubeCam.update(renderer, scene);
    ballMesh.visible = true; trail.visible = true; ballGlow.visible = true;
  }
}
/* ---------- Qualité graphique ---------- */
// haute : tout activé ; moyenne : résolution et ombres réduites, reflets 1 image sur 2 ;
// basse : pas d'ombres ni de halo, reflets 1 image sur 4, moins de particules.
const QUALITY = {
  high: { res: 1, shadows: 2048, bloom: true, cubeEvery: 1, particles: 1 },
  medium: { res: .75, shadows: 1024, bloom: true, cubeEvery: 2, particles: .6 },
  low: { res: .55, shadows: 0, bloom: false, cubeEvery: 4, particles: .3 },
};
let autoLevel = 'high', Q = QUALITY.high, lastK = K;
const fpsMeter = { t: 0, n: 0, warm: 3 };   // warm : délai avant mesure (compilation des shaders)
function qualityLevel() { return OPT.quality === 'auto' ? autoLevel : OPT.quality; }
function applyQuality() {
  Q = QUALITY[qualityLevel()];
  const wantShadows = Q.shadows > 0;
  if (renderer.shadowMap.enabled !== wantShadows) {
    renderer.shadowMap.enabled = wantShadows;
    scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); });
  }
  if (wantShadows && key.shadow.mapSize.x !== Q.shadows) {
    key.shadow.mapSize.set(Q.shadows, Q.shadows);
    if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
  }
  bloom.enabled = Q.bloom;
  fpsMeter.t = fpsMeter.n = 0; fpsMeter.warm = 3;
  resize3D(lastK);
}
// Mode automatique : baisse la qualité si la fluidité chute durablement sous 45 images/s
function autoQuality(realDt) {
  if (OPT.quality !== 'auto' || G.paused || !OPT.view3d || realDt <= 0 || realDt > .25) return;
  if (fpsMeter.warm > 0) { fpsMeter.warm -= realDt; return; }
  fpsMeter.t += realDt; fpsMeter.n++;
  if (fpsMeter.t < 3) return;
  const fps = fpsMeter.n / fpsMeter.t; fpsMeter.t = fpsMeter.n = 0;
  const next = { high: 'medium', medium: 'low' }[autoLevel];
  if (fps < 45 && next) { autoLevel = next; applyQuality(); msg('QUALITÉ AJUSTÉE', `${QUALITY_NAMES[next].toLowerCase()} (${fps.toFixed(0)} images/s)`, 2.5); }
}
function resize3D(k) {
  lastK = k; k = Math.max(.5, k * Q.res);
  renderer.setPixelRatio(k); renderer.setSize(STW, STH, false);
  composer.setPixelRatio(k); composer.setSize(STW, STH);
  grade.uniforms.uRes.value.set(STW * k, STH * k);
}

/* ---------- Activation ---------- */
applyQuality();
window.R3D = { render: render3D, resize: resize3D, applyQuality };
applyView();
window.__pb = { THREE, scene, camera, renderer, bloom };
