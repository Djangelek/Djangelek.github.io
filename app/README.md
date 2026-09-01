# Colombia Navega v2 — Control de flota náutica

Nueva versión del proyecto (React + TypeScript + Vite), pensada como **producto**:

- **👨‍✈️ Capitán (móvil)**: reporta en pocos toques. Su barco viene asignado desde la bitácora
  (no lo escribe), repite lugar/PAX del último reporte, GPS automático, y ve su bitácora del día.
- **🖥️ Operación (PC)**: mapa en tiempo real, resumen de flota, **notificación sonora y visual**
  cuando llega un reporte nuevo, alertas de barcos sin reporte, vista por barco con
  **recorrido del día y distancia**, historial por rango de fechas y **exportación a Excel (.xlsx)**.

El backend es **intercambiable**: funciona en modo demo (localStorage, sin servidor) o contra
**Supabase** (PostgreSQL real con autenticación y seguridad por fila).

## Cómo ejecutar

```bash
cd app
npm install
npm run dev        # abre http://localhost:5173
```

### Modo demo (sin base de datos)

Es el modo por defecto (`VITE_DATA_SOURCE=local`). Usa datos de ejemplo y persiste en el navegador.

Cuentas demo (contraseña `demo123`):

| Rol | Email |
|---|---|
| Capitán | `capitan@colombianavega.co` |
| Operación | `operacion@colombianavega.co` |
| Capitana | `capitan2@colombianavega.co` |

> Tip demo: abre dos pestañas (una con capitán, otra con operación) y pulsa
> **"Simular reporte entrante"** en el panel de operación para ver la notificación sonora.

## Conectar a Supabase (base de datos real)

1. Crea un proyecto gratis en <https://supabase.com>.
2. En **SQL Editor**, pega y ejecuta `supabase/schema.sql` (tablas, vista, RLS, trigger de perfiles).
3. En **Authentication → Users**, crea los usuarios (ej. `capitan@colombianavega.co` / una clave).
4. Edita el rol del perfil en la tabla `profiles` (operación) si hace falta.
5. En **Project Settings → API**, copia la URL y la `anon` key.
6. Crea `app/.env` (ver `app/.env.example`):

```env
VITE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

7. Reinicia `npm run dev`. La misma app ahora lee/escribe en PostgreSQL con RLS.

## Instalar como app en el celular (PWA)

La app es una **PWA**: se instala como aplicación nativa sin tiendas ni APK.

- **Android (Chrome)**: abre la app → menú ⋮ (arriba a la derecha) → **"Agregar a pantalla de inicio"** → "Instalar". Aparecerá con icono propio, a pantalla completa y funcionando sin conexión.
- **iPhone (Safari)**: abre la app → botón **Compartir** (cuadro con flecha ↑) → **"Agregar a pantalla de inicio"** → "Agregar".

Requisito: la app debe servirse por **HTTPS** (GitHub Pages ya lo da) o en `localhost` durante el desarrollo.

> Para probar el service worker en desarrollo: `npm run dev` y abre la app en `http://localhost:5173`; la primera visita lo registra y las siguientes funcionan offline.

## Desplegar en GitHub Pages

```bash
cd app
npm run build          # genera app/dist (con rutas relativas)
```

Sube el contenido de `app/dist` al repositorio (la app funciona desde `https://djangelek.github.io/app/`
o desde la raíz). Los datos no viven en GitHub: viven en Supabase.

## Estructura

```
app/
├── supabase/schema.sql        # Esquema SQL + RLS completo
├── src/
│   ├── services/              # Capa de datos intercambiable
│   │   ├── dataSource.ts      #   interfaz única
│   │   ├── localSource.ts     #   demo (localStorage)
│   │   └── supabaseSource.ts  #   producción (Supabase)
│   ├── hooks/                 # useAuth, useFleet, useHistory, useGeolocation…
│   ├── components/            # layout, auth, report, dashboard, boat, history, admin
│   ├── export/exportExcel.ts  # generación del .xlsx con exceljs
│   ├── store/                 # Zustand (sonido, notificaciones, toasts)
│   └── utils/                 # formato de fechas, haversine, sonido
└── index.html
```

## Ideas pendientes (roadmap)

- Registro de capitanes autogestionado (Supabase Auth ya lo permite; el trigger crea el perfil).
- Alertas sonoras diferenciadas (reporte nuevo vs. barco silencioso).
- Exportar también en CSV.
- PWA / instalable con service worker.
