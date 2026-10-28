// Service Worker Oficial — O CORTE PWA
// Atende aos critérios de installability (WebAPK / Standalone) do Chromium/Android
// com estratégia Network-First para navegação e páginas dinâmicas.

const CACHE_NAME = 'ocorte-pwa-v1';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Ignora falha individual de precache para não bloquear instalação do SW
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignora requisições que não sejam GET ou de outros protocolos (chrome-extension, etc.)
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) {
    return;
  }

  // Ignora rotas de API, webhooks ou chamadas de autenticação para evitar cache indevido
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.includes('supabase')) {
    return;
  }

  // Navegação HTML: Network-First com fallback para o cache '/'
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/').then((cached) => cached || Response.error())
      )
    );
    return;
  }

  // Assets estáticos (ícones, fontes, manifest): Network-First com atualização de cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (
          response &&
          response.status === 200 &&
          response.type === 'basic' &&
          (url.pathname.endsWith('.png') ||
            url.pathname.endsWith('.svg') ||
            url.pathname.endsWith('.ico') ||
            url.pathname.endsWith('.woff2'))
        ) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
