/* ---------------- Entrées ---------------- */
function flip(side, down) {
  const k = side === 'L' ? 'left' : 'right';
  if (keys[k] === down) return;
  keys[k] = down;
  if (down && G.state === 'play' && !G.tilt && !G.paused) {
    SFX.flip(side);
    if (side === 'L') G.lanes.push(G.lanes.shift()); else G.lanes.unshift(G.lanes.pop());
  }
}
function plungeStart() {
  if (G.state !== 'play') { newGame(); return; }
  if (G.paused) return;
  G.charging = true;
}
function plungeEnd() {
  if (!G.charging) return;
  G.charging = false;
  const p = G.charge; G.charge = 0;
  const b = balls.find(b => b.live && b.inLane && b.y > plunger.y1 - 26);
  if (b) {
    b.y = Math.min(b.y, 722 - R - plunger.r - .5);   // le piston revient en position haute
    b.vy = -(520 + 1250 * p); SFX.launch(p); fx('launch', p);
  }
  plunger.y1 = plunger.y2 = 722;
}
const KL = ['KeyZ', 'ShiftLeft', 'ArrowLeft'], KR = ['Slash', 'ShiftRight', 'ArrowRight', 'NumpadDivide'], KP = ['Space', 'Enter', 'ArrowDown'];
addEventListener('keydown', e => {
  if (REPLAY.active) { e.preventDefault(); endReplay(); return; }   // une touche passe la rediffusion
  if (dlgOpen) { if (e.code === 'Enter' || e.code === 'Escape') closeDlg(); e.preventDefault(); return; }
  const c = e.code;
  if (c === 'F2') { e.preventDefault(); newGame(); return; }
  if (c === 'F3') { e.preventDefault(); togglePause(); return; }
  if (c === 'F1') { e.preventDefault(); showHelp(); return; }
  if (c === 'F4') { e.preventDefault(); toggleFull(); return; }
  if (c === 'F6') { e.preventDefault(); setView(!OPT.view3d); return; }
  if (c === 'F7') { e.preventDefault(); toggleZoom(); return; }
  if (KL.includes(c) || e.key === 'z' || e.key === 'Z') { e.preventDefault(); flip('L', true); }
  else if (KR.includes(c) || e.key === '/' || e.key === ':') { e.preventDefault(); flip('R', true); }
  else if (KP.includes(c)) { e.preventDefault(); if (!e.repeat) plungeStart(); }
  else if (!e.repeat && (c === 'KeyX' || e.key === 'x')) nudge(1, 0);
  else if (!e.repeat && (c === 'Period' || e.key === '.' || c === 'NumpadDecimal')) nudge(-1, 0);
  else if (!e.repeat && c === 'ArrowUp') { e.preventDefault(); nudge(0, -1); }
});
addEventListener('keyup', e => {
  const c = e.code;
  if (KL.includes(c) || e.key === 'z' || e.key === 'Z') flip('L', false);
  else if (KR.includes(c) || e.key === '/' || e.key === ':') flip('R', false);
  else if (KP.includes(c)) plungeEnd();
});
// Tactile / souris sur la zone de jeu
// Commandes à la souris et au toucher.
// Souris : clic gauche = flipper gauche, clic droit = flipper droit, clic molette = lanceur
// (clic gauche sur le lanceur quand la bille l'attend). Toucher : moitié gauche / droite de la table.
const stage = $('stage'), holds = new Map();   // source (doigt ou bouton) -> rôle 'L' | 'R' | 'P'
function holdStart(id, role) {
  holds.set(id, role);
  if (role === 'P') plungeStart(); else flip(role, true);
}
function holdEnd(id) {
  const role = holds.get(id); if (!role) return; holds.delete(id);
  if (role === 'P') plungeEnd(); else if (![...holds.values()].includes(role)) flip(role, false);
}
function inPlungerZone(e) {
  const r = stage.getBoundingClientRect();
  return balls.some(b => b.live && b.inLane) && (e.clientX - r.left) / r.width > .75 && (e.clientY - r.top) / r.height > .6;
}
stage.addEventListener('mousedown', e => {
  e.preventDefault(); audio();
  if (REPLAY.active) { endReplay(); return; }
  if (G.state !== 'play') { if (e.button === 0) newGame(); return; }
  const role = e.button === 2 ? 'R' : e.button === 1 ? 'P' : e.button === 0 ? (inPlungerZone(e) ? 'P' : 'L') : null;
  if (role) holdStart('m' + e.button, role);
});
addEventListener('mouseup', e => holdEnd('m' + e.button));   // relâché même hors de la table
stage.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') return;                      // la souris passe par mousedown
  e.preventDefault(); try { stage.setPointerCapture(e.pointerId); } catch (_) { } audio();
  if (REPLAY.active) { endReplay(); return; }
  if (G.state !== 'play') { newGame(); return; }
  const r = stage.getBoundingClientRect();
  holdStart('p' + e.pointerId, inPlungerZone(e) ? 'P' : (e.clientX - r.left) / r.width < .5 ? 'L' : 'R');
});
const ptrUp = e => { if (e.pointerType !== 'mouse') holdEnd('p' + e.pointerId); };
stage.addEventListener('pointerup', ptrUp); stage.addEventListener('pointercancel', ptrUp);
addEventListener('blur', () => [...holds.keys()].forEach(holdEnd));

/* ---------------- Manette (Xbox et toute manette au format standard) ----------------
   LB / LT / croix gauche : flipper gauche      RB / RT / croix droite : flipper droit
   A (maintenir) : lanceur, ou nouvelle partie   X / B / Y : secouer à gauche / droite / haut
   Start (Menu) : pause / nouvelle partie        Back (Affichage) : 2D / 3D   Stick droit clic : zoom */
const padPrev = {};
function padPressed(b) { return b && (b.pressed || b.value > .3); }
function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of pads) {
    if (!gp || !gp.connected) continue;
    const prev = padPrev[gp.index] || (padPrev[gp.index] = {}), B = gp.buttons;
    const state = {
      L: padPressed(B[4]) || padPressed(B[6]) || padPressed(B[14]) || gp.axes[0] < -.6,
      R: padPressed(B[5]) || padPressed(B[7]) || padPressed(B[15]) || gp.axes[0] > .6,
      A: padPressed(B[0]), X: padPressed(B[2]), Bn: padPressed(B[1]), Y: padPressed(B[3]),
      start: padPressed(B[9]), back: padPressed(B[8]), rs: padPressed(B[11]),
    };
    const edge = k => state[k] && !prev[k], id = 'g' + gp.index;
    if (REPLAY.active && Object.keys(state).some(edge)) { endReplay(); Object.assign(prev, state); continue; }
    if (!dlgOpen) {
      ['L', 'R'].forEach(k => { if (edge(k) && G.state === 'play') holdStart(id + k, k); else if (!state[k] && prev[k]) holdEnd(id + k); });
      if (edge('A')) holdStart(id + 'A', 'P'); else if (!state.A && prev.A) holdEnd(id + 'A');
      if (edge('X')) nudge(1, 0);
      if (edge('Bn')) nudge(-1, 0);
      if (edge('Y')) nudge(0, -1);
      if (edge('start')) { if (G.state === 'play') togglePause(); else newGame(); }
      if (edge('back')) setView(!OPT.view3d);
      if (edge('rs')) toggleZoom();
    } else if (edge('A') || edge('start') || edge('Bn')) closeDlg();
    Object.assign(prev, state);
  }
}
addEventListener('gamepadconnected', e => {
  msg('MANETTE CONNECTÉE', (e.gamepad?.id || '').replace(/\(.*\)/, '').trim().slice(0, 40), 3);
  banner('MANETTE CONNECTÉE', '#3cff6a', 'LB / RB : FLIPPERS · A : LANCEUR');
  rumble(250, .5, .5);
});
addEventListener('gamepaddisconnected', e => { holdEnd('g' + e.gamepad.index + 'L'); holdEnd('g' + e.gamepad.index + 'R'); holdEnd('g' + e.gamepad.index + 'A'); delete padPrev[e.gamepad.index]; msg('MANETTE DÉCONNECTÉE', '', 2); });
stage.addEventListener('contextmenu', e => e.preventDefault());

function togglePause() { if (G.state !== 'play') return; G.paused = !G.paused; if (G.paused) msg('PAUSE', 'F3 pour reprendre', 9999); else { msgT = 0; idleText(); } }
addEventListener('blur', () => { if (G.state === 'play' && !G.paused) togglePause(); keys.left = keys.right = false; });

