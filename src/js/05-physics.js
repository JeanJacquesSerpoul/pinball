/* ---------------- Physique ---------------- */
function closest(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
  let t = ((px - x1) * dx + (py - y1) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return [x1 + t * dx, y1 + t * dy, t];
}
function hitSeg(s) {
  const [cx, cy] = closest(ball.x, ball.y, s.x1, s.y1, s.x2, s.y2);
  let nx = ball.x - cx, ny = ball.y - cy; const d = Math.hypot(nx, ny), rr = R + s.r;
  if (d >= rr || d === 0) return;
  nx /= d; ny /= d; ball.x = cx + nx * rr; ball.y = cy + ny * rr;
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn >= 0) return;
  ball.vx -= (1 + s.e) * vn * nx; ball.vy -= (1 + s.e) * vn * ny;
  onHit(s, -vn, nx, ny, cx, cy);
}
function onHit(s, v, nx, ny, cx, cy) {
  switch (s.kind) {
    case 'sling':
      if (v > 50) { ball.vx += nx * 430; ball.vy += ny * 430; s.fl = .12; add(100); G.bonusHits++; SFX.sling(); fx('sling', cx, cy); ev('sling'); }
      break;
    case 'drop':
      if (!G.tilt) {
        s.on = false; add(1500); G.bonusHits++; SFX.drop(); ev('drop'); fx('drop', cx, cy);
        if (drops.every(d => !d.on)) {
          add(25000); msg('CIBLES ABATTUES !', 'Kickback allumé', 2); SFX.big(); banner('CIBLES ABATTUES', '#ffd23a', '+25 000 · KICKBACK'); G.kickback = true;
          const reset = () => { if (balls.some(b => b.x > 70 && b.x < 125 && b.y > 270 && b.y < 385)) later(.5, reset); else drops.forEach(d => d.on = true); };
          later(1.5, reset);
        }
      }
      break;
    case 'fuel':
      if (v > 40 && s.cd <= 0) {
        s.cd = .25; G.bonusHits++; fx('fuel', cx, cy);
        if (!G.fuel[s.idx]) { G.fuel[s.idx] = 1; add(2000); SFX.fuel(); ev('fuel'); }
        else { add(500); tone(500, .05); }
        if (G.fuel.every(f => f)) { add(15000); msg('PLEIN DE CARBURANT !', '+15 000', 2); SFX.big(); banner('PLEIN DE CARBURANT', '#ff9a1a', '+15 000'); later(1, () => G.fuel = [0, 0, 0]); }
      }
      break;
    default:
      if (v > 220) { SFX.wall(v); if (v > 700) fx('spark', cx, cy, v); }
  }
}
function hitFlipper(f) {
  const tx = f.x + Math.cos(f.a) * f.len, ty = f.y + Math.sin(f.a) * f.len;
  const [cx, cy, t] = closest(ball.x, ball.y, f.x, f.y, tx, ty);
  const rad = 8.5 - 3.5 * t;
  let nx = ball.x - cx, ny = ball.y - cy; const d = Math.hypot(nx, ny), rr = R + rad;
  if (d >= rr || d === 0) return;
  nx /= d; ny /= d; ball.x = cx + nx * rr; ball.y = cy + ny * rr;
  const rx = cx - f.x, ry = cy - f.y, fvx = -f.w * ry, fvy = f.w * rx;
  const vn = (ball.vx - fvx) * nx + (ball.vy - fvy) * ny;
  if (vn < 0) { ball.vx -= 1.32 * vn * nx; ball.vy -= 1.32 * vn * ny; if (vn < -900) fx('spark', cx, cy, -vn); }
}
function hitBumper(b, i) {
  let nx = ball.x - b.x, ny = ball.y - b.y; const d = Math.hypot(nx, ny), rr = R + b.r;
  if (d >= rr || d === 0) return;
  nx /= d; ny /= d; ball.x = b.x + nx * rr; ball.y = b.y + ny * rr;
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn < 0) { ball.vx -= 1.6 * vn * nx; ball.vy -= 1.6 * vn * ny; }
  ball.vx += nx * 320; ball.vy += ny * 320;
  b.fl = .15; add(500 * (G.mod.bump || 1)); G.jackpot += 250; G.bonusHits++; SFX.bump(); ev('bumper');
  fx('bump', b.x - nx * b.r, b.y - ny * b.r, i);
}
function updFlipper(f, pressed, dt) {
  const target = pressed ? f.up : f.rest, prev = f.a, dir = Math.sign(target - f.a);
  f.a += dir * (pressed ? 26 : 15) * dt;
  if ((dir > 0 && f.a > target) || (dir < 0 && f.a < target)) f.a = target;
  f.w = (f.a - prev) / dt;
}
function sensor(id, inside, fn) { if (inside) { if (!ball.sens[id]) { ball.sens[id] = 1; fn(); } } else ball.sens[id] = 0; }

function step(dt) {
  const canFlip = G.state === 'play' && !G.tilt;
  updFlipper(flL, keys.left && canFlip, dt);
  updFlipper(flR, keys.right && canFlip, dt);
  drops.forEach(d => d.cd > 0 && (d.cd -= dt)); fuels.forEach(d => d.cd > 0 && (d.cd -= dt));
  for (const b of balls.slice()) { ball = b; stepBall(dt); }
  ballCollisions();
  ball = balls.find(b => b.live) || balls[0] || ball;
}
// Chocs élastiques entre billes (multibille)
function ballCollisions() {
  for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
    const a = balls[i], b = balls[j];
    if (!a.live || !b.live || a.cap > 0 || b.cap > 0 || a.ramp || b.ramp) continue;
    let nx = b.x - a.x, ny = b.y - a.y; const d = Math.hypot(nx, ny);
    if (d >= 2 * R || d === 0) continue;
    nx /= d; ny /= d; const o = (2 * R - d) / 2;
    a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;
    const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (vn < 0) { const k = vn * .95; a.vx += k * nx; a.vy += k * ny; b.vx -= k * nx; b.vy -= k * ny; if (vn < -300) noise(.03, .12, 3000); }
  }
}
function stepBall(dt) {
  if (!ball.live) return;
  if (ball.cap > 0) {
    ball.cap -= dt;
    if (ball.cap <= 0) { ball.vx = -430 + Math.random() * 60; ball.vy = -140; ball.capCd = .7; SFX.eject(); fx('eject'); }
    return;
  }
  if (ball.capCd > 0) ball.capCd -= dt;

  // Sur la rampe : trajectoire guidée, la bille ralentit en montant et accélère en descendant
  if (ball.ramp) {
    const r = ball.ramp, prev = rampAt(r.d);
    r.v = Math.max(380, Math.min(1500, r.v - (rampAt(r.d + 1).h - prev.h) * GRAV * gravity() * dt * 1.2));
    r.d += r.v * dt;
    if (r.d >= RAMP_LEN) {
      const end = RAMP[RAMP.length - 1];
      Object.assign(ball, { x: end.x, y: end.y, h: 0, vx: 0, vy: 260, ramp: null });
      rampDone();
    } else { const q = rampAt(r.d); ball.vx = (q.x - ball.x) / dt; ball.vy = (q.y - ball.y) / dt; ball.x = q.x; ball.y = q.y; ball.h = q.h; }
    return;
  }

  ball.vy += GRAV * gravity() * dt;
  ball.vx *= .99986; ball.vy *= .99986;
  const sp = Math.hypot(ball.vx, ball.vy); if (sp > MAXV) { ball.vx *= MAXV / sp; ball.vy *= MAXV / sp; }
  ball.x += ball.vx * dt; ball.y += ball.vy * dt;

  gate.on = !ball.inLane;
  for (const s of walls) if (s.on) hitSeg(s);
  bumpers.forEach(hitBumper);
  hitFlipper(flL); hitFlipper(flR);

  if (ball.inLane && ball.x < 366) { ball.inLane = false; ball.skill = ball.fromLane; launched(); }
  // Entrée de la rampe (centre-gauche), bille montante assez rapide
  if (Math.abs(ball.x - RAMP_IN.x) < RAMP_IN.w && Math.abs(ball.y - RAMP_IN.y) < RAMP_IN.h && ball.vy < -250) {
    ball.ramp = { d: 0, v: Math.min(1400, Math.hypot(ball.vx, ball.vy)) }; ball.sens = {};
    tone(500, .3, 'sawtooth', .05, 1400); return;
  }
  lanesPos.forEach((lx, i) => sensor('lane' + i, Math.abs(ball.x - lx) < 18 && Math.abs(ball.y - 95) < 12, () => {
    if (G.tilt) return;
    fx('lane', lx, 95);
    if (ball.skill) {   // tir d'adresse : premier couloir après le lancement = couloir clignotant
      ball.skill = false;
      if (i === G.skillLane) { add(25000); banner("TIR D'ADRESSE", '#30e0ff', '+25 000'); msg("TIR D'ADRESSE !", '+25 000', 2); SFX.rank(); }
    }
    if (!G.lanes[i]) { G.lanes[i] = 1; add(1000); SFX.lane(); ev('lane'); } else { add(500); tone(900, .05, 'sine'); }
    if (G.lanes.every(l => l)) {
      if (G.mult < 5) G.mult++;
      add(10000); msg(`MULTIPLICATEUR ×${G.mult}`, '+10 000', 2); SFX.big(); banner('MULTIPLICATEUR ×' + G.mult, '#ffd400', '+10 000');
      later(.8, () => G.lanes = [0, 0, 0]);
    }
  }));
  const orbit = () => {
    if (ball.fromLane) { ball.fromLane = false; add(2500); msg('LANCEMENT RÉUSSI', '+2 500', 1.5); return; }
    if (G.tilt) return; add(5000); G.jackpot += 2500; msg('HYPERESPACE !', '+5 000', 1.5); SFX.hyper(); ev('orbit');
    G.orbitFlash = 1.2; banner('HYPERESPACE', '#38e0ff', '+5 000'); fx('orbit'); majorShot();
  };
  sensor('orbL', ball.x < 52 && ball.y > 170 && ball.y < 250 && ball.vy > 150, orbit);
  sensor('orbR', ball.x > 340 && ball.x < 372 && ball.y > 200 && ball.y < 260 && ball.vy > 150, orbit);
  if (ball.y > 300 && !ball.inLane) { ball.fromLane = false; ball.skill = false; }
  // Kickback : renvoie la bille qui tombe dans le couloir de sortie gauche (s'il est allumé)
  if (G.kickback && !G.tilt && ball.x < 50 && ball.y > 625 && ball.vy > 0) {
    G.kickback = false; ball.y = 625; ball.vx = 30; ball.vy = -1450;
    banner('KICKBACK', '#3cff6a'); noise(.2, .4, 300); tone(140, .25, 'square', .12, 500); fx('kickback', ball.x, ball.y);
  }
  if (ball.capCd <= 0 && Math.hypot(ball.x - hole.x, ball.y - hole.y) < 12) {
    ball.cap = 1.3; ball.x = hole.x; ball.y = hole.y; ball.vx = ball.vy = 0;
    holeEntered(); SFX.hole(); fx('hole');
  }
  if (ball.y > 805) drainBall(ball);
}
