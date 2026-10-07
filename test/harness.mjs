// Charge le code du jeu (src/js/NN-*.js) dans un contexte Node isolé, avec un DOM factice.
// Permet de tester la physique et les règles sans navigateur.
import vm from 'node:vm';
import { gameSource } from '../build.mjs';

export function loadGame({ storage = {} } = {}) {
  const listeners = {};
  const elements = new Map();
  const el = id => { if (!elements.has(id)) { const f = function () { }; f.__props = {}; elements.set(id, new Proxy(f, proxyHandler())); } return elements.get(id); };
  function proxyHandler() {
    return {
      get(t, k) {
        if (k === Symbol.toPrimitive) return () => 0;
        if (k === 'then') return undefined;
        if (k === Symbol.iterator) return function* () { };
        if (k in t.__props) return t.__props[k];
        const f = function () { }; f.__props = {};
        return (t.__props[k] = new Proxy(f, proxyHandler()));
      },
      set(t, k, v) { t.__props[k] = v; return true; },
      apply() { const f = function () { }; f.__props = {}; return new Proxy(f, proxyHandler()); },
      construct() { const f = function () { }; f.__props = {}; return new Proxy(f, proxyHandler()); },
    };
  }
  const anyStub = () => { const f = function () { }; f.__props = {}; return new Proxy(f, proxyHandler()); };
  const store = { ...storage };
  const ctx = {
    console, Math, Date, JSON, Array, Object, Map, Set, Number, String, Symbol, Promise, Proxy, Error, Float32Array, Uint8Array,
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0,
    setTimeout: () => 0, setInterval: () => 0, clearInterval: () => { }, clearTimeout: () => { },
    innerWidth: 1280, innerHeight: 900, devicePixelRatio: 1,
    navigator: { getGamepads: () => [] },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    document: { getElementById: el, createElement: () => anyStub(), querySelector: () => null, querySelectorAll: () => [], documentElement: anyStub(), body: anyStub(), fullscreenElement: null },
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    removeEventListener: () => { },
    getComputedStyle: () => anyStub(),
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(gameSource(), ctx, { filename: 'game.js' });
  const run = code => vm.runInContext(code, ctx);
  const fire = (type, props = {}) => (listeners[type] || []).forEach(fn => fn({ preventDefault() { }, repeat: false, ...props }));
  // Avance le jeu de « seconds » secondes par images de 1/60 s ; autoplay = joue automatiquement
  const sim = (seconds, { autoplay = false } = {}) => {
    run(`(function(){ for (let i = 0; i < ${Math.round(seconds * 60)}; i++) {
      ${autoplay ? `
      if (__hold === 0 && __cool <= 0 && balls.some(b => b.live && b.y > 640 && b.y < 715 && b.vy > -50 && !b.inLane)) { const b = balls.find(b => b.live && b.y > 640 && b.y < 715 && !b.inLane); keys[b.x < 196 ? 'left' : 'right'] = true; __hold = 12; __cool = 20; }
      if (__cool > 0) __cool--;
      if (typeof __hold !== 'undefined' && __hold > 0 && --__hold === 0) { keys.left = keys.right = false; }
      if (!G.charging && __plunge === 0 && balls.some(b => b.live && b.inLane && b.y > 700 && Math.abs(b.vy) < 5)) { plungeStart(); __plunge = 40; }
      if (typeof __plunge !== 'undefined' && __plunge > 0 && --__plunge === 0) plungeEnd();
      ` : ''}
      update(1 / 60);
    } })()`);
  };
  run('var __hold = 0, __plunge = 0, __cool = 0;');
  return { run, fire, sim, store };
}
