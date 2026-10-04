const CACHE = "guestbook-shell-v5";
const STATIC = [
  "/manifest.webmanifest",
  "/icon.svg",
  "/fonts/UberMoveMedium.woff2",
  "/fonts/UberMoveBold.woff2",
];

async function precacheCurrentBuild() {
  const cache = await caches.open(CACHE);

  for (const url of STATIC) {
    try {
      const asset = await fetch(url, { cache: "no-store" });
      if (asset.ok) await cache.put(url, asset.clone());
    } catch {
      // Non-critical static assets should not block install.
    }
  }

  const response = await fetch("/", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not fetch Guestbook shell");

  await cache.put("/index.html", response.clone());
  const html = await response.text();

  const urls = new Set();
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const value = match[1];
    if (!value || !value.startsWith("/") || value === "/") continue;
    urls.add(value);
  }

  await Promise.allSettled(
    [...urls].map(async (url) => {
      const asset = await fetch(url, { cache: "no-store" });
      if (asset.ok) await cache.put(url, asset.clone());
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheCurrentBuild());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      ),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put("/index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match("/index.html")),
    );
    return;
  }

  if (sameOrigin && url.pathname.startsWith("/assets/")) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && sameOrigin) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    }),
  );
});
