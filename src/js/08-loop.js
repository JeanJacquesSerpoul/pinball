/* ---------------- Boucle principale ---------------- */
let last = performance.now(), acc = 0, musicAcc = 0;
// Fait avancer le jeu de dt secondes (physique à pas fixe, minuteries, états). Sans rendu.
function update(dt) {
  G.t += dt;
  if (G.charging) G.charge = Math.min(1, G.charge + dt * 1.1);
  if (G.charging || G.charge) plunger.y1 = plunger.y2 = 722 + G.charge * 26;
  acc += dt;
  while (acc >= DT) { step(DT); acc -= DT; }
  runTimers(dt);
  bumpers.forEach(b => b.fl > 0 && (b.fl -= dt)); slings.forEach(s => s.fl > 0 && (s.fl -= dt));
  if (G.shake > 0) G.shake -= dt;
  if (G.orbitFlash > 0) G.orbitFlash -= dt;
  if (G.save > 0 && ball.live && !ball.inLane && ball.cap <= 0) G.save -= dt;
  G.tiltMeter = Math.max(0, G.tiltMeter - dt * .7);
  if (G.comboT > 0) G.comboT -= dt;
  // Mission chronométrée
  if (G.mTime > 0 && !G.pending && G.state === 'play' && !G.tilt) {
    const before = Math.ceil(G.mTime); G.mTime -= dt;
    if (G.mTime <= 0) missionFailed(); else if (Math.ceil(G.mTime) !== before && msgT <= 0) idleText();
  }
  // Tir d'adresse : le couloir visé change tant que la bille attend dans le lanceur
  if (balls.some(b => b.live && b.inLane && b.fromLane)) { G.skillT += dt; if (G.skillT > .45) { G.skillT = 0; G.skillLane = (G.skillLane + 1) % 3; } }
  if (msgT > 0 && msgT < 9000) { msgT -= dt; if (msgT <= 0) idleText(); }
  musicAcc += dt; if (musicAcc > .2) { musicAcc = 0; musicTick(); }
}

/* ----- Ralenti dramatique : la dernière bille file droit vers la sortie entre les flippers ----- */
function checkSlowmo() {
  if (!OPT.slowmo || G.state !== 'play' || G.tilt || G.save > 0 || G.slow > 0) return;
  const live = balls.filter(b => b.live);
  const b = live.length === 1 && live[0];
  if (b && !b.slowDone && b.y > 680 && b.y < 720 && Math.abs(b.x - 196) < 22 && b.vy > 150) {
    b.slowDone = true; G.slow = .9; fx('slowmo'); tone(70, .9, 'sine', .2, 40);
  }
}

/* ----- Rediffusion des dernières secondes après la perte d'une bille ----- */
const REPLAY = { buf: [], active: false, pos: 0, frames: null };
function snapshot() {
  return {
    balls: balls.filter(b => b.live).map(b => ({ x: b.x, y: b.y, h: b.h || 0, cap: b.cap, vx: b.vx, vy: b.vy })),
    fl: flL.a, fr: flR.a, bf: bumpers.map(b => b.fl), sf: slings.map(s => s.fl), drops: drops.map(d => d.on), py: plunger.y1,
  };
}
function startReplay() {
  if (!OPT.replay || REPLAY.buf.length < 90) return;
  REPLAY.frames = REPLAY.buf.slice(-150); REPLAY.buf = []; REPLAY.active = true; REPLAY.pos = 0;
  $('replay').style.display = 'block'; $('stage').classList.add('replaying');
}
function endReplay() {
  REPLAY.active = false; REPLAY.frames = null;
  $('replay').style.display = 'none'; $('stage').classList.remove('replaying');
}
// Affiche une image de la rediffusion en remplaçant temporairement l'état réel du jeu
function renderReplayFrame(dt, draw) {
  REPLAY.pos += dt * 60 * .45;
  const f = REPLAY.frames[Math.floor(REPLAY.pos)];
  if (!f) { endReplay(); return draw(); }
  const real = { balls, ball, fl: flL.a, fr: flR.a, bf: bumpers.map(b => b.fl), sf: slings.map(s => s.fl), drops: drops.map(d => d.on), py: plunger.y1 };
  balls = f.balls.map(o => Object.assign(mkBall(), o, { live: true, inLane: false })); ball = balls[0] || real.ball;
  flL.a = f.fl; flR.a = f.fr; bumpers.forEach((b, i) => b.fl = f.bf[i]); slings.forEach((s, i) => s.fl = f.sf[i]); drops.forEach((d, i) => d.on = f.drops[i]); plunger.y1 = plunger.y2 = f.py;
  try { draw(); } finally {
    balls = real.balls; ball = real.ball; flL.a = real.fl; flR.a = real.fr;
    bumpers.forEach((b, i) => b.fl = real.bf[i]); slings.forEach((s, i) => s.fl = real.sf[i]); drops.forEach((d, i) => d.on = real.drops[i]); plunger.y1 = plunger.y2 = real.py;
  }
}
window.onBallLost = () => later(.6, startReplay);

function frame(now) {
  let dt = Math.min(.05, (now - last) / 1000); last = now;
  const run = !G.paused && !minimized && !REPLAY.active;
  let gdt = dt;
  if (G.slow > 0) { G.slow -= dt; gdt = dt * .3; }
  if (run) {
    checkSlowmo(); update(gdt);
    if (G.state === 'play') { REPLAY.buf.push(snapshot()); if (REPLAY.buf.length > 240) REPLAY.buf.shift(); }
  }
  pollPad();
  const draw = () => { if (window.R3D && OPT.view3d) window.R3D.render(run || REPLAY.active ? gdt * (REPLAY.active ? .45 : 1) : 0, dt); else render2D(); };
  if (!minimized) { if (REPLAY.active) renderReplayFrame(dt, draw); else draw(); }
  updPanel();
  requestAnimationFrame(frame);
}

