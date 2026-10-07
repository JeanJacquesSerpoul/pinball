// Tests des mécaniques de jeu : rampe, multibille, kickback, missions, combos, difficulté…
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from './harness.mjs';

const started = (storage) => { const g = loadGame({ storage }); g.run('newGame()'); return g; };
// place la bille principale hors du lanceur
const put = (g, o) => g.run(`Object.assign(ball, { inLane: false, fromLane: false, sens: {}, vx: 0, vy: 0 }, ${JSON.stringify(o)})`);

test("la rampe guide la bille jusqu'au couloir de retour droit et compte un verrou", () => {
  const g = started();
  put(g, { x: 78, y: 275, vy: -900 });
  g.sim(0.1);
  assert.ok(g.run('!!ball.ramp'), 'la bille doit être sur la rampe');
  let maxH = 0; for (let i = 0; i < 120 && g.run('!!ball.ramp'); i++) { g.sim(1 / 60); maxH = Math.max(maxH, g.run('ball.h')); }
  assert.equal(g.run('!!ball.ramp'), false, 'la bille doit sortir de la rampe');
  assert.ok(maxH > 30, `hauteur max ${maxH}`);
  assert.ok(Math.abs(g.run('ball.x') - 326) < 20, `sortie x = ${g.run('ball.x')}`);
  assert.equal(g.run('G.locks'), 1);
});

test('une bille qui descend devant la rampe ne la prend pas', () => {
  const g = started();
  put(g, { x: 78, y: 250, vy: 400 });
  g.sim(0.1);
  assert.equal(g.run('!!ball.ramp'), false);
});

test('3 verrous + trou noir = multibille à 3 billes ; perdre une bille ne termine pas la bille en cours', () => {
  const g = started();
  g.run('G.locks = 3; G.save = 0');
  put(g, { x: hole().x, y: hole().y });
  function hole() { return { x: 300, y: 430 }; }
  g.sim(4, { autoplay: true });
  assert.equal(g.run('G.multi'), true);
  assert.equal(g.run('balls.filter(b => b.live).length'), 3);
  g.run('G.save = 0; balls[1].y = 820'); g.sim(0.1);
  assert.equal(g.run('balls.filter(b => b.live).length'), 2);
  assert.equal(g.run('G.ball'), 1);
});

test('fin du multibille quand il ne reste qu’une bille', () => {
  const g = started();
  g.run('startMultiball()'); g.sim(3, { autoplay: true });
  g.run('G.save = 0; G.kickback = false; balls.slice(1).forEach(b => b.y = 820)'); g.sim(0.1);
  assert.equal(g.run('G.multi'), false);
  assert.equal(g.run('balls.length'), 1);
  assert.equal(g.run('G.ball'), 1);
});

test('la rampe pendant le multibille rapporte le jackpot', () => {
  const g = started();
  g.run('G.multi = true; G.jackpot = 80000');
  const before = g.run('G.score');
  g.run('rampDone()');
  assert.ok(g.run('G.score') - before >= 95000);
  assert.equal(g.run('G.jackpot'), 50000);
});

test('le kickback renvoie la bille du couloir de sortie gauche, une seule fois', () => {
  const g = started();
  put(g, { x: 35, y: 600, vy: 600 });
  g.sim(0.1);
  assert.ok(g.run('ball.vy') < -800, `vy = ${g.run('ball.vy')}`);
  assert.equal(g.run('G.kickback'), false);
});

test('une mission terminée doit être acceptée (rampe ou trou noir) avant de progresser', () => {
  const g = started();
  for (let i = 0; i < 8; i++) g.run("ev('bumper')");
  assert.equal(g.run('G.pending'), true);
  g.run("ev('drop')"); assert.equal(g.run('G.prog'), 0, 'pas de progression tant que la mission est proposée');
  g.run("ev('ramp')"); assert.equal(g.run('G.pending'), false);
  g.run("ev('drop')"); assert.equal(g.run('G.prog'), 1);
});

test('mission à étapes : il faut les faire dans l’ordre', () => {
  const g = started();
  g.run("G.mIdx = MISSIONS.findIndex(m => m.name === 'Sauvetage'); setMission(false)");
  g.run("ev('ramp')"); assert.equal(g.run('G.step'), 0);
  g.run("ev('hole')"); assert.equal(g.run('G.step'), 1);
  const done = g.run('G.done');
  g.run("ev('ramp')"); assert.equal(g.run('G.done'), done + 1);
});

test('mission chronométrée : échoue quand le temps est écoulé', () => {
  const g = started();
  g.run("G.mIdx = MISSIONS.findIndex(m => m.time); setMission(false)");
  assert.ok(g.run('G.mTime') > 0);
  g.sim(31);
  assert.equal(g.run('G.pending'), true);
  assert.equal(g.run('G.prog'), 0);
});

test('deux tirs majeurs rapprochés font un combo', () => {
  const g = started();
  g.run('majorShot()'); g.sim(1); g.run('majorShot()');
  assert.equal(g.run('G.combo'), 1);
  g.sim(5); g.run('majorShot()');
  assert.equal(g.run('G.combo'), 0, 'trop tard : pas de combo');
});

test('tir d’adresse : le couloir clignotant rapporte 25 000', () => {
  const g = started();
  g.run('G.skillLane = 1');
  put(g, { x: 192, y: 95, skill: true });
  const before = g.run('G.score');
  g.run('step(DT)');
  assert.ok(g.run('G.score') - before >= 25000);
});

test('bille en plus : allumée après 3 missions, gagnée dans le trou noir', () => {
  const g = started();
  g.run('G.done = 2; G.need = 1; G.prog = 0; G.pending = false; G.step = 0');
  g.run('ev(missionStep().ev, 99)');
  assert.equal(g.run('G.extraLit'), true);
  g.run('holeEntered()');
  assert.equal(g.run('G.extra'), 1);
});

test('avertissement avant le tilt, puis tilt', () => {
  const g = started();
  g.run('nudge(1,0); nudge(1,0); nudge(1,0)');
  assert.equal(g.run('G.tilt'), false);
  g.run('nudge(1,0)');
  assert.equal(g.run('G.tilt'), true);
});

test('difficulté facile : 5 billes par partie et sauvetage plus long', () => {
  const g = started({ 'pinballXP.diff': 'easy' });
  assert.equal(g.run('G.maxBalls'), 5);
  g.run('ball.inLane = false; launched()');
  assert.equal(g.run('G.save'), 15);
});

test('multibille : 1 minute de jeu automatique sans bille perdue hors table', () => {
  const g = started();
  g.run('startMultiball()');
  for (let i = 0; i < 240; i++) {
    g.sim(0.25, { autoplay: true });
    const bad = g.run('balls.filter(b => b.live && !b.ramp && (!Number.isFinite(b.x) || b.x < 10 || b.x > 410 || b.y < 0 || b.y > 830)).length');
    assert.equal(bad, 0);
    if (g.run("G.state !== 'play'")) g.run('newGame()');
  }
});
