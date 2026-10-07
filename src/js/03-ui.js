/* ---------------- Interface (panneau) ---------------- */
const $ = id => document.getElementById(id);
let msgT = 0, lastScore = -1;
function msg(text, sub, dur = 2.5) { $('msg1').textContent = text; if (sub !== undefined) $('msg2').textContent = sub; msgT = dur; }
function missionText() {
  const m = mission(), st = missionStep();
  if (G.pending) return `MISSION : ${m.name}\nRampe ou trou noir pour accepter`;
  const steps = m.steps.length > 1 ? ` [${G.step + 1}/${m.steps.length}]` : '';
  const time = G.mTime > 0 ? `  ⏱ ${Math.ceil(G.mTime)} s` : '';
  return `MISSION : ${m.name}${steps}\n${st.desc} (${Math.min(G.prog, G.need)}/${G.need})${time}`;
}
function idleText() {
  if (G.state === 'play') { $('msg1').textContent = G.tilt ? 'TILT !' : RANKS[G.rank].toUpperCase(); $('msg2').textContent = missionText(); }
}
function drawRanks() {
  $('ranks').innerHTML = RANKS.map((r, i) => `<div class="${i <= G.rank && G.state !== 'attract' ? 'on' : ''} ${i === G.rank && G.state !== 'attract' ? 'cur' : ''}">${r}</div>`).join('');
}
function fmt(n) { return n.toLocaleString('fr-FR').replace(/ | /g, ' '); }
let ovKey = '';
function updPanel() {
  if (G.score !== lastScore) {
    const el = $('score'); el.textContent = fmt(G.score);
    if (G.score - lastScore >= 5000) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
    lastScore = G.score;
  }
  $('ball').textContent = G.state === 'attract' ? '-' : G.ball + (G.multi ? ` (×${balls.filter(b => b.live).length})` : '');
  $('jackpot').textContent = G.state === 'attract' ? '-' : fmt(G.jackpot);
  $('hi').textContent = fmt(Math.max(HIGH, G.score));
  const k = G.paused ? 'p' : G.state;
  if (k !== ovKey) {
    ovKey = k; const ov = $('overlay');
    ov.style.display = k === 'play' ? 'none' : 'block';
    ov.querySelector('.o1').textContent = k === 'p' ? 'PAUSE' : k === 'over' ? 'PARTIE TERMINÉE' : '3D PINBALL';
    ov.querySelector('.o2').textContent = k === 'p' ? 'F3 pour reprendre' : 'Appuyez sur F2 ou Espace (ou touchez la table)';
  }
}

