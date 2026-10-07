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
  if (msgT > 0 && msgT < 9000) { msgT -= dt; if (msgT <= 0) idleText(); }
  musicAcc += dt; if (musicAcc > .2) { musicAcc = 0; musicTick(); }
}
function frame(now) {
  let dt = Math.min(.05, (now - last) / 1000); last = now;
  const run = !G.paused && !minimized;
  if (run) update(dt);
  pollPad();
  if (!minimized) { if (window.R3D && OPT.view3d) window.R3D.render(run ? dt : 0, dt); else render2D(); }
  updPanel();
  requestAnimationFrame(frame);
}

