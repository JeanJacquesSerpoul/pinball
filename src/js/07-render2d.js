/* ---------------- Rendu 2D de secours ---------------- */
function light(x, y, on, col, r = 6) {
  ctx.save();
  if (on) { ctx.shadowColor = col; ctx.shadowBlur = 12; }
  const g = ctx.createRadialGradient(x - r * .3, y - r * .3, 1, x, y, r);
  g.addColorStop(0, on ? '#fff' : 'rgba(255,255,255,.25)'); g.addColorStop(.4, on ? col : 'rgba(80,80,100,.6)'); g.addColorStop(1, on ? col : 'rgba(20,20,40,.8)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function flipPath(L) { ctx.beginPath(); ctx.arc(0, 0, 8.5, Math.PI / 2, Math.PI * 1.5); ctx.lineTo(L, -5); ctx.arc(L, 0, 5, -Math.PI / 2, Math.PI / 2); ctx.closePath(); }
const cam2 = { x: TW / 2, y: TH / 2, k: 1 };   // caméra 2D (zoom sur la bille)
function render2D() {
  ctx.setTransform(K, 0, 0, K, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, TW, TH);
  const zk = OPT.zoom && G.state === 'play' && ball.live ? 1.9 : 1;
  cam2.k += (zk - cam2.k) * .08;
  const hw = TW / (2 * cam2.k), hh = TH / (2 * cam2.k), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const tx = ball.live ? ball.x : TW / 2, ty = ball.live ? ball.y : TH / 2;
  cam2.x += (clamp(tx, hw, TW - hw) - cam2.x) * .15; cam2.y += (clamp(ty, hh, TH - hh) - cam2.y) * .15;
  cam2.x = clamp(cam2.x, hw, TW - hw); cam2.y = clamp(cam2.y, hh, TH - hh);
  ctx.translate(TW / 2, TH / 2); ctx.scale(cam2.k, cam2.k); ctx.translate(-cam2.x, -cam2.y);
  let ox = 0, oy = 0; if (G.shake > 0) { ox = G.shakeX * G.shake / .15; oy = G.shakeY * G.shake / .15; }
  ctx.translate(ox, oy);
  ctx.drawImage(st, 0, 0, TW, TH);
  const blink = (Math.floor(G.t * 4) % 2) === 0;
  lanesPos.forEach((x, i) => light(x, 95, G.lanes[i], '#38e0ff', 6));
  multPos.forEach((x, i) => light(x, 480, G.mult >= i + 2, '#ffd400', 9));
  drops.forEach((d, i) => light(116, 301 + i * 25, !d.on, '#ff3b3b', 5));
  fuels.forEach((f, i) => light(348, 311 + i * 28, G.fuel[i], '#ff9a1a', 5));
  light(196, 632, G.save > 0 && (G.save > 2 || blink), '#3cff6a', 7);
  rankPos.forEach(([x, y], i) => light(x, y, G.state !== 'attract' && i <= G.rank, '#ff5ad2', 4.5));
  // trou noir
  const hg = ctx.createRadialGradient(hole.x, hole.y, 2, hole.x, hole.y, 26);
  hg.addColorStop(0, '#000'); hg.addColorStop(.45, '#14002a'); hg.addColorStop(.75, 'rgba(140,40,255,.55)'); hg.addColorStop(1, 'rgba(140,40,255,0)');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(hole.x, hole.y, 26, 0, Math.PI * 2); ctx.fill();
  // bumpers
  bumpers.forEach(b => {
    const on = b.fl > 0;
    ctx.fillStyle = on ? '#fff36a' : '#3b56c9'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 2, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(b.x - 6, b.y - 7, 2, b.x, b.y, b.r);
    g.addColorStop(0, '#fff'); g.addColorStop(.35, on ? '#ffe04a' : '#ff5a3a'); g.addColorStop(1, on ? '#d07000' : '#7a1010');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 4, 0, Math.PI * 2); ctx.fill();
  });
  drops.forEach(d => { if (d.on) { ctx.lineCap = 'butt'; ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 6; ctx.beginPath(); wallPath(ctx, d); ctx.stroke(); } });
  fuels.forEach((f, i) => { ctx.lineCap = 'butt'; ctx.strokeStyle = G.fuel[i] ? '#ffe9a0' : '#ff7a1a'; ctx.lineWidth = 4; ctx.beginPath(); wallPath(ctx, f); ctx.stroke(); });
  ctx.lineCap = 'round';
  slings.forEach(s => { if (s.fl > 0) { ctx.strokeStyle = '#fffbd0'; ctx.lineWidth = 6; ctx.beginPath(); wallPath(ctx, s); ctx.stroke(); } });
  const py = plunger.y1;
  ctx.fillStyle = '#ccc'; ctx.fillRect(374, py, 24, 7); ctx.fillStyle = '#555'; ctx.fillRect(382, py + 7, 8, 800 - py);
  [flL, flR].forEach(f => {
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a); flipPath(f.len);
    ctx.fillStyle = '#e8ecf4'; ctx.fill(); ctx.strokeStyle = '#c4161c'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
  });
  if (ball.live) {
    const s = ball.cap > 0 ? Math.max(.25, Math.abs(ball.cap - .65) / .65) : 1, r = R * s;
    const g = ctx.createRadialGradient(ball.x - r * .4, ball.y - r * .45, r * .1, ball.x, ball.y, r);
    g.addColorStop(0, '#fff'); g.addColorStop(.3, '#d0d6e2'); g.addColorStop(.75, '#6b7488'); g.addColorStop(1, '#2c3240');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2); ctx.fill();
  }
  if (G.paused) { ctx.setTransform(K, 0, 0, K, 0, 0); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, TW, TH); }
}

