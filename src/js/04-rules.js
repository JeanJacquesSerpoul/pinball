/* ---------------- Logique du jeu ---------------- */
function add(p) { if (G.state === 'play' && !G.tilt) G.score += p; }
function newGame() {
  audio();
  Object.assign(G, {
    state: 'play', paused: false, score: 0, ball: 1, extra: 0, mult: 1, rank: 0, mIdx: 0, prog: 0, done: 0, tilt: false, tiltMeter: 0,
    jackpot: 50000, locks: 0, multi: false, extraLit: false, maxBalls: DIFF().balls,
  });
  timers = [];
  setMission(false); drawRanks(); serve();
  SFX.start(); fx('start');
  banner('BIENVENUE, CADET', '#38e0ff', 'MISSION : ' + MISSIONS[0].name.toUpperCase());
  msg('BIENVENUE, CADET', missionText(), 3);
  if (window.onGameStart) window.onGameStart();
}

/* ----- Missions ----- */
const mission = () => MISSIONS[G.mIdx % MISSIONS.length];
const missionStep = () => mission().steps[G.step];
// pending = la mission est proposée et doit être acceptée (rampe ou trou noir)
function setMission(pending) {
  G.step = 0; G.prog = 0; G.pending = pending; G.mTime = 0;
  G.need = missionStep().n * (1 + Math.floor(G.mIdx / MISSIONS.length));
  if (!pending) startMissionClock();
}
function startMissionClock() { const m = mission(); G.mTime = m.time ? m.time + 5 * Math.floor(G.mIdx / MISSIONS.length) : 0; }
function acceptMission() {
  G.pending = false; startMissionClock();
  msg('MISSION ACCEPTÉE', missionText(), 2.5); banner('MISSION ACCEPTÉE', '#38e0ff', mission().name.toUpperCase()); SFX.big();
}
function missionFailed() {
  msg('MISSION ÉCHOUÉE', 'Rampe ou trou noir pour réessayer', 3); banner('MISSION ÉCHOUÉE', '#ff5a2a', 'TEMPS ÉCOULÉ'); SFX.drain();
  setMission(true);
}
function ev(name, n = 1) {
  if (G.state !== 'play' || G.tilt) return;
  if (G.pending) { if (name === 'ramp' || name === 'hole') acceptMission(); return; }
  if (missionStep().ev !== name) return;
  G.prog += n;
  if (G.prog < G.need) { if (msgT <= 0) idleText(); return; }
  const m = mission();
  if (G.step < m.steps.length - 1) {   // étape suivante
    G.step++; G.prog = 0; G.need = missionStep().n;
    msg('ÉTAPE SUIVANTE', missionText(), 2.5); banner('ÉTAPE SUIVANTE', '#38e0ff', missionStep().desc.toUpperCase()); SFX.fuel();
    return;
  }
  const pts = 50000 * (G.rank + 1); add(pts); G.done++;
  msg('MISSION ACCOMPLIE !', `${m.name} : +${fmt(pts)}`, 3);
  later(.25, () => { banner('MISSION ACCOMPLIE', '#3cff6a', '+' + fmt(pts)); flash('rgba(120,255,160,.7)'); fx('mission'); });
  if (G.rank < RANKS.length - 1) {
    G.rank++;
    later(2.4, () => { msg('PROMOTION !', RANKS[G.rank], 3); SFX.rank(); banner('PROMOTION', '#ff5ad2', RANKS[G.rank].toUpperCase()); fx('rank'); });
  }
  if (G.done % 3 === 0) { G.extraLit = true; later(4.6, () => { msg('BILLE EN PLUS ALLUMÉE', 'Entrez dans le trou noir', 3); banner('BILLE EN PLUS ALLUMÉE', '#3cff6a', 'VISEZ LE TROU NOIR'); }); }
  SFX.big(); G.mIdx++; setMission(true); drawRanks();
  if (window.onMission) window.onMission(m.name);
}

/* ----- Tirs majeurs : combos, rampe, trou noir ----- */
function majorShot() {
  if (G.comboT > 0) {
    G.combo++;
    const pts = 10000 * G.combo; add(pts);
    banner('COMBO ×' + (G.combo + 1), '#ffd400', '+' + fmt(pts)); SFX.big(); ev('combo');
  } else G.combo = 0;
  G.comboT = 4;
}
function rampDone() {
  if (G.tilt) return;
  add(15000); G.jackpot += 2500; fx('ramp');
  if (G.multi) { add(G.jackpot); banner('JACKPOT', '#ffd400', fmt(G.jackpot)); msg('JACKPOT !', fmt(G.jackpot), 3); flash('rgba(255,220,80,.8)'); fx('jackpot'); SFX.rank(); G.jackpot = 50000; }
  else if (G.locks < 3) {
    G.locks++;
    if (G.locks === 3) { banner('MULTIBILLE PRÊTE', '#ff40c8', 'VISEZ LE TROU NOIR'); msg('MULTIBILLE PRÊTE', 'Entrez dans le trou noir', 3); }
    else { banner('RAMPE', '#ff40c8', `VERROU ${G.locks} / 3`); msg('RAMPE !', `+15 000 · verrou ${G.locks}/3`, 2); }
    SFX.hyper();
  } else { banner('RAMPE', '#ff40c8', '+15 000'); SFX.hyper(); }
  ev('ramp'); majorShot();
}
function holeEntered() {
  if (G.tilt) return;
  add(10000); G.bonusHits += 3; banner('TROU NOIR', '#c45cff', '+10 000'); msg('TROU NOIR', '+10 000', 1.6);
  if (G.extraLit) { G.extraLit = false; G.extra++; later(.8, () => { banner('BILLE EN PLUS !', '#3cff6a'); msg('BILLE EN PLUS !', '', 2.5); SFX.rank(); }); }
  if (G.locks >= 3 && !G.multi) later(1.4, startMultiball);
  ev('hole'); majorShot();
}

/* ----- Billes et multibille ----- */
function resetBall() { ball = mkBall(); ball.live = true; balls = [ball]; }
// Ajoute une bille dans le couloir du lanceur ; auto = la lancer automatiquement
function addBall(auto) {
  const b = mkBall(); b.live = true; balls.push(b);
  if (!ball.live) ball = b;
  if (auto) later(.6, () => { if (b.live && b.inLane) { b.vy = -1500; SFX.launch(.8); fx('launch', .8); } });
  return b;
}
function startMultiball() {
  if (G.state !== 'play' || G.tilt) return;
  G.multi = true; G.locks = 0; G.save = Math.max(G.save, 10); G.saveArmed = true;
  banner('MULTIBILLE !', '#ff40c8', 'JACKPOT SUR LA RAMPE'); msg('MULTIBILLE !', 'Jackpot : ' + fmt(G.jackpot), 3);
  flash('rgba(255,80,200,.8)'); SFX.rank(); fx('multiball');
  addBall(true); later(1.2, () => addBall(true));
}
function serve() {
  resetBall();
  Object.assign(G, { mult: 1, lanes: [0, 0, 0], fuel: [0, 0, 0], tilt: false, tiltMeter: 0, save: 0, saveArmed: false, bonusHits: 0, multi: false, kickback: true, combo: 0, comboT: 0 });
  drops.forEach(d => d.on = true);
}
function launched() { if (!G.saveArmed) { G.saveArmed = true; G.save = DIFF().save; } }
function drainBall(b) {
  b.live = false; balls = balls.filter(x => x !== b);
  if (G.state !== 'play') { if (!balls.length) balls = [b]; ball = balls[0]; return; }
  if (G.save > 0 && !G.tilt) {   // sauvetage : la bille revient dans le couloir
    if (!G.multi) G.save = 0;
    msg('RE-DÉPLOIEMENT', 'Bille sauvée !', 2); SFX.lane(); banner('BILLE SAUVÉE', '#3cff6a', 'RE-DÉPLOIEMENT');
    const multi = G.multi;
    later(1.2, () => { if (G.state === 'play') addBall(multi); });
    if (!balls.length) ball = b;
    return;
  }
  if (balls.length) {   // il reste des billes : le multibille continue
    if (balls.length === 1) { G.multi = false; msg('FIN DU MULTIBILLE', '', 2); }
    ball = balls[0]; return;
  }
  balls = [b]; ball = b;   // plus aucune bille : fin de la bille en cours
  SFX.drain(); fx('drain'); flash('rgba(255,40,20,.7)');
  const bonus = G.tilt ? 0 : (G.bonusHits * 250 + G.done * 1000 + 5000) * G.mult;
  later(1, () => { G.score += bonus; msg('BONUS DE FIN DE BILLE', `${fmt(bonus)} ×${G.mult}`, 2.2); banner('BONUS', '#ffd23a', fmt(bonus) + '  ×' + G.mult); });
  later(3.2, () => {
    if (G.extra > 0) { G.extra--; msg('REJOUEZ !', missionText(), 2); banner('REJOUEZ !', '#3cff6a'); serve(); }
    else if (G.ball < G.maxBalls) { G.ball++; msg(`BILLE ${G.ball}`, missionText(), 2); banner('BILLE ' + G.ball, '#38e0ff'); serve(); }
    else gameOver();
  });
  if (window.onBallLost) window.onBallLost();
}
function drain() { drainBall(ball); }
function gameOver() {
  G.state = 'over';
  let rec = false;
  if (G.score > HIGH) { HIGH = G.score; rec = true; try { localStorage.setItem('pinballXP.high', HIGH); } catch (e) { } }
  msg('PARTIE TERMINÉE', rec ? 'NOUVEAU RECORD !\nF2 pour rejouer' : 'F2 ou Espace pour rejouer', 9999);
  if (rec) { banner('NOUVEAU RECORD', '#ffd23a', fmt(G.score)); fx('mission'); }
  SFX.drain();
  if (window.onGameOver) window.onGameOver();
}
function nudge(dx, dy) {
  if (G.state !== 'play' || G.paused) return;
  G.shake = .15; G.shakeX = dx * 4; G.shakeY = dy * 4;
  if (!G.tilt) for (const b of balls) if (b.live && !b.cap && !b.inLane && !b.ramp) { b.vx += dx * 70; b.vy += dy * 90; }
  noise(.08, .3, 200); fx('nudge', dx, dy);
  G.tiltMeter += 1;
  const lim = DIFF().tilt;
  if (G.tiltMeter > lim && !G.tilt) {
    G.tilt = true; G.save = 0; SFX.tilt(); msg('TILT !', 'Flippers désactivés', 9999);
    banner('TILT', '#ff2a2a'); flash('rgba(255,0,0,.8)'); fx('tilt');
  } else if (G.tiltMeter > lim - 1.2 && !G.tilt) {   // dernier avertissement
    banner('ATTENTION', '#ff9a1a', 'ENCORE UNE SECOUSSE = TILT'); tone(220, .25, 'square', .12); tone(180, .25, 'square', .12, null, .25);
  }
}
