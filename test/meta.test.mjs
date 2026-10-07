// Tests : défi du jour, meilleurs scores (top 10), statistiques
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from './harness.mjs';

test('le défi du jour est identique pour une même date et varie selon les jours', () => {
  const g = loadGame();
  const a = g.run("JSON.stringify(dailyConfig('2026-10-07'))"), b = g.run("JSON.stringify(dailyConfig('2026-10-07'))");
  assert.equal(a, b);
  const all = new Set(g.run("Array.from({length: 30}, (_, i) => dailyConfig('2026-11-' + String(i + 1).padStart(2, '0')).mod.name)"));
  assert.ok(all.size >= 3, 'les modificateurs doivent varier');
});

test('défi du jour : une seule bille et le modificateur est appliqué', () => {
  const g = loadGame();
  g.run("newGame({ daily: { key: 'test', mod: DAILY_MODS.find(m => m.jackpot), mIdx: 2 } })");
  assert.equal(g.run('G.maxBalls'), 1);
  assert.equal(g.run('G.jackpot'), 200000);
  assert.equal(g.run('G.mIdx'), 2);
  g.run("newGame({ daily: { key: 'test', mod: DAILY_MODS.find(m => m.bump), mIdx: 0 } })");
  const s = g.run('G.score');
  g.run('Object.assign(ball, { x: bumpers[0].x, y: bumpers[0].y + 27, vx: 0, vy: -300, inLane: false }); hitBumper(bumpers[0], 0)');
  assert.equal(g.run('G.score') - s, 1500);
});

test('un score du top 10 demande les initiales puis est enregistré et trié', () => {
  const g = loadGame({ storage: { 'pinballXP.scores': JSON.stringify([{ name: 'BOB', score: 900000, rank: 2, date: '', mode: 'normal' }]) } });
  g.run('newGame(); G.score = 1234567; gameOver()');
  g.sim(3);                                   // la boîte des initiales s'ouvre après un court délai
  assert.equal(g.run('dlgOpen'), true);
  g.run("$('initials').value = 'zed'; closeDlg()");
  const scores = JSON.parse(g.store['pinballXP.scores']);
  assert.deepEqual(scores.map(s => s.name), ['ZED', 'BOB']);
  assert.equal(scores[0].score, 1234567);
});

test('les statistiques comptent parties, billes et missions', () => {
  const g = loadGame();
  g.run('newGame()');
  for (let i = 0; i < 8; i++) g.run("ev('bumper')");
  g.run('G.save = 0; G.kickback = false; ball.inLane = false; ball.y = 820'); g.sim(1);
  assert.equal(g.run('STATS.games'), 1);
  assert.equal(g.run('STATS.missions'), 1);
  assert.equal(g.run('STATS.balls'), 1);
  assert.ok(JSON.parse(g.store['pinballXP.stats']).balls >= 1);
});
