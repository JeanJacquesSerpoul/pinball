// Service worker : permet de jouer hors ligne et d'installer le jeu comme une application.
// La page est servie « réseau d'abord » (pour recevoir les mises à jour), le reste « cache d'abord ».
const CACHE = 'pinball-v1';
const FILES = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon.png',
  './vendor/three/build/three.module.js',
  ...['EffectComposer', 'RenderPass', 'UnrealBloomPass', 'OutputPass', 'ShaderPass', 'MaskPass', 'Pass'].map(f => `./vendor/three/examples/jsm/postprocessing/${f}.js`),
  ...['CopyShader', 'LuminosityHighPassShader', 'OutputShader'].map(f => `./vendor/three/examples/jsm/shaders/${f}.js`),
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === 'navigate' || req.url.endsWith('/index.html');
  if (isPage) {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
  } else {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
  }
});
