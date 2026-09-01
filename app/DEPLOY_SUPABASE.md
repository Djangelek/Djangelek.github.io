# Despliegue en Supabase desde cero (sin proyecto existente)

Guía paso a paso para poner en marcha la app **Colombia Navega** + el GPS
en vivo (Edge Function `gomezgps-gps`) en un proyecto Supabase **nuevo**.

Tiempo estimado: **~30 min**. No necesitas instalar nada si usas el
Dashboard (camino A); el camino B usa el CLI de Supabase.

---

## Paso 1 — Crear cuenta y proyecto

1. Entra a <https://supabase.com> → **Sign in** (GitHub, Google o email).
2. **New project**:
   - *Organization*: crea una (ej. "Navega Colombia").
   - *Name*: `colombia-navega` (o el que quieras).
   - *Database Password*: pon una y **guárdala** (la pide el CLI en el
     camino B y para backups).
   - *Region*: la más cercana a Colombia → **South America (East) – São Paulo**.
   - **Create new project** y espera ~1–2 min a que termine.

## Paso 2 — Aplicar el esquema (tablas + seguridad RLS)

1. Dashboard → **SQL Editor** → *New query*.
2. Pega el contenido completo de `app/supabase/schema.sql` (el de este repo).
3. **Run** → debe mostrar *Success*.

Crea: `profiles`, `barcos`, `estados` (con 4 estados por defecto),
`asignaciones`, `reportes`, la vista `ultimos_reportes`, triggers
(perfil automático al registrarse, operador forzado) y todas las
políticas RLS.

## Paso 3 — (Recomendado) Registrar los barcos

Para que los marcadores GPS ⚓ se enlacen con la bitácora local por nombre:

1. **Table Editor** → `barcos` → *Insert row*.
2. Añade los 6 yates con el mismo nombre que en GomezGPS:
   `YATE HOPE`, `YATE ODDY SEA`, `YATE PAPI CHULO`, `YATE VALHALLA`,
   `YATE CAHUA`, `YATE CHICOTE` (la app normaliza mayúsculas/tildes al
   emparejar). `capacidad_pax` déjalo en 0 y edítalo después si quieres.

## Paso 4 — Desplegar la Edge Function (GPS)

### Camino A: desde el Dashboard (sin instalar nada)

1. Menú lateral → **Edge Functions** → **Deploy a new function**.
2. *Name*: `gomezgps-gps` → pega el contenido de
   `app/supabase/functions/gomezgps-gps/index.ts` → **Deploy**.
3. Pon las credenciales de GomezGPS como **secrets**:
   - **Project Settings** → **Edge Functions** → **Secrets** → *Add secret*:
     - `GOMEZGPS_EMAIL` = `info@navegacolombia.com`
     - `GOMEZGPS_PASSWORD` = `tu_password_de_gomezgps`
   - ⚠️ NO definas `SUPABASE_URL` ni `SUPABASE_ANON_KEY`: la plataforma las
     inyecta automáticamente en cada Edge Function.
   - `REQUIRE_AUTH` ya está en `'true'` por defecto (exige JWT válido).

### Camino B: con el CLI de Supabase (requiere Node, ya lo tienes)

```bash
# desde la carpeta app/ de este repo
cd app

npx supabase login                 # abre el navegador para autorizar
npx supabase init                  # crea supabase/config.toml (no toca schema.sql ni functions/)
npx supabase link --project-ref <PROJECT_REF>   # REF en Project Settings → General → Reference

npx supabase secrets set GOMEZGPS_EMAIL=info@navegacolombia.com
npx supabase secrets set GOMEZGPS_PASSWORD=tu_password

npx supabase functions deploy gomezgps-gps
```

## Paso 5 — Crear los usuarios (login de la app)

La app usa Supabase Auth (email + contraseña) y **no tiene pantalla de
registro**, así que creas los usuarios desde el Dashboard:

1. **Authentication** → **Users** → *Add user* → email + contraseña
   (ej. `capitan@navegacolombia.com` y `operacion@navegacolombia.com`).
2. El trigger crea el `profiles` automáticamente con `rol = 'capitan'`.
3. Para dar acceso a **operación** (el que ve el mapa por defecto):
   - **Table Editor** → `profiles` → edita la fila del usuario y pon
     `rol = 'operacion'` y guarda; o ejecuta en SQL Editor (el email
     vive en `auth.users`, no en `profiles`):
     ```sql
     update public.profiles p
     set rol = 'operacion'
     from auth.users u
     where u.id = p.id and u.email = 'operacion@navegacolombia.com';
     ```

## Paso 6 — Configurar la app (app/.env)

1. Copia `app/.env.example` → `app/.env`.
2. Completa (todo se obtiene en **Project Settings** → **API**):
   ```
   VITE_DATA_SOURCE=supabase
   VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon/public key>
   ```
   - *Project URL* → `VITE_SUPABASE_URL`
   - *anon public key* → `VITE_SUPABASE_ANON_KEY`
   - La anon key es **segura** en el frontend porque las tablas tienen RLS
     (solo lectura para usuarios autenticados).
3. Prueba local:
   ```bash
   cd app
   npm run dev
   ```
   Login con el usuario `operacion` → `/mapa` → verás los **⚓ GPS en vivo**
   junto a los reportes, y el chip `📡 GPS en vivo · N barcos`.
4. Build para producción:
   ```bash
   npm run build        # genera dist/
   ```
   Despliega `dist/` como lo haces normalmente (GitHub Pages, Vercel, etc.).

## Paso 7 — Probar la función directamente (opcional)

1. Obtén un JWT: en la consola de la app logueada ejecuta
   ```js
   (await supabase.auth.getSession()).data.session.access_token
   ```
2. Lánzala:
   ```bash
   curl -H "Authorization: Bearer <JWT>" \
     https://<PROJECT_REF>.supabase.co/functions/v1/gomezgps-gps
   ```
   Debe responder `{ "ok": true, "items": [ ...6 barcos con lat/lng... ] }`.

---

## Checklist final

- [ ] Proyecto creado (región São Paulo)
- [ ] `schema.sql` ejecutado sin errores
- [ ] 6 barcos en la tabla `barcos`
- [ ] Edge Function `gomezgps-gps` desplegada + secrets `GOMEZGPS_EMAIL`/`GOMEZGPS_PASSWORD`
- [ ] Al menos 1 usuario con `rol = 'operacion'`
- [ ] `app/.env` con `VITE_DATA_SOURCE=supabase` + URL + anon key
- [ ] `/mapa` muestra los ⚓ y el chip GPS en vivo
