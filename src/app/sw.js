const PRECACHE_NAME = "flechettas-precache-v1";
const PAGES_CACHE_NAME = "flechettas-pages-v1";

/**
 * @typedef {{ url: string }} PrecacheObject
 * @typedef {string | PrecacheObject} PrecacheEntry
 * @typedef {{ waitUntil: (promise: Promise<unknown>) => void }} FlechettasExtendableEvent
 * @typedef {FlechettasExtendableEvent & { request: Request, respondWith: (response: Promise<Response> | Response) => void }} FlechettasFetchEvent
 * @typedef {FlechettasExtendableEvent & { data?: unknown }} FlechettasMessageEvent
 * @typedef {typeof globalThis & {
 *   __SW_MANIFEST?: PrecacheEntry[],
 *   addEventListener: (type: string, listener: (event: FlechettasFetchEvent) => void) => void,
 *   clients: { claim: () => Promise<void> },
 *   location: Location,
 *   skipWaiting: () => Promise<void>
 * }} FlechettasServiceWorkerGlobal
 */

/** @type {FlechettasServiceWorkerGlobal} */
const serviceWorkerGlobal = self;
const precacheEntries = serviceWorkerGlobal.__SW_MANIFEST ?? [];

const isSkipWaitingMessage = (message) =>
  typeof message === "object" &&
  message !== null &&
  "type" in message &&
  message.type === "SKIP_WAITING";

const getPrecacheUrls = () =>
  precacheEntries
    .map((entry) => (typeof entry === "string" ? entry : entry.url))
    .filter(Boolean);

const getCachedNavigationFallback = async (request) =>
  (await caches.match(request)) ??
  (await caches.match("/fr")) ??
  (await caches.match("/")) ??
  Response.error();

serviceWorkerGlobal.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE_NAME)
      .then((cache) => cache.addAll(getPrecacheUrls())),
  );
});

serviceWorkerGlobal.addEventListener("activate", (event) => {
  const expectedCaches = new Set([PRECACHE_NAME, PAGES_CACHE_NAME]);
  const expectedPrecacheUrls = new Set(getPrecacheUrls());

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => !expectedCaches.has(cacheName))
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => caches.open(PRECACHE_NAME))
      .then((cache) =>
        cache.keys().then((requests) =>
          Promise.all(
            requests
              .filter((request) => {
                const requestUrl = new URL(request.url);

                return !expectedPrecacheUrls.has(requestUrl.pathname);
              })
              .map((request) => cache.delete(request)),
          ),
        ),
      )
      .then(() => serviceWorkerGlobal.clients.claim()),
  );
});

serviceWorkerGlobal.addEventListener("message", (event) => {
  const messageEvent = /** @type {FlechettasMessageEvent} */ (event);

  if (isSkipWaitingMessage(messageEvent.data)) {
    event.waitUntil(serviceWorkerGlobal.skipWaiting());
  }
});

serviceWorkerGlobal.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== serviceWorkerGlobal.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseCopy = response.clone();
            event.waitUntil(
              caches.open(PAGES_CACHE_NAME).then((cache) =>
                cache.put(request, responseCopy),
              ),
            );
          }

          return response;
        })
        .catch(() => getCachedNavigationFallback(request)),
    );
    return;
  }

  if (getPrecacheUrls().includes(requestUrl.pathname)) {
    event.respondWith(caches.match(request).then((response) => response ?? fetch(request)));
  }
});
