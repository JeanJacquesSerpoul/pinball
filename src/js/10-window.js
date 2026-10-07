/* ---------------- Fenêtre, menus, dialogues ---------------- */
const win = $('win');
let scale = 1, posX = null, posY = null, minimized = false, vertical = null;
// Mesure la taille non mise à l'échelle de la fenêtre dans une disposition donnée
function measure(vert) { win.classList.toggle('vert', vert); return [win.offsetWidth, win.offsetHeight]; }
function layout() {
  if (minimized) return;   // fenêtre masquée : impossible de la mesurer
  const availW = innerWidth - 12, availH = innerHeight - 30 - 12;
  const [hw, hh] = measure(false), sH = Math.min(availW / hw, availH / hh);
  const [vw, vh] = measure(true), sV = Math.min(availW / vw, availH / vh);
  // Panneau sous la table si cela permet un affichage nettement plus grand (écrans étroits / portrait)
  const vert = sV > sH * 1.08;
  const [w0, h0] = measure(vert);
  if (vert !== vertical) { vertical = vert; posX = null; }
  scale = Math.min(vert ? sV : sH, 1.6);
  win.style.transform = `scale(${scale})`;
  const w = w0 * scale, h = h0 * scale;
  if (posX === null || posX + w > innerWidth || posY + h > innerHeight - 30) { posX = (innerWidth - w) / 2; posY = Math.max(4, (innerHeight - 30 - h) / 2); }
  win.style.left = posX + 'px'; win.style.top = posY + 'px';
  K = Math.min(2, Math.max(1, (devicePixelRatio || 1) * scale));
  cv.width = TW * K; cv.height = TH * K; buildStatic();
  if (window.R3D) window.R3D.resize(K);
}
addEventListener('resize', layout);
let drag = null;
$('title').addEventListener('pointerdown', e => { if (e.target.closest('.tb')) return; drag = [e.clientX - posX, e.clientY - posY]; $('title').setPointerCapture(e.pointerId); });
$('title').addEventListener('pointermove', e => { if (!drag) return; posX = e.clientX - drag[0]; posY = Math.max(0, e.clientY - drag[1]); win.style.left = posX + 'px'; win.style.top = posY + 'px'; });
$('title').addEventListener('pointerup', () => drag = null);
$('title').addEventListener('dblclick', () => { posX = null; layout(); });
function setMin(v) { minimized = v; win.style.display = v ? 'none' : ''; $('task').classList.toggle('min', v); if (!v) { last = performance.now(); layout(); } }
$('bMin').onclick = () => setMin(true);
$('bClose').onclick = () => setMin(true);
$('task').onclick = () => setMin(!minimized);
$('bMax').onclick = toggleFull;
function toggleFull() { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => { }); }
document.querySelectorAll('.mi').forEach(mi => {
  mi.addEventListener('click', e => {
    const item = e.target.closest('[data-a]');
    if (item) { document.querySelectorAll('.mi').forEach(m => m.classList.remove('open')); act(item.dataset.a); e.stopPropagation(); return; }
    const was = mi.classList.contains('open'); document.querySelectorAll('.mi').forEach(m => m.classList.remove('open')); if (!was) mi.classList.add('open'); e.stopPropagation();
  });
  mi.addEventListener('mouseenter', () => { if (document.querySelector('.mi.open') && !mi.classList.contains('open')) { document.querySelectorAll('.mi').forEach(m => m.classList.remove('open')); mi.classList.add('open'); } });
});
addEventListener('click', () => document.querySelectorAll('.mi').forEach(m => m.classList.remove('open')));
function toggleOpt(k, id) { OPT[k] = !OPT[k]; $(id).classList.toggle('chk', OPT[k]); }
function act(a) {
  if (a === 'new') newGame();
  else if (a === 'pause') togglePause();
  else if (a === 'close') setMin(true);
  else if (a === 'sound') toggleOpt('sound', 'optSound');
  else if (a === 'music') { toggleOpt('music', 'optMusic'); audio(); }
  else if (a === 'v2d') setView(false);
  else if (a === 'v3d') setView(true);
  else if (a === 'cam') toggleOpt('cam', 'optCam');
  else if (a === 'replay') { toggleOpt('replay', 'optReplay'); try { localStorage.setItem('pinballXP.replay', OPT.replay ? '1' : '0'); } catch (e) { } }
  else if (a === 'slowmo') { toggleOpt('slowmo', 'optSlowmo'); try { localStorage.setItem('pinballXP.slowmo', OPT.slowmo ? '1' : '0'); } catch (e) { } }
  else if (a === 'rumble') { toggleOpt('rumble', 'optRumble'); rumble(200, .5, .5); }
  else if (a === 'zoom') toggleZoom();
  else if (a === 'fx') toggleOpt('fx', 'optFx');
  else if (a === 'full') toggleFull();
  else if (a.startsWith('q-')) setQuality(a.slice(2));
  else if (a.startsWith('d-')) setDifficulty(a.slice(2));
  else if (a === 'install' && installPrompt) { installPrompt.prompt(); installPrompt = null; $('optInstall').style.display = 'none'; }
  else if (a === 'help') showHelp();
  else if (a === 'high') showScores();
  else if (a === 'stats') showStats();
  else if (a === 'daily') startDaily();
  else if (a === 'about') showDlg('À propos de Pinball', '<b>3D Pinball – Space Cadet</b><br>Recréation hommage du flipper livré avec Windows XP.<br><br>Rendu 3D temps réel : Three.js (WebGL), éclairage PBR, reflets dynamiques, bloom et particules. Physique, graphismes et sons générés par code.');
}
let dlgOpen = false, pausedByDlg = false, dlgCb = null;
// cb : appelé à la fermeture de la boîte (OK, Entrée, Échap, bouton A de la manette)
function showDlg(t, html, cb) {
  $('dlgT').textContent = t; $('dlgB').innerHTML = html; $('dlg').classList.add('show'); dlgOpen = true; dlgCb = cb || null;
  if (G.state === 'play' && !G.paused) { G.paused = true; pausedByDlg = true; }
}
function closeDlg() {
  $('dlg').classList.remove('show'); dlgOpen = false; if (pausedByDlg) { G.paused = false; pausedByDlg = false; last = performance.now(); }
  const cb = dlgCb; dlgCb = null; if (cb) cb();
}
$('dlgOk').onclick = closeDlg; $('dlgX').onclick = closeDlg;
function showHelp() {
  showDlg('Commandes du jeu', `<table>
    <tr><td>Flipper gauche</td><td>Z, Maj gauche ou ←</td></tr>
    <tr><td>Flipper droit</td><td>/, Maj droite ou →</td></tr>
    <tr><td>Lanceur</td><td>Espace (maintenir puis relâcher)</td></tr>
    <tr><td>Secouer</td><td>X (gauche) · . (droite) · ↑ (haut)</td></tr>
    <tr><td>Nouvelle partie</td><td>F2</td></tr><tr><td>Pause</td><td>F3</td></tr>
    <tr><td>Affichage 2D / 3D</td><td>F6 (ou menu Options)</td></tr>
    <tr><td>Zoom sur la bille</td><td>F7 (ou menu Options)</td></tr>
    <tr><td>Manette Xbox</td><td>LB / LT = flipper gauche, RB / RT = flipper droit, A = lanceur, X / B / Y = secouer, Menu = pause, Affichage = 2D / 3D, clic stick droit = zoom</td></tr>
    <tr><td>Rampe</td><td>Entrée à gauche, derrière les cibles. 3 rampes = multibille prête (trou noir) ; pendant le multibille, la rampe rapporte le jackpot</td></tr>
    <tr><td>Missions</td><td>Acceptez-les en prenant la rampe ou le trou noir ; certaines ont plusieurs étapes ou un chrono</td></tr>
    <tr><td>Souris</td><td>Clic gauche / droit = flipper gauche / droit, clic molette = lanceur</td></tr>
    <tr><td>Tactile</td><td>Moitié gauche/droite = flippers, coin bas-droit = lanceur</td></tr></table>
    <br><b>But :</b> accomplissez les missions pour monter en grade, de Cadet jusqu'à Amiral de la Flotte. Les 3 couloirs du haut augmentent le multiplicateur ; 3 missions = une bille supplémentaire. Attention au TILT !`);
}
function clock() { $('clock').textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
setInterval(clock, 10000); clock();

