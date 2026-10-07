// Tests de la physique et des règles. Lancer : node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadGame } from './harness.mjs';
import { build } from '../build.mjs';

const started = () => { const g = loadGame(); g.run('newGame()'); return g; };

test('index.html est à jour avec les sources', () => {
  const cur = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(cur, build(), 'lancer « node build.mjs »');
});

test('la bille repose sur le lanceur sans bouger', () => {
  const g = started();
  g.sim(2);
  assert.equal(g.run('ball.inLane'), true);
  assert.ok(Math.abs(g.run('ball.y') - 712) < 1, `y = ${g.run('ball.y')}`);
});

test('un lancement à pleine puissance envoie la bille en haut de la table', () => {
  const g = started();
  g.run('plungeStart()'); g.sim(1.2); g.run('plungeEnd()');
  let minY = 999;
  for (let i = 0; i < 60; i++) { g.sim(1 / 30); minY = Math.min(minY, g.run('ball.y')); }
  assert.ok(minY < 120, `hauteur atteinte : ${minY}`);
  assert.equal(g.run('ball.inLane'), false);
});

test('le flipper gauche renvoie la bille vers le haut', () => {
  const g = started();
  g.run('Object.assign(ball, { x: 160, y: 670, vx: 0, vy: 50, inLane: false, live: true })');
  g.run('keys.left = true'); g.sim(0.08);
  assert.ok(g.run('ball.vy') < -400, `vy = ${g.run('ball.vy')}`);
});

test('la bille ne sort jamais de la table et ne devient jamais NaN (2 minutes de jeu)', () => {
  const g = started();
  for (let i = 0; i < 120 * 4; i++) {
    g.sim(0.25, { autoplay: true });
    const [x, y, live, state] = g.run('[ball.x, ball.y, ball.live, G.state]');
    assert.ok(Number.isFinite(x) && Number.isFinite(y), 'coordonnées invalides');
    if (live) { assert.ok(x > 10 && x < 410, `x = ${x}`); assert.ok(y > 0 && y < 830, `y = ${y}`); }
    if (state !== 'play') g.run('newGame()');
  }
});

test('le sauvetage de bille relance la même bille', () => {
  const g = started();
  g.run('ball.inLane = false; launched(); ball.y = 820');
  g.sim(2);
  assert.equal(g.run('G.ball'), 1);
  assert.equal(g.run('ball.live && ball.inLane'), true);
});

test('trois billes perdues terminent la partie', () => {
  const g = started();
  for (let i = 0; i < 3; i++) { g.run('G.save = 0; ball.inLane = false; ball.y = 820'); g.sim(4); }
  assert.equal(g.run('G.state'), 'over');
});

test('la mission « Lancement » (8 bumpers) donne une promotion', () => {
  const g = started();
  for (let i = 0; i < 8; i++) g.run(`Object.assign(ball, { x: bumpers[0].x, y: bumpers[0].y + 27, vx: 0, vy: -300, inLane: false }); hitBumper(bumpers[0], 0)`);
  g.sim(3);
  assert.equal(g.run('G.rank'), 1);
  assert.ok(g.run('G.score') >= 50000);
});

test('allumer les 3 couloirs du haut augmente le multiplicateur', () => {
  const g = started();
  for (const x of [147, 192, 237]) { g.run(`Object.assign(ball, { x: ${x}, y: 95, vx: 0, vy: 0, inLane: false, sens: {} })`); g.run('step(DT)'); g.run('ball.y = 200; step(DT)'); }
  assert.equal(g.run('G.mult'), 2);
});

test('abattre les 3 cibles les remet en place ensuite', () => {
  const g = started();
  g.run('drops.forEach(d => onHit(d, 300, 1, 0, d.x1, d.y1))');
  assert.equal(g.run('drops.every(d => !d.on)'), true);
  g.run('ball.x = 300; ball.y = 600'); g.sim(2);
  assert.equal(g.run('drops.every(d => d.on)'), true);
});

test('secouer trop la table provoque un TILT qui bloque les flippers', () => {
  const g = started();
  for (let i = 0; i < 4; i++) g.run('nudge(1, 0)');
  assert.equal(g.run('G.tilt'), true);
  g.run('keys.left = true'); g.sim(0.2);
  assert.equal(g.run('flL.a'), g.run('flL.rest'));
});

test('le clavier actionne les flippers (Z et /)', () => {
  const g = started();
  g.fire('keydown', { code: 'KeyZ', key: 'z' });
  assert.equal(g.run('keys.left'), true);
  g.fire('keyup', { code: 'KeyZ', key: 'z' });
  assert.equal(g.run('keys.left'), false);
  g.fire('keydown', { code: 'Slash', key: '/' });
  assert.equal(g.run('keys.right'), true);
});
