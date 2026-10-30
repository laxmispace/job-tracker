// Minimal service worker: makes the app installable and keeps a basic
// offline shell. Data always comes fresh from Supabase.
const CACHE = "jobtracker-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/manifest.webmanifest"])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  if (req.url.includes("/api/")) return;
  // Network first, fall back to cache for page navigations.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/")));
  }
});
