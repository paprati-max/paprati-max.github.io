// Deliberately does nothing except exist.
//
// Android needs a service worker with a fetch handler before it will treat the
// site as installable. It would be easy to add offline caching here — don't.
// You're still changing the code, and a cache would serve everyone stale files
// long after you've pushed a fix, with no obvious way to tell. Every request
// goes straight to the network.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => e.respondWith(fetch(e.request)));
