// Caché para conexiones lentas: las imágenes salen de caché; páginas, estilos y código se piden primero a la red
// (así siempre ven la última versión) y, si la red falla, se usa lo guardado.
const C = 'milpa-v4';
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const imagen = u.pathname.endsWith('.webp');
  e.respondWith(caches.open(C).then(async c => {
    if (imagen) {
      const hit = await c.match(e.request);
      if (hit) return hit;
    }
    try {
      const r = await fetch(e.request, { cache: 'no-cache' });
      if (r.ok) c.put(e.request, r.clone());
      return r;
    } catch (err) {
      const hit = await c.match(e.request);
      if (hit) return hit;
      throw err;
    }
  }));
});
