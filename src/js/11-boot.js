/* ---------------- Démarrage ---------------- */
// Application installable et jouable hors ligne (uniquement quand le jeu est servi en http/https)
let installPrompt = null;
if (navigator.serviceWorker && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { });
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; $('optInstall').style.display = ''; });
addEventListener('appinstalled', () => { $('optInstall').style.display = 'none'; banner('APPLICATION INSTALLÉE', '#3cff6a'); });
layout(); drawRanks(); updPanel();
msg('3D PINBALL', 'Appuyez sur F2 pour une nouvelle partie', 9999);
requestAnimationFrame(frame);
setTimeout(() => { if (!window.R3D) $('loading').textContent = 'Moteur 3D indisponible (connexion Internet requise) — mode 2D'; }, 30000);

/* ---------------- Choix de l'affichage 2D / 3D ---------------- */
function applyView() {
  const use3d = OPT.view3d && !!window.R3D;
  cv.style.display = use3d ? 'none' : 'block';
  $('gl').style.display = use3d ? 'block' : 'none';
  $('loading').style.display = OPT.view3d && !window.R3D ? '' : 'none';
  $('optV3d').classList.toggle('chk', OPT.view3d); $('optV2d').classList.toggle('chk', !OPT.view3d);
  $('optZoom').classList.toggle('chk', OPT.zoom);
  // Les options de caméra et d'effets ne concernent que la 3D
  ['optCam', 'optFx'].forEach(id => $(id).style.opacity = OPT.view3d ? '' : '.45');
}
function toggleZoom() {
  OPT.zoom = !OPT.zoom; $('optZoom').classList.toggle('chk', OPT.zoom);
  try { localStorage.setItem('pinballXP.zoom', OPT.zoom ? '1' : '0'); } catch (e) { }
  banner(OPT.zoom ? 'ZOOM ACTIVÉ' : 'VUE COMPLÈTE', '#38e0ff');
}
function setView(v3) {
  OPT.view3d = v3;
  try { localStorage.setItem('pinballXP.view', v3 ? '3d' : '2d'); } catch (e) { }
  applyView();
  banner(v3 ? (window.R3D ? 'AFFICHAGE 3D' : 'CHARGEMENT 3D…') : 'AFFICHAGE 2D', v3 ? '#38e0ff' : '#ffd23a');
}
applyView();
