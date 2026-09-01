// =====================================================================
// gomezgps-gps — Edge Function de Supabase
// ---------------------------------------------------------------------
// Puente entre la plataforma Gomez GPS (https://plataforma.gomezgps.com)
// y la app Colombia Navega. El navegador NO puede llamar a GomezGPS
// directamente (CORS + credenciales): esta función hace login con la
// cuenta de la flota, cachea la sesión y expone la posición actual de
// cada barco en JSON.
//
// Despliegue (desde app/):
//   supabase login
//   supabase link --project-ref <TU_PROJECT_REF>
//   supabase secrets set GOMEZGPS_EMAIL=info@navegacolombia.com
//   supabase secrets set GOMEZGPS_PASSWORD=tu_password
//   supabase functions deploy gomezgps-gps
//
// Llamada desde la app (con sesión iniciada en Supabase):
//   GET {SUPABASE_URL}/functions/v1/gomezgps-gps
//   Authorization: Bearer <access_token del usuario>
//
// Respuesta:
//   { ok: true, cached: bool, fetched_at: ISO, items: [{ id, name,
//     online, lat, lng, speed, course, altitude, time }] }
//
// Secrets:
//   GOMEZGPS_EMAIL / GOMEZGPS_PASSWORD  (obligatorios)
//   REQUIRE_AUTH = 'true' (default) → exige JWT de Supabase válido.
//     Poner 'false' solo para pruebas locales sin app.
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const BASE = 'https://plataforma.gomezgps.com';
const CACHE_MS = 15_000; // no golpear GomezGPS más de una vez cada 15 s
const SESSION_TTL_MS = 50 * 60_000; // re-login si la sesión tiene > 50 min

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface GpsItem {
  id: number;
  name: string;
  online: string;
  lat: number | null;
  lng: number | null;
  speed: number | null; // nudos
  course: number | null;
  altitude: number | null;
  time: string | null; // ISO (el servidor reporta en UTC-5, Colombia)
}

// Estado en memoria de la sesión de GomezGPS (persiste entre invocaciones
// "calientes" de la función, que es lo normal en Supabase Edge).
let sessionCookies = '';
let sessionAt = 0;
let cache: { at: number; payload: GpsItem[] } | null = null;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' },
  });
}

function getSetCookies(headers: Headers): string[] {
  try {
    return headers.getSetCookie();
  } catch {
    const h = headers.get('set-cookie');
    return h ? [h] : [];
  }
}

/** Guarda las cookies Set-Cookie en un "jar" simple (string Cookie). */
function mergeCookies(setCookies: string[]): void {
  for (const c of setCookies) {
    const pair = c.split(';')[0];
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const name = pair.slice(0, eq);
    const keep = sessionCookies
      .split('; ')
      .filter((x) => x && !x.startsWith(name + '='));
    keep.push(pair);
    sessionCookies = keep.join('; ');
  }
}

/**
 * fetch con seguimiento manual de redirects: fusiona las Set-Cookie de
 * CADA salto en el jar y reenvía el Cookie actualizado (GomezGPS responde
 * 302 → /login cuando no hay sesión). Con redirect:'manual' nativo nos
 * quedaríamos con el cuerpo vacío del 302.
 */
async function request(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string | URLSearchParams } = {},
  maxRedirects = 5,
): Promise<Response> {
  let current = url;
  let method = init.method ?? 'GET';
  let body = init.body;
  const headers = new Headers(init.headers ?? {});
  for (let i = 0; i <= maxRedirects; i++) {
    // El jar de cookies se inyecta en cada salto (header dinámico)
    if (sessionCookies) headers.set('cookie', sessionCookies);
    const res = await fetch(current, { method, headers, body, redirect: 'manual' });
    mergeCookies(getSetCookies(res.headers));
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return res;
      current = new URL(loc, current).toString();
      // Tras un redirect el POST se convierte en GET (comportamiento HTTP estándar)
      method = 'GET';
      body = undefined;
      headers.delete('content-type');
      continue;
    }
    return res;
  }
  throw new Error(`Demasiados redirects en ${url}`);
}

function extractToken(html: string): string {
  const m = html.match(/name="_token" type="hidden" value="([^"]+)"/);
  if (m) return m[1];
  const meta = html.match(/<meta name="csrf-token" content="([^"]+)"/);
  return meta ? meta[1] : '';
}

/** Login a GomezGPS: GET /objects (→ /login, CSRF) → POST /authentication/store. */
async function login(): Promise<void> {
  // 1) Página de login (el GET sigue el 302 → /login) → cookie + token CSRF
  const page = await request(`${BASE}/objects`);
  const html = await page.text();
  const token = extractToken(html);
  if (!token) throw new Error('No se pudo obtener el token CSRF de GomezGPS');

  // 2) POST de login (manda la cookie de sesión + el token); el 302 final
  //    aterriza en /objects con la cookie de sesión ya en el jar.
  await request(`${BASE}/authentication/store`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: sessionCookies,
    },
    body: new URLSearchParams({
      identifier: Deno.env.get('GOMEZGPS_EMAIL') ?? '',
      password: Deno.env.get('GOMEZGPS_PASSWORD') ?? '',
      remember_me: '1',
      _token: token,
    }),
  });
  sessionAt = Date.now();

  // 3) Verificación: /objects con sesión debe traer la app (objeto "urls"),
  //    no la pantalla de login ("sign-in-layout").
  const check = await request(`${BASE}/objects`);
  const checkHtml = await check.text();
  if (checkHtml.includes('sign-in-layout') || !checkHtml.includes('"urls"')) {
    throw new Error(
      'Login a GomezGPS fallido: revisa GOMEZGPS_EMAIL / GOMEZGPS_PASSWORD',
    );
  }
}

async function ensureSession(): Promise<void> {
  if (sessionCookies && Date.now() - sessionAt < SESSION_TTL_MS) return;
  await login();
}

/** "2026-08-31 10:09:44" (UTC-5) → ISO con offset. */
function toIso(s: string | null): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!m) return s;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}-05:00`;
}

function toNum(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

/** GET /objects/items → snapshot de todos los barcos (posición actual). */
async function fetchItems(): Promise<GpsItem[]> {
  await ensureSession();

  const attempt = async (): Promise<GpsItem[]> => {
    const res = await request(`${BASE}/objects/items`, {
      headers: { cookie: sessionCookies, accept: 'application/json' },
    });
    const text = await res.text();
    if (!text.trim().startsWith('{')) {
      // Devuelve HTML de login → sesión caducada
      throw new Error('Sesión caducada');
    }
    const data = JSON.parse(text) as { data?: Record<string, unknown>[] };
    const raw = Array.isArray(data?.data) ? data.data : [];
    return raw.map((b) => ({
      id: Number(b.id) || 0,
      name: String(b.name ?? ''),
      online: String(b.online ?? ''),
      lat: toNum(b.lat),
      lng: toNum(b.lng),
      speed: toNum(b.speed),
      course: toNum(b.course),
      altitude: toNum(b.altitude),
      time: toIso(String(b.time ?? '')),
    }));
  };

  try {
    return await attempt();
  } catch {
    // Sesión caducada → re-login una sola vez y reintentar
    sessionCookies = '';
    await login();
    return attempt();
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // --- Autenticación: exige un JWT de Supabase válido --------------
  const requireAuth = (Deno.env.get('REQUIRE_AUTH') ?? 'true').toLowerCase() !== 'false';
  if (requireAuth) {
    const auth = req.headers.get('authorization') ?? '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return json({ ok: false, error: 'Falta Authorization: Bearer <JWT de Supabase>' }, 401);
    }
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      );
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) {
        return json({ ok: false, error: 'JWT inválido o expirado' }, 401);
      }
    } catch {
      return json({ ok: false, error: 'No se pudo verificar el JWT' }, 500);
    }
  }

  // --- Cache corto para no saturar GomezGPS con varios usuarios -----
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return json({
      ok: true,
      cached: true,
      fetched_at: new Date(cache.at).toISOString(),
      items: cache.payload,
    });
  }

  try {
    const items = await fetchItems();
    cache = { at: Date.now(), payload: items };
    return json({
      ok: true,
      cached: false,
      fetched_at: new Date().toISOString(),
      items,
    });
  } catch (e) {
    return json(
      { ok: false, error: e instanceof Error ? e.message : 'Error interno' },
      502,
    );
  }
});
