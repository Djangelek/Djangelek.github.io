importScripts('offline-db.js');

// 1. Cambia este nombre en cada despliegue para forzar el reemplazo del caché
const CACHE_NAME = 'colombia-navega-v8';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './api_config.js',
  './offline-db.js',
  './images.webp'
];

// INSTALACIÓN: Descarga forzando la solicitud al servidor (bypasseando caché HTTP)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const requests = ASSETS_TO_CACHE.map((url) => {
        // cache: 'reload' obliga al navegador a buscar el archivo en el servidor web
        return fetch(new Request(url, { cache: 'reload' })).then((response) => {
          if (!response.ok) {
            throw new Error(`Error descargando ${url}: ${response.statusText}`);
          }
          return cache.put(url, response);
        });
      });
      return Promise.all(requests);
    })
  );
  // NOTA: Eliminamos self.skipWaiting() para no romper sesiones activas
});

// ACTIVACIÓN: Elimina cachés antiguos y notifica a las pestañas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  // NOTA: Eliminamos self.clients.claim()
});

// ESCUCHA DE MENSAJES: Permite forzar la actualización si la app se lo pide
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

// INTERCEPTACIÓN DE PETICIONES
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Ignorar peticiones externas (Google Sheets, Webhooks, APIs)
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // ESTRATEGIA NETWORK-FIRST PARA DOCUMENTOS HTML Y CONFIG
  // Esto asegura que index.html siempre intente buscar la versión más reciente si hay red
  if (event.request.mode === 'navigate' || requestUrl.pathname.endsWith('api_config.js')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => caches.match(event.request)) // Fallback a caché si está sin conexión
    );
    return;
  }

  // ESTRATEGIA CACHE-FIRST PARA EL RESTO DE ASSETS ESTÁTICOS
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});

// SINCRONIZACIÓN EN SEGUNDO PLANO
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reportes-pendientes') {
    event.waitUntil(procesarReportesPendientesSW());
  }
});

async function procesarReportesPendientesSW() {
  try {
    const pendientes = await obtenerReportesPendientes();
    if (!pendientes || pendientes.length === 0) return;

    const webhookUrl = await obtenerConfig('webhook_url');
    if (!webhookUrl) return;

    for (const registro of pendientes) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(registro.payload),
        });
        await eliminarReportePendiente(registro.id);
      } catch (err) {
        console.warn('[SW] Fallo al enviar reporte guardado ID=' + registro.id, err);
      }
    }

    const clientsList = await self.clients.matchAll();
    for (const client of clientsList) {
      client.postMessage({ tipo: 'reporte_enviado' });
    }
  } catch (err) {
    console.error('[SW] Error en procesarReportesPendientesSW:', err);
  }
}