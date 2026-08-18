// ==========================================
// api_config.js - Configuración del Sistema
// ==========================================

// 1. URLs de conexión e integración
const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbwJXsV6GtjguGwutu_mQUq3WcsFIaUwZMJfr27Ub6C6yDkSX16f8F9lvant1QxUG00WnQ/exec";
const CSV_QUERY = encodeURIComponent("SELECT A,B,C,D,E,F,G,H WHERE B IS NOT NULL");
const CSV_SHEET_URL = `https://docs.google.com/spreadsheets/d/1UKFOp1K8YFFE9VMLhTi3iJIH5rEHve-9ZWx_-Dke35s/gviz/tq?tqx=out:csv&sheet=hoja%201&tq=${CSV_QUERY}`;

// 2. Configuración predeterminada de Barcos y Estados
const DEFAULT_CONFIG = {
  barcos: [
    "Valhalla",
    "Hope",
    "Cahua",
    "Odisea",
    "Chicote",
    "Papichulo",
    "Harb",
    "Charlie",
    "Alisio",
    "Mistral"
  ],
  estados: [
    "🛥️ En transito / Rumbo a",
    "⚓ Arribado / En destino",
    "🟡 En amarre",
    "📸 Panoramico",
    "↗️ Pasando por",
    "🔧 En mantenimiento",
    "⛽ Abastecimiento / Tanqueo",
    "🧽 En preparación / Limpieza",
    "🔴 Fuera de servicio / Inactivo",
    "⛈️ Refugiado por mal tiempo"
  ]
};

// 3. Lógica para cargar los datos instantáneamente (Ignorar si no eres desarrollador)
window.obtenerConfiguracion = function () {
  try {
    const localData = localStorage.getItem('colombia_navega_config');
    if (localData) {
      const parsed = JSON.parse(localData);
      if (parsed && Array.isArray(parsed.barcos) && Array.isArray(parsed.estados)) {
        return parsed; // Retorna la config guardada por el usuario si existe
      }
    }
  } catch (e) {
    console.warn("Usando configuración por defecto.", e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG)); // Retorna la config por defecto
};