// Cache hors ligne : l'app fonctionne sans réseau une fois ouverte une première fois.
const V = 'chalet-v2';
const FILES = ['./', 'index.html', 'app.js', 'agenda.js', 'contrat-pdf.js', 'assets.js', 'vendor/pdfmake.min.js', 'vendor/vfs_fonts.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
// Réseau d'abord (pour recevoir les mises à jour), cache en secours hors ligne.
self.addEventListener('fetch', (e) => {
  // Uniquement les fichiers de l'app : les appels au hub (avec le jeton) ne sont jamais mis en cache ici.
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(V).then((c) => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
