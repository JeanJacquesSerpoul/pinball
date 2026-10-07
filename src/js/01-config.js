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

// Rampe métallique surélevée : de l'entrée (derrière les cibles, à gauche) jusqu'au couloir de retour droit.
// Points [x, y, hauteur] ; la bille la parcourt sur rails (trajectoire guidée).
const RAMP_PTS = [[78, 262, 0], [68, 205, 12], [82, 135, 26], [135, 92, 34], [210, 72, 38], [285, 95, 36], [332, 160, 30], [350, 270, 26], [346, 385, 18], [333, 462, 8], [326, 500, 0]];
const RAMP = (() => {   // échantillonnage Catmull-Rom avec longueur cumulée
  const P = RAMP_PTS, out = [];
  const cr = (a, b, c, d, t) => .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < 20; k++) { const t = k / 20; out.push([0, 1, 2].map(j => cr(p0[j], p1[j], p2[j], p3[j], t))); }
  }
  out.push(P[P.length - 1].slice());
  let d = 0; return out.map((p, i) => { if (i) d += Math.hypot(p[0] - out[i - 1][0], p[1] - out[i - 1][1], p[2] - out[i - 1][2]); return { x: p[0], y: p[1], h: p[2], d }; });
})();
const RAMP_LEN = RAMP[RAMP.length - 1].d;
function rampAt(d) {   // position sur la rampe à la distance d
  let i = 1; while (i < RAMP.length - 1 && RAMP[i].d < d) i++;
  const a = RAMP[i - 1], b = RAMP[i], t = Math.min(1, Math.max(0, (d - a.d) / ((b.d - a.d) || 1)));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, h: a.h + (b.h - a.h) * t };
}
const kickPos = [35, 610], lockPos = [[62, 300], [62, 322], [62, 344]], extraPos = [300, 470];

const flL = { x: 128, y: 672, len: 60, a: .52, rest: .52, up: -.45, w: 0 };
const flR = { x: 264, y: 672, len: 60, a: Math.PI - .52, rest: Math.PI - .52, up: Math.PI + .45, w: 0 };

/* ---------------- État du jeu ---------------- */
const RANKS = ['Cadet', 'Enseigne', 'Lieutenant', 'Capitaine', 'Lieutenant-Commandant', 'Commandant', 'Commodore', 'Amiral', 'Amiral de la Flotte'];
// Missions : une ou plusieurs étapes ; « time » = limite en secondes (mission chronométrée)
const MISSIONS = [
  { name: 'Lancement', steps: [{ ev: 'bumper', n: 8, desc: 'Touchez les bumpers' }] },
  { name: 'Entraînement au tir', steps: [{ ev: 'drop', n: 3, desc: 'Abattez les cibles' }] },
  { name: 'Ravitaillement', steps: [{ ev: 'fuel', n: 3, desc: 'Touchez les cibles carburant' }] },
  { name: "Pilote d'essai", steps: [{ ev: 'ramp', n: 2, desc: 'Prenez la rampe' }] },
  { name: 'Trou noir', steps: [{ ev: 'hole', n: 1, desc: 'Entrez dans le trou noir' }] },
  { name: 'Hyperespace', steps: [{ ev: 'orbit', n: 2, desc: 'Faites des orbites' }] },
  { name: 'Reconnaissance', steps: [{ ev: 'lane', n: 3, desc: 'Allumez les couloirs du haut' }] },
  { name: 'Course contre la montre', time: 25, steps: [{ ev: 'bumper', n: 12, desc: 'Bumpers avant la fin du chrono' }] },
  { name: 'Sauvetage', steps: [{ ev: 'hole', n: 1, desc: "Trou noir : récupérez l'équipage" }, { ev: 'ramp', n: 1, desc: 'Rampe : ramenez-le à la base' }] },
  { name: 'Escarmouche', steps: [{ ev: 'sling', n: 6, desc: 'Touchez les slingshots' }] },
  { name: 'Saut hyperspatial', steps: [{ ev: 'orbit', n: 1, desc: 'Faites une orbite' }, { ev: 'hole', n: 1, desc: 'Puis plongez dans le trou noir' }] },
  { name: 'Escorte', steps: [{ ev: 'combo', n: 2, desc: 'Enchaînez des combos (rampe, orbite, trou noir)' }] },
];
// Niveaux de difficulté : pente (gravité), sauvetage de bille (s), billes par partie, tolérance aux secousses
const DIFFS = {
  easy: { name: 'Facile', grav: .85, save: 15, balls: 5, tilt: 4.5 },
  normal: { name: 'Normale', grav: 1, save: 8, balls: 3, tilt: 3.2 },
  hard: { name: 'Difficile', grav: 1.15, save: 4, balls: 3, tilt: 2.4 },
};
const DIFF = () => DIFFS[OPT.diff] || DIFFS.normal;
// Pente effective : difficulté × modificateur éventuel du défi du jour
const gravity = () => DIFF().grav * ((G.mod && G.mod.grav) || 1);
let HIGH = 0; try { HIGH = +localStorage.getItem('pinballXP.high') || 0; } catch (e) { }

const G = {
  state: 'attract', paused: false, score: 0, ball: 1, extra: 0, mult: 1, rank: 0,
  mIdx: 0, prog: 0, need: 1, done: 0, tilt: false, tiltMeter: 0, save: 0, saveArmed: false,
  bonusHits: 0, lanes: [0, 0, 0], fuel: [0, 0, 0], charge: 0, charging: false, t: 0, shake: 0, shakeX: 0, shakeY: 0, orbitFlash: 0,
  step: 0, pending: false, mTime: 0, kickback: true, locks: 0, multi: false, jackpot: 50000, extraLit: false,
  combo: 0, comboT: 0, skillLane: 0, skillT: 0, maxBalls: 3, slow: 0, daily: null, mod: {},
};
// Billes : « ball » désigne la bille en cours de traitement (ou la bille principale), « balls » toutes les billes en jeu
function mkBall() { return { x: 386, y: 712, vx: 0, vy: 0, h: 0, inLane: true, fromLane: true, skill: false, cap: 0, capCd: 0, live: false, sens: {}, ramp: null }; }
let ball = mkBall(), balls = [ball];
const keys = { left: false, right: false };
const OPT = { sound: true, music: false, cam: true, fx: true, view3d: true, zoom: false, rumble: true, quality: 'auto', diff: 'normal', replay: true, slowmo: true, calm: false, text: 'normal' };
try { OPT.view3d = localStorage.getItem('pinballXP.view') !== '2d'; OPT.zoom = localStorage.getItem('pinballXP.zoom') === '1'; OPT.quality = localStorage.getItem('pinballXP.quality') || 'auto'; OPT.diff = localStorage.getItem('pinballXP.diff') || 'normal';
  const calm = localStorage.getItem('pinballXP.calm');
  OPT.calm = calm ? calm === '1' : !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  OPT.text = localStorage.getItem('pinballXP.text') || 'normal';
  OPT.replay = localStorage.getItem('pinballXP.replay') !== '0'; OPT.slowmo = localStorage.getItem('pinballXP.slowmo') !== '0'; } catch (e) { }

/* Effets visuels : relayés au moteur 3D s'il est chargé */
function fx(type, a, b, c) {
  const rb = RUMBLE[type]; if (rb) rumble(...rb);
  if (window.FX3D && OPT.fx && OPT.view3d) window.FX3D(type, a, b, c);
}
// [durée ms, moteur fort, moteur faible] pour chaque événement
const RUMBLE = { kickback: [250, .8, .4], ramp: [200, .3, .5], multiball: [900, .8, .8], jackpot: [700, .9, .9], bump: [70, .25, .5], sling: [50, .15, .4], drop: [60, .2, .3], hole: [400, .4, .2], eject: [150, .6, .4],
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
  if (!OPT.fx || OPT.calm) return;
  const el = document.getElementById('flash');
  el.style.background = `radial-gradient(circle at 50% 50%, ${color}, transparent 75%)`;
  el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
}

