/* ---------------- Minuteries (sensibles à la pause) ---------------- */
let timers = [];
function later(t, fn) { timers.push({ t, fn }); }
function runTimers(dt) {
  const due = [];
  timers = timers.filter(o => { o.t -= dt; if (o.t <= 0) { due.push(o.fn); return false; } return true; });
  due.forEach(f => f());
}

/* ---------------- Son (WebAudio synthétisé) ---------------- */
let actx = null, noiseBuf = null, PAN = 0;
function audio() {
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    noiseBuf = actx.createBuffer(1, actx.sampleRate * .2, actx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
// Sortie d'un son : panoramique stéréo selon la position sur la table (PAN, de -1 à 1)
function out(a, node) {
  if (PAN && a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = PAN; node.connect(p).connect(a.destination); }
  else node.connect(a.destination);
}
// Place les sons suivants à la position x de la table (gauche/droite), le temps d'un appel
function at(x, fn) { PAN = Math.max(-.9, Math.min(.9, (x - 196) / 190)); try { fn(); } finally { PAN = 0; } }
function tone(f, d = .08, type = 'square', v = .12, f2, delay = 0) {
  if (!OPT.sound) return; const a = audio(); if (!a) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0008, t + d);
  o.connect(g); out(a, g); o.start(t); o.stop(t + d + .03);
}
function noise(d = .05, v = .2, freq = 1800) {
  if (!OPT.sound) return; const a = audio(); if (!a) return;
  const t = a.currentTime, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
  s.connect(f).connect(g); out(a, g); s.start(t); s.stop(t + d + .02);
}
// Sons de la table : spatialisés à la position de la bille en cours
const onTable = fn => (...args) => at(ball.x, () => fn(...args));
const SFX = {
  flip: side => at(side === 'L' ? 120 : 272, () => noise(.06, .35, 900)),
  bump: onTable(() => { tone(880, .09, 'square', .1, 330); tone(1320, .05, 'triangle', .06); }),
  sling: onTable(() => { tone(520, .07, 'sawtooth', .08, 200); noise(.04, .2, 2500); }),
  drop: onTable(() => tone(300, .15, 'square', .1, 90)),
  fuel: onTable(() => { tone(660, .06, 'square', .08); tone(990, .08, 'square', .08, null, .06); }),
  lane: onTable(() => tone(1500, .1, 'sine', .12, 2200)),
  wall: onTable(v => noise(.03, Math.min(.15, v / 4000), 600)),
  launch: p => at(386, () => { noise(.25, .25, 500); tone(120, .3, 'sawtooth', .08 * p + .03, 600); }),
  hole: () => at(hole.x, () => { tone(400, .8, 'sine', .15, 40); tone(200, .8, 'triangle', .1, 30); }),
  eject: () => at(hole.x, () => { noise(.12, .3, 400); tone(90, .2, 'square', .12, 600); }),
  drain: () => { [600, 450, 330, 220].forEach((f, i) => tone(f, .18, 'triangle', .14, f * .8, i * .14)); },
  rank: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .18, 'square', .09, null, i * .09)); },
  big: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, .14, 'square', .08, null, i * .07)); },
  hyper: () => { tone(200, .6, 'sawtooth', .07, 2400); tone(300, .6, 'square', .04, 3200, .05); },
  tilt: () => tone(80, .9, 'sawtooth', .18, 50),
  start: () => { [392, 523, 659, 784, 659, 784].forEach((f, i) => tone(f, .14, 'square', .08, null, i * .1)); },
};

/* ---------------- Musique d'ambiance générative ----------------
   Nappes (accords filtrés), basse, arpèges et percussions légères, programmées à l'avance
   sur l'horloge audio. Plus de couches pendant le multibille et les missions chronométrées. */
const MUSIC = { next: 0, step: 0, bus: null, BPM: 96 };
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [52, 55, 59], [57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]];   // La m, Fa, Do, Mi m, La m, Fa, Sol, Mi
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
function musicBus(a) {
  if (!MUSIC.bus) {
    const g = a.createGain(); g.gain.value = .5;
    const dl = a.createDelay(1), fb = a.createGain(), wet = a.createGain();   // écho spatial
    dl.delayTime.value = 60 / MUSIC.BPM * .75; fb.gain.value = .35; wet.gain.value = .3;
    g.connect(a.destination); g.connect(dl); dl.connect(fb).connect(dl); dl.connect(wet).connect(a.destination);
    MUSIC.bus = g;
  }
  return MUSIC.bus;
}
function mNote(a, t, f, dur, type, vol, cutoff, attack = .01) {
  const o = a.createOscillator(), g = a.createGain(), fl = a.createBiquadFilter();
  o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = cutoff;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  o.connect(fl).connect(g).connect(musicBus(a)); o.start(t); o.stop(t + dur + .05);
}
function musicTick() {
  if (!OPT.music || G.paused || G.state !== 'play') { MUSIC.next = 0; return; }
  const a = audio(); if (!a) return;
  const sixteenth = 60 / MUSIC.BPM / 4, intense = G.multi || G.mTime > 0;
  if (MUSIC.next < a.currentTime) MUSIC.next = a.currentTime + .05;
  while (MUSIC.next < a.currentTime + .4) {
    const t = MUSIC.next, s = MUSIC.step % 16, chord = CHORDS[Math.floor(MUSIC.step / 16) % CHORDS.length];
    if (s === 0) chord.forEach((n, i) => { mNote(a, t, midi(n), sixteenth * 17, 'sawtooth', .022, 900, .5); mNote(a, t, midi(n) * 1.004, sixteenth * 17, 'sawtooth', .018, 700, .6); });
    if (s === 0 || s === 6 || s === 10) mNote(a, t, midi(chord[0] - 24), sixteenth * 3, 'triangle', .09, 400);
    if (s % 2 === 0 && (intense || s % 4 === 0)) mNote(a, t, midi(chord[(s / 2) % 3] + 12 + (s > 8 ? 12 : 0)), sixteenth * 1.5, 'square', .018, 2400);
    if (intense && s % 4 === 2 && noiseBuf) { const n = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); n.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.001, t + .06); n.connect(f).connect(g).connect(musicBus(a)); n.start(t); n.stop(t + .08); }
    if (intense && (s === 0 || s === 8)) mNote(a, t, 55, .25, 'sine', .25, 200);
    MUSIC.next += sixteenth; MUSIC.step++;
  }
}
