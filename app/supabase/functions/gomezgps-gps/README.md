# gomezgps-gps — Edge Function de Supabase

Puente entre la **plataforma Gomez GPS** (`https://plataforma.gomezgps.com`)
y la app **Colombia Navega**. El navegador no puede llamar a GomezGPS
directamente (no hay CORS y no conviene exponer las credenciales): esta
función hace login con la cuenta de la flota, mantiene la sesión en memoria
y expone la posición actual de cada barco en JSON.

## Cómo la usa la app

- `app/src/services/gps.ts` — llama a `{SUPABASE_URL}/functions/v1/gomezgps-gps`
  con el JWT del usuario (`Authorization: Bearer …`).
- `app/src/hooks/useGpsPositions.ts` — poll cada 30 s (react-query).
- `app/src/components/map/GpsMarkers.tsx` — marcadores ⚓ sobre el mapa
  (`Dashboard`). Verde = en movimiento, amarillo = conectado/parado,
  rojo = sin señal.
- El nombre del barco (ej. "YATE HOPE") se empareja con la tabla `barcos`
  normalizando mayúsculas/tildes; si coincide, el popup enlaza a la
  bitácora local.

## Despliegue

Requisito: [Supabase CLI](https://supabase.com/docs/guides/cli) y un
proyecto Supabase ya creado.

```bash
# desde la carpeta app/ de este repo
cd app

supabase login
supabase link --project-ref <TU_PROJECT_REF>

# credenciales de la cuenta GomezGPS (NUNCA en el frontend)
supabase secrets set GOMEZGPS_EMAIL=info@navegacolombia.com
supabase secrets set GOMEZGPS_PASSWORD=tu_password

# opcional: REQUIRE_AUTH=true (default) exige JWT de Supabase válido
supabase functions deploy gomezgps-gps
```

> Si la carpeta `supabase/` aún no está inicializada para el CLI, ejecuta
> `supabase init` una vez dentro de `app/` (genera `supabase/config.toml`
> sin tocar `supabase/schema.sql` ni `supabase/functions/`).

## Prueba

Con tu JWT (p. ej. desde la consola de la app tras iniciar sesión):

```bash
curl -H "Authorization: Bearer <JWT>" \
  https://<TU_PROJECT_REF>.supabase.co/functions/v1/gomezgps-gps
```

Respuesta:

```json
{
  "ok": true,
  "cached": false,
  "fetched_at": "2026-08-31T15:33:00.000Z",
  "items": [
    {
      "id": 56,
      "name": "YATE CHICOTE",
      "online": "online",
      "lat": 10.281415,
      "lng": -75.625738,
      "speed": 6.48,
      "course": 207,
      "altitude": 0,
      "time": "2026-08-31T10:09:44-05:00"
    }
  ]
}
```

## Notas

- **Cache**: la función guarda la sesión de GomezGPS y los datos 15 s en
  memoria, así varios usuarios no saturan la plataforma (la web de GomezGPS
  hace poll cada 5 s; con esto el ritmo real es ≤ 4 llamadas/min).
- **Estados GPS**: `online` = en movimiento, `ack` = conectado/parado,
  `offline` = sin señal (puede llevar días sin reportar, como ODDY SEA).
- **Fechas**: el servidor de GomezGPS reporta en UTC-5 (Colombia); la
  función convierte a ISO con offset.
- Si cambia la contraseña de la cuenta GomezGPS, actualiza los secrets:
  `supabase secrets set GOMEZGPS_PASSWORD=…` (la sesión vieja caduca sola
  en ~50 min o al primer 401).
