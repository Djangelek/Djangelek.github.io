# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Capitanes** — están en el mar con el teléfono, a menudo con sol, una sola mano y conexión inestable. Su primer acto del día es la **Check Bitácora** de su barco; después solo reportan.
- **Marineros** — tripulación con **cuenta propia** (rol `marinero`), asignados a un barco por operaciones. Envían el **Reporte Operativo** desde el teléfono, una vez el capitán ha hecho la bitácora del día.
- **Operaciones** — administradores de la plataforma, en PC. Gestionan barcos, estados, rutas, tripulaciones (marineros), asignaciones y pueden editar nombres y configuraciones; ven toda la operación en vivo.
- **Ventas / supervisores** — roles de **solo lectura completa** en PC: mapa en vivo, bitácoras, historial y **exportación a Excel**, sin poder editar nada.

## Product Purpose

Monitoreo y registro de la operación diaria de una flota de embarcaciones turísticas: ubicación en vivo, estado/actividad de cada barco, pasajeros y equipaje, y una bitácora diaria por embarcación que deja trazabilidad completa del día. El éxito es que operaciones y ventas sepan, de un vistazo en PC, qué está pasando con cada barco en tiempo real, y que la tripulación registre todo desde el teléfono sin fricción.

## Positioning

La **bitácora diaria obligatoria** es el mecanismo central: cada barco abre su día con la Check Bitácora (fecha, tripulación, ruta, pasajeros, combustible) y solo entonces quedan habilitados los reportes operativos del día. Cada reporte queda ligado a quién lo envió, en qué barco y a qué hora — una cadena de registro del día que un competidor genérico de mapas no ofrece.

## Operating Context

- Operación marítima turística en Cartagena, Colombia (yates/embarcaciones).
- GPS físico: trackers de la flota (gomezgps) cuyas posiciones se ingieren con un scraper y una edge function de Supabase; el mapa en vivo combina esa posición con el último reporte.
- Ritual matutino: la bitácora se hace en la mañana, antes de cualquier reporte del día.
- Condiciones de campo: brillo solar fuerte, agua, una mano ocupada, señal móvil intermitente (los reportes deben poder enviarse apenas haya señal).
- Términos del dominio: bitácora, reporte operativo, PAX (pasajeros), equipaje (maletas/bolsos), ruta, nivel de combustible, embarcación/yate, estado/actividad, capitán, marinero, operación, ventas.

## Capabilities and Constraints

- **Roles**: `capitan` (solo reporta), `marinero` (reporta tras la bitácora), `operacion` (admin total), `ventas`/supervisores (solo lectura + exportar). Hoy el esquema solo tiene `capitan`/`operacion` — pendiente migrar a los cuatro roles.
- **Check Bitácora** (una por barco y por día): fecha automática, barco, marineros (seleccionados de la tripulación registrada por operaciones), ruta (**lista administrada por operaciones**), número de pasajeros inicial, nivel de combustible. Hasta que no existe la bitácora del día, el barco **no** habilita reportes para su tripulación.
- **Reporte Operativo**: embarcación (auto según asignación), estado/actividad, lugar/referencia, pasajeros, maletas, bolsos. El estado **"recogida de pasajeros"** es el único que despliega pasajeros/maletas/bolsos; los demás estados solo piden ubicación y qué hace la embarcación. Pasajeros/maletas/bolsos se pre-rellenan desde el reporte anterior.
- **Estados/actividades** administrables por operaciones con color propio.
- **Mapa en vivo** (Leaflet + tracker GPS) con último reporte por barco, resumen de flota, alertas de barcos sin reporte reciente, sonido y notificaciones para operaciones.
- **Historial** por barco y global; **exportación a Excel**.
- PWA instalable (workbox) con modo demo local sin backend (`localSource`); producción sobre **Supabase** (Postgres + RLS + Realtime + edge functions).
- Idioma: español (Colombia). Restricción: sin framework de componentes — React + CSS propio.

## Brand Commitments

- Nombre: **Colombia Navega** (footer de la app).
- Identidad náutica con emojis de dominio (⛵ 📡 📋) en la interfaz actual; logos en `app/public/logo.jpg` e íconos PWA.
- Voz en español, directa y operativa (instrucciones cortas para tripulación).

## Evidence on Hand

- Esquema SQL real: `app/supabase/schema.sql` (perfiles, barcos, estados, asignaciones, reportes, RLS).
- Estados por defecto: En navegación, Fondeado, En puerto, Emergencia.
- Históricos GPS reales: `gps-scraper/output/*.csv` (Yate Cahua, Chicote, Hope, Papi Chulo, Valhalla…).
- App funcional: `app/` (React + TypeScript + Vite).
- No hay testimonios ni métricas de uso reales; no inventarlos.

## Product Principles

1. **El teléfono de la tripulación manda**: reportar debe costar pocos toques, ser legible bajo el sol y tolerar mala señal.
2. **La bitácora primero**: ningún reporte del día sin la Check Bitácora previa del barco.
3. **Trazabilidad total**: cada dato tiene autor, barco y hora.
4. **Supervisión de un vistazo**: en PC, la flota completa y su estado en vivo se leen sin navegar.
5. **Cada rol ve exactamente lo suyo**: capitanes reportan, marineros reportan su barco, operaciones administra, ventas solo lee.

## Accessibility & Inclusion

- Uso al aire libre: contraste alto, tamaños táctiles grandes (móvil), operación con una mano.
- Idiomas: español.
- La vista de escritorio debe ser cómoda en pantallas grandes (mapa y panel de flota amplios).
