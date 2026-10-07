/* ---------------- Logique du jeu ---------------- */
function add(p) { if (G.state === 'play' && !G.tilt) G.score += p; }
function newGame() {
  audio();
  Object.assign(G, { state: 'play', paused: false, score: 0, ball: 1, extra: 0, mult: 1, rank: 0, mIdx: 0, prog: 0, done: 0, tilt: false, tiltMeter: 0 });
  timers = [];
  setMission(); drawRanks(); serve();
  SFX.start(); fx('start');
  banner('BIENVENUE, CADET', '#38e0ff', 'MISSION : ' + MISSIONS[0].name.toUpperCase());
  msg('BIENVENUE, CADET', missionText(), 3);
}
function setMission() {
  const m = MISSIONS[G.mIdx % MISSIONS.length];
  G.need = m.n * (1 + Math.floor(G.mIdx / MISSIONS.length)); G.prog = 0;
}
function resetBall() { Object.assign(ball, { x: 386, y: 712, vx: 0, vy: 0, inLane: true, fromLane: true, cap: 0, capCd: 0, live: true, sens: {} }); }
function serve() {
  resetBall();
  G.mult = 1; G.lanes = [0, 0, 0]; G.fuel = [0, 0, 0]; G.tilt = false; G.tiltMeter = 0; G.save = 0; G.saveArmed = false; G.bonusHits = 0;
  drops.forEach(d => d.on = true);
}
function ev(name, n = 1) {
  if (G.state !== 'play' || G.tilt) return;
  const m = MISSIONS[G.mIdx % MISSIONS.length];
  if (m.ev !== name) return;
  G.prog += n;
  if (G.prog >= G.need) {
    const pts = 50000 * (G.rank + 1); add(pts); G.done++;
    msg('MISSION ACCOMPLIE !', `${m.name} : +${fmt(pts)}`, 3);
    later(.25, () => { banner('MISSION ACCOMPLIE', '#3cff6a', '+' + fmt(pts)); flash('rgba(120,255,160,.7)'); fx('mission'); });
    if (G.rank < RANKS.length - 1) {
      G.rank++;
      later(2.4, () => { msg('PROMOTION !', RANKS[G.rank], 3); SFX.rank(); banner('PROMOTION', '#ff5ad2', RANKS[G.rank].toUpperCase()); fx('rank'); });
    }
    if (G.done % 3 === 0) { G.extra++; later(4.6, () => { msg('BILLE SUPPLÉMENTAIRE !', '', 2.5); banner('BILLE EN PLUS', '#3cff6a'); }); }
    SFX.big(); G.mIdx++; setMission(); drawRanks();
  } else if (msgT <= 0) idleText();
}
function launched() { if (!G.saveArmed) { G.saveArmed = true; G.save = 8; } }
function drain() {
  ball.live = false;
  if (G.state !== 'play') return;
  if (G.save > 0 && !G.tilt) {
    G.save = 0; msg('RE-DÉPLOIEMENT', 'Bille sauvée !', 2); SFX.lane(); banner('BILLE SAUVÉE', '#3cff6a', 'RE-DÉPLOIEMENT');
    later(1.2, resetBall);
    return;
  }
  SFX.drain(); fx('drain'); flash('rgba(255,40,20,.7)');
  const bonus = G.tilt ? 0 : (G.bonusHits * 250 + G.done * 1000 + 5000) * G.mult;
  later(1, () => { G.score += bonus; msg('BONUS DE FIN DE BILLE', `${fmt(bonus)} ×${G.mult}`, 2.2); banner('BONUS', '#ffd23a', fmt(bonus) + '  ×' + G.mult); });
  later(3.2, () => {
    if (G.extra > 0) { G.extra--; msg('REJOUEZ !', missionText(), 2); banner('REJOUEZ !', '#3cff6a'); serve(); }
    else if (G.ball < 3) { G.ball++; msg(`BILLE ${G.ball}`, missionText(), 2); banner('BILLE ' + G.ball, '#38e0ff'); serve(); }
    else gameOver();
  });
}
function gameOver() {
  G.state = 'over';
  let rec = false;
  if (G.score > HIGH) { HIGH = G.score; rec = true; try { localStorage.setItem('pinballXP.high', HIGH); } catch (e) { } }
  msg('PARTIE TERMINÉE', rec ? 'NOUVEAU RECORD !\nF2 pour rejouer' : 'F2 ou Espace pour rejouer', 9999);
  if (rec) { banner('NOUVEAU RECORD', '#ffd23a', fmt(G.score)); fx('mission'); }
  SFX.drain();
}
function nudge(dx, dy) {
  if (G.state !== 'play' || G.paused) return;
  G.shake = .15; G.shakeX = dx * 4; G.shakeY = dy * 4;
  if (ball.live && !ball.cap && !ball.inLane && !G.tilt) { ball.vx += dx * 70; ball.vy += dy * 90; }
  noise(.08, .3, 200); fx('nudge', dx, dy);
  G.tiltMeter += 1;
  if (G.tiltMeter > 3.2 && !G.tilt) {
    G.tilt = true; G.save = 0; SFX.tilt(); msg('TILT !', 'Flippers désactivés', 9999);
    banner('TILT', '#ff2a2a'); flash('rgba(255,0,0,.8)'); fx('tilt');
  }
}

