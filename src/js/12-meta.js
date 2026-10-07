/* ---------------- Meilleurs scores, statistiques et défi du jour ---------------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('pinballXP.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('pinballXP.' + k, JSON.stringify(v)); } catch (e) { } },
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Top 10 : { name, score, rank, date, mode }
let SCORES = store.get('scores', []);
if (!SCORES.length && HIGH) SCORES = [{ name: '???', score: HIGH, rank: 0, date: '', mode: 'normal' }];
const STATS = Object.assign({ games: 0, balls: 0, missions: 0, ramps: 0, multiballs: 0, jackpots: 0, time: 0, total: 0, best: 0, bestRank: 0, dailies: 0 }, store.get('stats', {}));
function stat(k, n = 1) { STATS[k] = (STATS[k] || 0) + n; }

/* ----- Défi du jour : même configuration pour tout le monde ce jour-là, une seule bille ----- */
const DAILY_MODS = [
  { name: 'Bumpers surpuissants', desc: 'Les bumpers rapportent 3 fois plus', bump: 3 },
  { name: 'Gravité lunaire', desc: 'La table est moins pentue', grav: .8 },
  { name: 'Table raide', desc: 'Table plus pentue, sauvetage de 15 s', grav: 1.2, save: 15 },
  { name: 'Jackpot doré', desc: 'Le jackpot démarre à 200 000', jackpot: 200000 },
  { name: 'Multibille offert', desc: 'Le multibille est prêt dès le départ', locks: 3 },
  { name: 'Course folle', desc: 'Toutes les missions sont chronométrées (40 s)', timed: 40 },
];
function todayKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function dailySeed(key = todayKey()) { let h = 7; for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
function dailyConfig(key = todayKey()) { const s = dailySeed(key); return { key, mod: DAILY_MODS[s % DAILY_MODS.length], mIdx: (s >>> 3) % MISSIONS.length }; }
function startDaily() {
  const d = dailyConfig(), best = store.get('daily', {})[d.key];
  newGame({ daily: d });
  stat('dailies');
  banner('DÉFI DU JOUR', '#ffd23a', d.mod.name.toUpperCase());
  msg('DÉFI DU JOUR : ' + d.mod.name.toUpperCase(), d.mod.desc + '\nUne seule bille' + (best ? ` · record du jour ${fmt(best.score)}` : ''), 5);
}

/* ----- Branchements sur les événements du jeu ----- */
const _onLost = window.onBallLost;
window.onBallLost = () => { stat('balls'); store.set('stats', STATS); if (_onLost) _onLost(); };
window.onGameStart = () => stat('games');
window.onMission = () => stat('missions');
window.onGameOver = () => {
  stat('total', G.score); STATS.best = Math.max(STATS.best, G.score); STATS.bestRank = Math.max(STATS.bestRank, G.rank);
  store.set('stats', STATS);
  const mode = G.daily ? 'daily' : OPT.diff;
  if (G.daily) {
    const all = store.get('daily', {}), prev = all[G.daily.key];
    if (!prev || G.score > prev.score) { all[G.daily.key] = { score: G.score, name: store.get('lastName', 'AAA') }; store.set('daily', all); later(1.5, () => banner('RECORD DU JOUR', '#ffd23a', fmt(G.score))); }
  }
  if (G.score > 0 && (SCORES.length < 10 || G.score > SCORES[SCORES.length - 1].score)) later(2.5, () => askInitials(G.score, name => {
    SCORES.push({ name, score: G.score, rank: G.rank, date: todayKey(), mode });
    SCORES.sort((a, b) => b.score - a.score); SCORES = SCORES.slice(0, 10); store.set('scores', SCORES);
    if (G.daily) { const all = store.get('daily', {}); if (all[G.daily.key] && all[G.daily.key].score === G.score) { all[G.daily.key].name = name; store.set('daily', all); } }
    showScores(name, G.score);
  }));
};

/* ----- Boîtes de dialogue ----- */
function askInitials(score, cb) {
  const last = store.get('lastName', '');
  showDlg('Nouveau meilleur score !', `<p style="margin:0 0 8px">Score : <b>${fmt(score)}</b> — vous entrez dans le top 10.<br>Entrez vos initiales :</p>
    <input id="initials" maxlength="3" value="${esc(last)}" autocomplete="off" spellcheck="false"
      style="font:bold 28px 'Lucida Console',monospace;width:5.2em;text-align:center;text-transform:uppercase;letter-spacing:6px;padding:4px">`,
  () => {
    const name = (($('initials') && $('initials').value) || last || 'AAA').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'AAA';
    store.set('lastName', name); cb(name);
  });
  setTimeout(() => { const i = $('initials'); if (i && i.focus) { i.focus(); i.select(); } }, 60);
}
const MODE_NAMES = { easy: 'facile', normal: 'normal', hard: 'difficile', daily: 'défi du jour' };
function showScores(hlName, hlScore) {
  const rows = SCORES.map((s, i) => {
    const hl = s.name === hlName && s.score === hlScore ? ' style="background:#ffeaa0"' : '';
    return `<tr${hl}><td>${i + 1}.</td><td>${esc(s.name)}</td><td style="text-align:right">${fmt(s.score)}</td><td>${esc(RANKS[s.rank] || '')}</td><td style="color:#666">${esc(MODE_NAMES[s.mode] || '')}</td></tr>`;
  }).join('') || '<tr><td colspan="5">Aucun score pour le moment.</td></tr>';
  const d = dailyConfig(), best = store.get('daily', {})[d.key];
  showDlg('Meilleurs scores', `<table>${rows}</table>
    <hr style="border:0;border-top:1px solid #aca899;margin:10px 0">
    <b>Défi du jour</b> (${d.key}) : ${esc(d.mod.name)} — ${esc(d.mod.desc)}.<br>
    ${best ? `Record du jour : <b>${fmt(best.score)}</b> (${esc(best.name)})` : 'Pas encore joué aujourd’hui.'}`);
}
function showStats() {
  const h = Math.floor(STATS.time / 3600), m = Math.floor(STATS.time % 3600 / 60);
  const row = (k, v) => `<tr><td>${k}</td><td style="text-align:right">${v}</td></tr>`;
  showDlg('Statistiques', `<table>
    ${row('Parties jouées', fmt(STATS.games))}${row('dont défis du jour', fmt(STATS.dailies))}
    ${row('Temps de jeu', `${h} h ${String(m).padStart(2, '0')} min`)}
    ${row('Meilleur score', fmt(STATS.best))}
    ${row('Score moyen', fmt(STATS.games ? Math.round(STATS.total / STATS.games) : 0))}
    ${row('Billes jouées', fmt(STATS.balls))}${row('Durée moyenne d’une bille', STATS.balls ? Math.round(STATS.time / STATS.balls) + ' s' : '-')}
    ${row('Missions accomplies', fmt(STATS.missions))}${row('Meilleur grade', RANKS[STATS.bestRank])}
    ${row('Rampes', fmt(STATS.ramps))}${row('Multibilles', fmt(STATS.multiballs))}${row('Jackpots', fmt(STATS.jackpots))}
  </table>`);
}
