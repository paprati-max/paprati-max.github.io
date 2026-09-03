// sw.js — deliberately serves nothing from cache.
//
// Android needs a service worker with a fetch handler before it treats the site
// as installable. It would be easy to add offline caching here — don't. You're
// still changing the code, and a cache would serve stale files long after a fix
// is pushed, with no obvious symptom except the app behaving like an old version.
//
// On top of passing everything through, this deletes any cache storage it finds,
// so an installed app can't sit on an old copy of the game.

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  // Our own files always come from the network, never the HTTP cache.
  // Third-party requests (map tiles, fonts, the Firebase SDK) are left alone —
  // those you do want cached.
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && event.request.method === "GET") {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).catch(() => fetch(event.request))
    );
  }
});
