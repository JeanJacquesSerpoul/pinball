/* ---------------- Décor de la table (sert aussi de texture 3D) ---------------- */
let seed = 42; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function wallPath(c, s) { c.moveTo(s.x1, s.y1); c.lineTo(s.x2, s.y2); }
function arrow(c, x, y, a, col) {
  c.save(); c.translate(x, y); c.rotate(a); c.globalAlpha = .55; c.fillStyle = col;
  c.beginPath(); c.moveTo(14, 0); c.lineTo(-6, -9); c.lineTo(-2, 0); c.lineTo(-6, 9); c.closePath(); c.fill(); c.restore();
}
function drawArt(c, full) {
  let g = c.createLinearGradient(0, 0, 0, TH); g.addColorStop(0, '#060b2e'); g.addColorStop(.5, '#0d0830'); g.addColorStop(1, '#03030f');
  c.fillStyle = g; c.fillRect(0, 0, TW, TH);
  [[90, 180, 190, 'rgba(120,40,160,.35)'], [330, 380, 170, 'rgba(30,90,200,.3)'], [180, 600, 200, 'rgba(160,30,90,.22)']].forEach(([x, y, r, col]) => {
    const rg = c.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = rg; c.fillRect(0, 0, TW, TH);
  });
  // Trame technique discrète
  c.save(); c.strokeStyle = 'rgba(90,130,255,.07)'; c.lineWidth = .6;
  for (let x = -TH; x < TW + TH; x += 18) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + TH * .58, TH); c.stroke(); c.beginPath(); c.moveTo(x, 0); c.lineTo(x - TH * .58, TH); c.stroke(); }
  c.restore();
  // Rayons dorés derrière les bumpers
  c.save(); c.translate(205, 262);
  for (let i = 0; i < 24; i++) {
    c.rotate(Math.PI / 12); const gr = c.createLinearGradient(0, 0, 150, 0);
    gr.addColorStop(0, 'rgba(255,190,60,.22)'); gr.addColorStop(1, 'rgba(255,190,60,0)');
    c.fillStyle = gr; c.beginPath(); c.moveTo(0, 0); c.lineTo(150, -9); c.lineTo(150, 9); c.closePath(); c.fill();
  }
  c.restore();
  seed = 42;
  for (let i = 0; i < 260; i++) { const x = rnd() * TW, y = rnd() * TH, s = rnd(); c.fillStyle = `rgba(255,255,255,${.25 + s * .7})`; c.fillRect(x, y, s > .93 ? 2 : 1, s > .93 ? 2 : 1); }
  // Planète et anneaux
  c.save(); c.globalAlpha = .55;
  g = c.createRadialGradient(170, 500, 10, 196, 530, 95); g.addColorStop(0, '#6fa8ff'); g.addColorStop(.6, '#2b3f9e'); g.addColorStop(1, '#0b0f3a');
  c.fillStyle = g; c.beginPath(); c.arc(196, 530, 90, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(255,200,120,.7)'; c.lineWidth = 4; c.beginPath(); c.ellipse(196, 530, 140, 26, -.2, 0, Math.PI * 2); c.stroke();
  c.restore();
  // Fusée stylisée
  c.save(); c.translate(196, 405); c.globalAlpha = .5;
  c.fillStyle = '#c9d2e8'; c.beginPath(); c.moveTo(0, -60); c.quadraticCurveTo(22, -20, 16, 30); c.lineTo(-16, 30); c.quadraticCurveTo(-22, -20, 0, -60); c.fill();
  c.fillStyle = '#d23a2a'; c.beginPath(); c.moveTo(-16, 10); c.lineTo(-30, 40); c.lineTo(-14, 30); c.fill(); c.beginPath(); c.moveTo(16, 10); c.lineTo(30, 40); c.lineTo(14, 30); c.fill();
  c.fillStyle = '#3aa0ff'; c.beginPath(); c.arc(0, -18, 7, 0, Math.PI * 2); c.fill();
  c.restore();
  // Flèches peintes guidant vers les cibles (chevrons)
  const chevrons = (x1, y1, x2, y2, col, n) => {
    const a = Math.atan2(y2 - y1, x2 - x1);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
      c.save(); c.translate(x, y); c.rotate(a); c.globalAlpha = .18 + .5 * t; c.strokeStyle = col; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-5, -7); c.lineTo(3, 0); c.lineTo(-5, 7); c.stroke(); c.restore();
    }
  };
  chevrons(150, 610, 112, 380, '#ffd23a', 7);
  chevrons(245, 610, 290, 462, '#c45cff', 6);
  chevrons(205, 470, 205, 345, '#ff8a2a', 5);
  chevrons(318, 600, 350, 395, '#ff9a1a', 6);
  // Zone des flippers : dégradé
  g = c.createLinearGradient(0, 600, 0, TH); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,0,40,.55)');
  c.fillStyle = g; c.fillRect(0, 600, TW, TH - 600);
  // Textes
  c.save(); c.textAlign = 'center'; c.font = 'italic 900 22px "Arial Black",Impact,sans-serif';
  c.fillStyle = 'rgba(255,210,60,.18)'; c.fillText('SPACE CADET', 196, 715);
  c.font = 'bold 9px Tahoma'; c.fillStyle = 'rgba(200,220,255,.6)';
  c.fillText('TROU NOIR', hole.x, hole.y + 32);
  c.save(); c.translate(124, 326); c.rotate(-Math.PI / 2); c.fillText('CIBLES', 0, 0); c.restore();
  c.save(); c.translate(334, 342); c.rotate(Math.PI / 2); c.fillText('CARBURANT', 0, 0); c.restore();
  c.fillText('SAUVETAGE', 196, 648);
  c.fillText('GRADE', 196, 596);
  c.font = 'bold 8px Tahoma'; c.fillStyle = 'rgba(255,230,120,.75)';
  multPos.forEach((x, i) => c.fillText('×' + (i + 2), x, 500));
  c.restore();
  arrow(c, 40, 280, -Math.PI / 2, '#38e0ff'); arrow(c, 352, 280, -Math.PI / 2, '#38e0ff');
  arrow(c, 245, 400, -2.2, '#ff7a2a');
  // Cercles des inserts lumineux
  c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1.5;
  const ring = (x, y, r) => { c.beginPath(); c.arc(x, y, r + 3, 0, Math.PI * 2); c.stroke(); };
  lanesPos.forEach(x => ring(x, 95, 6)); multPos.forEach(x => ring(x, 480, 9)); rankPos.forEach(([x, y]) => ring(x, y, 4.5));
  c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(372, 230, 28, 580);
  // Assombrissement des bords
  g = c.createRadialGradient(196, 400, 120, 196, 400, 480); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
  c.fillStyle = g; c.fillRect(0, 0, TW, TH);
  if (!full) return;
  [[82, 500, 82, 575, 118, 611], [MX(82), 500, MX(82), 575, MX(118), 611]].forEach(p => {
    const gr = c.createLinearGradient(p[0], p[1], p[4], p[5]); gr.addColorStop(0, '#ffcc33'); gr.addColorStop(1, '#d6441c');
    c.fillStyle = gr; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[2], p[3]); c.lineTo(p[4], p[5]); c.closePath(); c.fill();
  });
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [w, col] of [[7, '#1a1d2b'], [4.5, '#8f9ab5'], [2, '#e8eef9']]) {
    c.strokeStyle = col;
    for (const s of walls) {
      if (s.kind === 'drop' || s.kind === 'fuel' || s.kind === 'plunger') continue;
      c.lineWidth = w + (s.r - 2) * 2 - (s.kind === 'gate' ? 3 : 0);
      c.beginPath(); wallPath(c, s); c.stroke();
    }
  }
  c.strokeStyle = '#f4f4f4'; c.lineWidth = 4; slings.forEach(s => { c.beginPath(); wallPath(c, s); c.stroke(); });
  [flL, flR].forEach(f => { c.fillStyle = '#222'; c.beginPath(); c.arc(f.x, f.y, 11, 0, Math.PI * 2); c.fill(); });
  c.strokeStyle = '#000'; c.lineWidth = 3; c.strokeRect(0, 0, TW, TH);
}
function buildStatic() { st.width = TW * K; st.height = TH * K; sctx.setTransform(K, 0, 0, K, 0, 0); drawArt(sctx, true); }

