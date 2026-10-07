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
      if (v > 50) { ball.vx += nx * 430; ball.vy += ny * 430; s.fl = .12; add(100); G.bonusHits++; SFX.sling(); fx('sling', cx, cy); }
      break;
    case 'drop':
      if (!G.tilt) {
        s.on = false; add(1500); G.bonusHits++; SFX.drop(); ev('drop'); fx('drop', cx, cy);
        if (drops.every(d => !d.on)) {
          add(25000); msg('CIBLES ABATTUES !', '+25 000', 2); SFX.big(); banner('CIBLES ABATTUES', '#ffd23a', '+25 000');
          const reset = () => { if (ball.x > 70 && ball.x < 125 && ball.y > 270 && ball.y < 385) later(.5, reset); else drops.forEach(d => d.on = true); };
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
  b.fl = .15; add(500); G.bonusHits++; SFX.bump(); ev('bumper');
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
  if (!ball.live) return;
  if (ball.cap > 0) {
    ball.cap -= dt;
    if (ball.cap <= 0) { ball.vx = -430 + Math.random() * 60; ball.vy = -140; ball.capCd = .7; SFX.eject(); fx('eject'); }
    return;
  }
  if (ball.capCd > 0) ball.capCd -= dt;

  ball.vy += GRAV * dt;
  ball.vx *= .99986; ball.vy *= .99986;
  const sp = Math.hypot(ball.vx, ball.vy); if (sp > MAXV) { ball.vx *= MAXV / sp; ball.vy *= MAXV / sp; }
  ball.x += ball.vx * dt; ball.y += ball.vy * dt;

  gate.on = !ball.inLane;
  for (const s of walls) if (s.on) hitSeg(s);
  bumpers.forEach(hitBumper);
  hitFlipper(flL); hitFlipper(flR);

  if (ball.inLane && ball.x < 366) { ball.inLane = false; launched(); }
  lanesPos.forEach((lx, i) => sensor('lane' + i, Math.abs(ball.x - lx) < 18 && Math.abs(ball.y - 95) < 12, () => {
    if (G.tilt) return;
    fx('lane', lx, 95);
    if (!G.lanes[i]) { G.lanes[i] = 1; add(1000); SFX.lane(); ev('lane'); } else { add(500); tone(900, .05, 'sine'); }
    if (G.lanes.every(l => l)) {
      if (G.mult < 5) G.mult++;
      add(10000); msg(`MULTIPLICATEUR ×${G.mult}`, '+10 000', 2); SFX.big(); banner('MULTIPLICATEUR ×' + G.mult, '#ffd400', '+10 000');
      later(.8, () => G.lanes = [0, 0, 0]);
    }
  }));
  const orbit = () => {
    if (ball.fromLane) { ball.fromLane = false; add(2500); msg('LANCEMENT RÉUSSI', '+2 500', 1.5); return; }
    if (G.tilt) return; add(5000); msg('HYPERESPACE !', '+5 000', 1.5); SFX.hyper(); ev('orbit');
    G.orbitFlash = 1.2; banner('HYPERESPACE', '#38e0ff', '+5 000'); fx('orbit');
  };
  sensor('orbL', ball.x < 52 && ball.y > 170 && ball.y < 250 && ball.vy > 150, orbit);
  sensor('orbR', ball.x > 340 && ball.x < 372 && ball.y > 200 && ball.y < 260 && ball.vy > 150, orbit);
  if (ball.y > 300 && !ball.inLane) ball.fromLane = false;
  if (ball.capCd <= 0 && Math.hypot(ball.x - hole.x, ball.y - hole.y) < 12) {
    ball.cap = 1.3; ball.x = hole.x; ball.y = hole.y; ball.vx = ball.vy = 0;
    if (!G.tilt) { add(10000); msg('TROU NOIR', '+10 000', 1.6); ev('hole'); G.bonusHits += 3; banner('TROU NOIR', '#c45cff', '+10 000'); }
    SFX.hole(); fx('hole');
  }
  if (ball.y > 805) drain();
}

