/* OpenClaw service worker — minimal "shell cache + offline fallback".
 *
 * Goals:
 *   - Cache the app shell (root + favicon + manifest) so the page can boot
 *     without network — important for the iOS Add-to-Home-Screen flow.
 *   - Serve a graceful HTML fallback when the user is fully offline so they
 *     don't see the browser's "no internet" page.
 *
 * Non-goals:
 *   - Caching the gateway WebSocket or any app code under /_next/static (Next
 *     fingerprints those URLs on every build, so a stale cache is worse than
 *     a fresh fetch). We let the browser HTTP cache handle those.
 */

const CACHE_VERSION = "claw-shell-v1";
const SHELL_URLS = ["/", "/favicon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {
        // best-effort — install must succeed even if a precache request errs
      }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Same-origin only — never intercept cross-origin (gateway, telemetry, etc).
  if (url.origin !== self.location.origin) return;

  // Don't intercept WebSocket upgrades or API routes.
  if (url.pathname.startsWith("/api/")) return;

  // Navigation requests: try network first, fall back to cached shell so the
  // app can still boot offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put("/", copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match("/").then((cached) => cached ?? new Response("Offline", {
          status: 503,
          headers: { "content-type": "text/plain" },
        }))),
    );
    return;
  }

  // Same-origin static asset: cache-first for the shell list, otherwise pass
  // through. Keeps the cache small and predictable.
  if (SHELL_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => cached ?? fetch(req)),
    );
  }
});
