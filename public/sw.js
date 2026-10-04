const CACHE = "guestbook-shell-v3";
const STATIC = ["/manifest.webmanifest", "/icon.svg"];

async function precacheCurrentBuild() {
  const cache = await caches.open(CACHE);

  for (const url of STATIC) {
    try {
      await cache.add(url);
    } catch {
      // A non-critical icon/manifest failure should not block offline app install.
    }
  }

  const response = await fetch("/", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not fetch Guestbook shell");

  await cache.put("/index.html", response.clone());
  const html = await response.text();

  const urls = new Set();
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const value = match[1];
    if (!value || !value.startsWith("/")) continue;
    if (value === "/") continue;
    urls.add(value);
  }

  await Promise.allSettled(
    [...urls].map(async (url) => {
      const asset = await fetch(url, { cache: "no-store" });
      if (asset.ok) await cache.put(url, asset);
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

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
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

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    }),
  );
});
