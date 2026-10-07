/* ---------------- Accessibilité : touches configurables, mouvements réduits, taille du texte ---------------- */
const KEY_NAMES = { Space: 'Espace', Enter: 'Entrée', ShiftLeft: 'Maj G', ShiftRight: 'Maj D', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  Slash: '/', Period: '.', NumpadDivide: 'Pavé /', NumpadDecimal: 'Pavé .', ControlLeft: 'Ctrl G', ControlRight: 'Ctrl D', AltLeft: 'Alt', Backspace: 'Retour' };
const keyName = c => KEY_NAMES[c] || c.replace(/^Key|^Digit/, '').replace(/^Numpad/, 'Pavé ');
function keysLabel(a) { return KEYMAP[a] ? KEYMAP[a].map(keyName).join(' / ') : DEFAULT_KEYS[a].codes.map(keyName).join(' / '); }
function applyAccess() {
  document.body.classList.toggle('calm', OPT.calm);
  $('panel').classList.remove('t-large', 't-xlarge');
  if (OPT.text !== 'normal') $('panel').classList.add('t-' + OPT.text);
}
function saveAccess() {
  try { localStorage.setItem('pinballXP.calm', OPT.calm ? '1' : '0'); localStorage.setItem('pinballXP.text', OPT.text); localStorage.setItem('pinballXP.keys', JSON.stringify(KEYMAP)); } catch (e) { }
}
function bindKey(action, code) {
  bindingAction = null;
  if (code !== 'Escape') {
    for (const a in KEYMAP) if (a !== action) KEYMAP[a] = KEYMAP[a].filter(c => c !== code);   // une touche = une seule action
    KEYMAP[action] = [code];
    saveAccess();
  }
  showAccess();
}
function showAccess() {
  const rows = Object.keys(DEFAULT_KEYS).map(a => `<tr><td>${DEFAULT_KEYS[a].label}</td><td><span class="kb${bindingAction === a ? ' wait' : ''}">${bindingAction === a ? 'appuyez…' : esc(keysLabel(a))}</span></td>
    <td><button class="xbtn" style="min-width:0" onclick="bindingAction='${a}';showAccess()">Modifier</button></td></tr>`).join('');
  showDlg('Accessibilité et commandes', `
    <b>Clavier</b> <span style="color:#666">(Échap pendant la saisie = annuler)</span>
    <table>${rows}</table>
    <button class="xbtn" onclick="KEYMAP={};saveAccess();showAccess()">Touches par défaut</button>
    <hr style="border:0;border-top:1px solid #aca899;margin:10px 0">
    <label><input type="checkbox" ${OPT.calm ? 'checked' : ''} onchange="OPT.calm=this.checked;saveAccess();applyAccess()">
      Réduire les mouvements (pas de tremblements, de flashs ni de zooms brusques)</label>
    <div style="margin-top:6px">Taille du texte du panneau :
      ${[['normal', 'normale'], ['large', 'grande'], ['xlarge', 'très grande']].map(([v, n]) => `<label style="display:inline;margin-right:8px"><input type="radio" name="ts" ${OPT.text === v ? 'checked' : ''} onchange="OPT.text='${v}';saveAccess();applyAccess()"> ${n}</label>`).join('')}
    </div>`);
}
applyAccess();
