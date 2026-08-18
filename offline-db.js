// ============================================================
// offline-db.js — Módulo IndexedDB para reportes pendientes
// Colombia Navega — Control Flota Náutica
// ============================================================
// Gestiona la cola de reportes que no pudieron enviarse por falta
// de conexión. Se usa tanto desde index.html (página principal)
// como desde sw.js (Service Worker, contexto separado).
// ============================================================

const DB_NAME = 'colombia_navega_offline';
const DB_VERSION = 2;          // v2: agrega store "config" para webhook_url
const STORE_NAME = 'reportes_pendientes';
const CONFIG_STORE = 'config'; // store clave-valor para configuración

/**
 * Abre (o crea) la base de datos IndexedDB.
 * @returns {Promise<IDBDatabase>}
 */
function abrirDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // autoIncrement genera IDs únicos; "timestamp" permite ordenar
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      // Store de configuración (clave-valor) para compartir datos con el SW
      if (!db.objectStoreNames.contains(CONFIG_STORE)) {
        db.createObjectStore(CONFIG_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Guarda un payload de reporte en la cola offline.
 * @param {Object} payload — Datos del reporte (embarcacion, estado, etc.)
 * @returns {Promise<number>} ID asignado por IndexedDB
 */
async function guardarReportePendiente(payload) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record = {
      payload: payload,
      timestamp: Date.now(),
      intentos: 0,
    };
    const req = store.add(record);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Devuelve todos los reportes pendientes en orden de llegada.
 * @returns {Promise<Array>}
 */
async function obtenerReportesPendientes() {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = (e) => resolve(e.target.result || []);
    req.onerror = (e) => reject(e.target.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Elimina un reporte de la cola por su ID.
 * @param {number} id — keyPath del registro en IndexedDB
 * @returns {Promise<void>}
 */
async function eliminarReportePendiente(id) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Cuenta cuántos reportes hay en cola.
 * @returns {Promise<number>}
 */
async function contarReportesPendientes() {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Guarda un par clave-valor en el store "config".
 * Se usa para persistir la WEBHOOK_URL accesible desde el SW.
 * @param {string} key
 * @param {*} value
 */
async function guardarConfig(key, value) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONFIG_STORE, 'readwrite');
    const store = tx.objectStore(CONFIG_STORE);
    const req = store.put({ key, value });
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Lee un valor del store "config" por su clave.
 * @param {string} key
 * @returns {Promise<*>}
 */
async function leerConfig(key) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONFIG_STORE, 'readonly');
    const store = tx.objectStore(CONFIG_STORE);
    const req = store.get(key);
    req.onsuccess = (e) => resolve(e.target.result ? e.target.result.value : null);
    req.onerror = (e) => reject(e.target.error);
    tx.oncomplete = () => db.close();
  });
}

// Exporta para uso como módulo en sw.js (importScripts) y en index.html
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    guardarReportePendiente,
    obtenerReportesPendientes,
    eliminarReportePendiente,
    contarReportesPendientes,
    guardarConfig,
    leerConfig,
  };
}
