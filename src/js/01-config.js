"use strict";
/* =====================================================================
   3D Pinball – Space Cadet (recréation hommage)
   Logique + physique 2D (plan de la table) ; rendu 3D Three.js plus bas,
   avec repli automatique sur un rendu Canvas 2D.
   ===================================================================== */
const TW = 420, TH = 780, R = 8, GRAV = 1150, MAXV = 2300, DT = 1 / 480;
const STW = 600, STH = 780;
const cv = document.getElementById('table'), ctx = cv.getContext('2d');
const st = document.createElement('canvas'), sctx = st.getContext('2d');
let K = 1;

/* ---------------- Géométrie de la table ---------------- */
const walls = [];
function wall(x1, y1, x2, y2, o) { const s = Object.assign({ x1, y1, x2, y2, e: .45, r: 2, on: true, kind: 'wall' }, o); walls.push(s); return s; }
const MX = x => 392 - x;              // miroir autour de l'axe central (x = 196)
function both(x1, y1, x2, y2, o) { wall(x1, y1, x2, y2, o); wall(MX(x1), y1, MX(x2), y2, o); }

const ARC = [];
for (let i = 0; i <= 48; i++) { const a = Math.PI + Math.PI * i / 48; ARC.push([210 + 190 * Math.cos(a), 200 + 190 * Math.sin(a)]); }
for (let i = 0; i < 48; i++) wall(ARC[i][0], ARC[i][1], ARC[i + 1][0], ARC[i + 1][1], { kind: 'arc', e: .3 });
wall(20, 200, 20, 810, { kind: 'outer' }); wall(400, 200, 400, 810, { kind: 'outer' }); wall(372, 255, 372, 810, { kind: 'lanewall' });
const gate = wall(372, 255, 400, 226, { kind: 'gate', e: .3 });
const plunger = wall(372, 722, 400, 722, { kind: 'plunger', e: .05 });
both(50, 470, 50, 585, { kind: 'rail' }); both(50, 585, 126, 664, { kind: 'rail' });
// Déflecteurs latéraux : renvoient la bille qui descend le long des murs vers le centre
wall(20, 385, 46, 440, { kind: 'rail', e: .55 }); wall(372, 395, 346, 450, { kind: 'rail', e: .55 });
both(82, 500, 82, 575, { kind: 'slingside' }); both(82, 575, 118, 611, { kind: 'slingside' });
const slings = [wall(118, 611, 82, 500, { kind: 'sling', e: .5, fl: 0 }), wall(MX(118), 611, MX(82), 500, { kind: 'sling', e: .5, fl: 0 })];
const posts = [125, 170, 215, 260].map(x => wall(x, 72, x, 108, { kind: 'post', r: 3 }));
const drops = [0, 1, 2].map(i => wall(95, 290 + i * 25, 95, 312 + i * 25, { kind: 'drop', r: 3, e: .3, idx: i, cd: 0 }));
const fuels = [0, 1, 2].map(i => wall(368, 300 + i * 28, 368, 322 + i * 28, { kind: 'fuel', r: 2, e: .3, idx: i, cd: 0 }));

const bumpers = [{ x: 165, y: 235 }, { x: 245, y: 235 }, { x: 205, y: 305 }].map(b => Object.assign(b, { r: 20, fl: 0 }));
const hole = { x: 300, y: 430, r: 13 };
const lanesPos = [147, 192, 237];
const multPos = [151, 181, 211, 241];
const rankPos = Array.from({ length: 9 }, (_, i) => i < 5 ? [150 + i * 23, 560] : [161 + (i - 5) * 23, 578]);

const flL = { x: 128, y: 672, len: 60, a: .52, rest: .52, up: -.45, w: 0 };
const flR = { x: 264, y: 672, len: 60, a: Math.PI - .52, rest: Math.PI - .52, up: Math.PI + .45, w: 0 };

/* ---------------- État du jeu ---------------- */
const RANKS = ['Cadet', 'Enseigne', 'Lieutenant', 'Capitaine', 'Lieutenant-Commandant', 'Commandant', 'Commodore', 'Amiral', 'Amiral de la Flotte'];
const MISSIONS = [
  { name: 'Lancement', desc: 'Touchez les bumpers', ev: 'bumper', n: 8 },
  { name: 'Entraînement au tir', desc: 'Abattez les cibles', ev: 'drop', n: 3 },
  { name: 'Ravitaillement', desc: 'Touchez les cibles carburant', ev: 'fuel', n: 3 },
  { name: 'Trou noir', desc: 'Entrez dans le trou noir', ev: 'hole', n: 1 },
  { name: 'Hyperespace', desc: 'Faites des orbites', ev: 'orbit', n: 2 },
  { name: 'Reconnaissance', desc: 'Allumez les couloirs du haut', ev: 'lane', n: 3 },
];
let HIGH = 0; try { HIGH = +localStorage.getItem('pinballXP.high') || 0; } catch (e) { }

const G = {
  state: 'attract', paused: false, score: 0, ball: 1, extra: 0, mult: 1, rank: 0,
  mIdx: 0, prog: 0, need: 1, done: 0, tilt: false, tiltMeter: 0, save: 0, saveArmed: false,
  bonusHits: 0, lanes: [0, 0, 0], fuel: [0, 0, 0], charge: 0, charging: false, t: 0, shake: 0, shakeX: 0, shakeY: 0, orbitFlash: 0,
};
const ball = { x: 386, y: 712, vx: 0, vy: 0, inLane: true, fromLane: true, cap: 0, capCd: 0, live: false, sens: {} };
const keys = { left: false, right: false };
const OPT = { sound: true, music: false, cam: true, fx: true, view3d: true, zoom: false, rumble: true, quality: 'auto' };
try { OPT.view3d = localStorage.getItem('pinballXP.view') !== '2d'; OPT.zoom = localStorage.getItem('pinballXP.zoom') === '1'; OPT.quality = localStorage.getItem('pinballXP.quality') || 'auto'; } catch (e) { }

/* Effets visuels : relayés au moteur 3D s'il est chargé */
function fx(type, a, b, c) {
  const rb = RUMBLE[type]; if (rb) rumble(...rb);
  if (window.FX3D && OPT.fx && OPT.view3d) window.FX3D(type, a, b, c);
}
// [durée ms, moteur fort, moteur faible] pour chaque événement
const RUMBLE = { bump: [70, .25, .5], sling: [50, .15, .4], drop: [60, .2, .3], hole: [400, .4, .2], eject: [150, .6, .4],
  launch: [180, .5, .3], mission: [600, .6, .6], rank: [400, .4, .5], drain: [500, .8, .3], tilt: [800, 1, 1], nudge: [120, .5, .2] };
function rumble(ms, strong, weak) {
  if (!OPT.rumble) return;
  for (const gp of navigator.getGamepads ? navigator.getGamepads() : []) {
    if (gp && gp.vibrationActuator) gp.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => { });
  }
}
function banner(text, color = '#38e0ff', sub = '') {
  if (!OPT.fx) return;
  const el = document.getElementById('banner');
  el.style.setProperty('--c', color); el.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
  el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
}
function flash(color = 'rgba(255,255,255,.8)') {
  if (!OPT.fx) return;
  const el = document.getElementById('flash');
  el.style.background = `radial-gradient(circle at 50% 50%, ${color}, transparent 75%)`;
  el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
}

