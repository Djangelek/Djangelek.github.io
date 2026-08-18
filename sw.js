// ============================================================
// sw.js — Service Worker Principal
// Colombia Navega — Control Flota Náutica
// ============================================================
// Responsabilidades:
//   1. Precaché de assets estáticos (UI disponible offline)
//   2. Intercepción de fetch al webhook → guarda en IndexedDB
//      si no hay red (manejado desde la página, no aquí)
//   3. Background Sync: cuando regresa la red, envía todos los
//      reportes guardados en IndexedDB al servidor.
// ============================================================

// Importa el módulo de IndexedDB (compartido con la página)
importScripts('./offline-db.js');

const CACHE_NAME = 'colombia-navega-v1';

// Assets que se cachearán en el install para funcionamiento offline
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './api_config.js',
  './offline-db.js',
  './images.webp',
  './manifest.json',
];

// ── INSTALL: precaché de la shell de la app ──────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precacheando assets estáticos...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // Activa el nuevo SW inmediatamente sin esperar que se cierren tabs
  self.skipWaiting();
});

// ── ACTIVATE: limpia cachés antiguas ─────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Eliminando caché antigua:', key);
            return caches.delete(key);
          })
      )
    )
  );
  // Toma control de todas las tabs abiertas inmediatamente
  self.clients.claim();
});

// ── FETCH: estrategia Cache-First para assets, Network-First para datos ──
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // La Cache API sólo soporta http/https. Ignorar chrome-extension://, data:, etc.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Deja pasar requests al webhook y a Google Sheets sin interceptar
  // (la lógica offline la maneja enviarAWebhook() en la página)
  if (
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('docs.google.com') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('basemaps.cartocdn.com')
  ) {
    return; // Sin interceptar — comportamiento normal del navegador
  }

  // Para assets locales: Cache-First
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      // No está en caché → red
      return fetch(event.request).then((networkResponse) => {
        // Guarda una copia en caché para futuras visitas offline
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type !== 'opaque'
        ) {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return networkResponse;
      });
    })
  );
});

// ── BACKGROUND SYNC: envía reportes pendientes ───────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reportes-pendientes') {
    console.log('[SW] Background Sync activado — enviando reportes pendientes...');
    event.waitUntil(enviarReportesPendientes());
  }
});

/**
 * Lee todos los reportes de IndexedDB y los envía al webhook.
 * Si el envío es exitoso, los borra de la cola.
 * Si falla, los deja para el próximo intento de sync.
 */
async function enviarReportesPendientes() {
  let pendientes;
  try {
    pendientes = await obtenerReportesPendientes();
  } catch (err) {
    console.error('[SW] Error leyendo IndexedDB:', err);
    return;
  }

  if (pendientes.length === 0) {
    console.log('[SW] No hay reportes pendientes.');
    return;
  }

  console.log(`[SW] Enviando ${pendientes.length} reporte(s) pendiente(s)...`);

  // Obtener la URL del webhook desde api_config.js cacheado
  // Como el SW no puede leer variables de la página, usamos un store auxiliar
  // o la URL se embebe directamente (ver nota abajo)
  const WEBHOOK_URL = await obtenerWebhookURL();
  if (!WEBHOOK_URL) {
    console.error('[SW] No se encontró la URL del webhook.');
    return;
  }

  const resultados = await Promise.allSettled(
    pendientes.map(async (registro) => {
      try {
        await fetch(WEBHOOK_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(registro.payload),
        });
        // Con no-cors el status siempre es 0 (opaque) cuando no hay error de red.
        // Si fetch resuelve sin lanzar, asumimos éxito (igual que en la página).
        await eliminarReportePendiente(registro.id);
        console.log(`[SW] Reporte ID=${registro.id} enviado y eliminado.`);

        // Notifica a la página para que actualice el badge de pendientes
        notificarClientes({ tipo: 'reporte_enviado', id: registro.id });
      } catch (err) {
        console.warn(`[SW] Fallo al enviar reporte ID=${registro.id}:`, err);
        throw err; // re-lanza para que Promise.allSettled lo marque como rejected
      }
    })
  );

  const exitosos = resultados.filter((r) => r.status === 'fulfilled').length;
  const fallidos = resultados.filter((r) => r.status === 'rejected').length;
  console.log(`[SW] Sync completado: ${exitosos} enviados, ${fallidos} fallidos.`);
}

/**
 * Lee la URL del webhook desde la caché de configuración guardada por la página.
 * La página escribe WEBHOOK_URL en IndexedDB store "config" al cargar.
 * @returns {Promise<string|null>}
 */
async function obtenerWebhookURL() {
  try {
    const db = await abrirDB();
    return new Promise((resolve) => {
      // Intenta abrir el store "config" — si no existe, usa fallback
      try {
        const tx = db.transaction('config', 'readonly');
        const store = tx.objectStore('config');
        const req = store.get('webhook_url');
        req.onsuccess = (e) => resolve(e.target.result ? e.target.result.value : null);
        req.onerror = () => resolve(null);
        tx.oncomplete = () => db.close();
      } catch {
        db.close();
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

/**
 * Envía un mensaje a todas las tabs abiertas de la app.
 * @param {Object} mensaje
 */
async function notificarClientes(mensaje) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach((client) => client.postMessage(mensaje));
}
