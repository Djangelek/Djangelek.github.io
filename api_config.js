// ==========================================
// api_config.js - Configuración del Sistema
// ==========================================

const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxbvgtRoUNFmEUfVKsygVEP6xX5dWeIjjWJqtPC4XJ4Mks7sH5bsS5qfigpfenQHkSaPw/exec";
// 1. Hoja principal (gid=0)
const CSV_SHEET_URL = "https://docs.google.com/spreadsheets/d/1UKFOp1K8YFFE9VMLhTi3iJIH5rEHve-9ZWx_-Dke35s/gviz/tq?tqx=out:csv&gid=0";

// 2. Registros de Bitácora (gid=1035293616)
const CSV_BITACORA_URL = "https://docs.google.com/spreadsheets/d/1UKFOp1K8YFFE9VMLhTi3iJIH5rEHve-9ZWx_-Dke35s/gviz/tq?tqx=out:csv&gid=1035293616";
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


function obtenerConfiguracion() {
  try {
    const saved = localStorage.getItem('colombia_navega_config');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn("No se pudo leer localStorage:", e);
  }
  return DEFAULT_CONFIG;
}