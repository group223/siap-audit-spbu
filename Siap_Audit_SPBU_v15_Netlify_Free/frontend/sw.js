const V = "siap-audit-netlify-v16.0.1";
const PUBLIC = new Set(["/icon-192.png", "/icon-512.png", "/manifest.webmanifest"]);
self.addEventListener("install", event => {
  event.waitUntil(caches.open(V).then(cache => cache.addAll([...PUBLIC])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("siap-audit-") && key !== V).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  // Never serve cached authenticated HTML, account pages, or AI results after logout.
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !PUBLIC.has(url.pathname)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(V).then(cache => cache.put(event.request, copy)));
    }
    return response;
  }).catch(() => caches.match(event.request)));
});
