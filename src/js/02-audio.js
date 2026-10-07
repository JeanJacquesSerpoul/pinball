/* ---------------- Minuteries (sensibles à la pause) ---------------- */
let timers = [];
function later(t, fn) { timers.push({ t, fn }); }
function runTimers(dt) {
  const due = [];
  timers = timers.filter(o => { o.t -= dt; if (o.t <= 0) { due.push(o.fn); return false; } return true; });
  due.forEach(f => f());
}

/* ---------------- Son (WebAudio synthétisé) ---------------- */
let actx = null, noiseBuf = null;
function audio() {
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    noiseBuf = actx.createBuffer(1, actx.sampleRate * .2, actx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(f, d = .08, type = 'square', v = .12, f2, delay = 0) {
  if (!OPT.sound) return; const a = audio(); if (!a) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0008, t + d);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + .03);
}
function noise(d = .05, v = .2, freq = 1800) {
  if (!OPT.sound) return; const a = audio(); if (!a) return;
  const t = a.currentTime, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
  s.connect(f).connect(g).connect(a.destination); s.start(t); s.stop(t + d + .02);
}
const SFX = {
  flip: () => noise(.06, .35, 900),
  bump: () => { tone(880, .09, 'square', .1, 330); tone(1320, .05, 'triangle', .06); },
  sling: () => { tone(520, .07, 'sawtooth', .08, 200); noise(.04, .2, 2500); },
  drop: () => tone(300, .15, 'square', .1, 90),
  fuel: () => { tone(660, .06, 'square', .08); tone(990, .08, 'square', .08, null, .06); },
  lane: () => tone(1500, .1, 'sine', .12, 2200),
  wall: v => noise(.03, Math.min(.15, v / 4000), 600),
  launch: p => { noise(.25, .25, 500); tone(120, .3, 'sawtooth', .08 * p + .03, 600); },
  hole: () => { tone(400, .8, 'sine', .15, 40); tone(200, .8, 'triangle', .1, 30); },
  eject: () => { noise(.12, .3, 400); tone(90, .2, 'square', .12, 600); },
  drain: () => { [600, 450, 330, 220].forEach((f, i) => tone(f, .18, 'triangle', .14, f * .8, i * .14)); },
  rank: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .18, 'square', .09, null, i * .09)); },
  big: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, .14, 'square', .08, null, i * .07)); },
  hyper: () => { tone(200, .6, 'sawtooth', .07, 2400); tone(300, .6, 'square', .04, 3200, .05); },
  tilt: () => tone(80, .9, 'sawtooth', .18, 50),
  start: () => { [392, 523, 659, 784, 659, 784].forEach((f, i) => tone(f, .14, 'square', .08, null, i * .1)); },
};
let musicStep = 0;
const SEQ = [110, 0, 165, 0, 147, 0, 131, 0, 110, 0, 165, 196, 147, 0, 131, 123];
function musicTick() {
  if (!OPT.music || G.paused || G.state !== 'play') return;
  const f = SEQ[musicStep++ % SEQ.length]; if (f) tone(f, .22, 'triangle', .05);
}

