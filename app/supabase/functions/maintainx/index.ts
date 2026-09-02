// =====================================================================
// maintainx — Edge Function de Supabase
// ---------------------------------------------------------------------
// Puente entre la app Colombia Navega y la API de MaintainX.
// El navegador NO puede llamar a MaintainX directamente (no hay CORS y el
// token API no debe viajar en el bundle de la PWA): esta función guarda el
// token como secret, verifica la sesión de Supabase del usuario y reenvía
// la orden de trabajo (work request) + las fotos/evidencia.
//
// Despliegue (desde app/):
//   supabase login
//   supabase link --project-ref <TU_PROJECT_REF>
//   supabase secrets set MAINTAINX_TOKEN=<API key de MaintainX>
//   supabase functions deploy maintainx
//
// Llamadas desde la app (con sesión iniciada en Supabase):
//   1) Crear la work request:
//      POST {SUPABASE_URL}/functions/v1/maintainx
//      Authorization: Bearer <access_token del usuario>
//      Content-Type: application/json
//      { "title": "Fuga de agua en camarote proa",
//        "description": "…contexto completo…",
//        "assetId": 1234, "locationId": 567, "priority": "HIGH" }
//      → 200 { ok: true, workrequest: { id: 963 } }
//
//   2) Adjuntar una foto/evidencia (repetir por cada archivo):
//      PUT {SUPABASE_URL}/functions/v1/maintainx?op=attachment&workrequestId=963&filename=evidencia1.jpg
//      Authorization: Bearer <access_token del usuario>
//      Content-Type: image/jpeg        ← el tipo real del archivo
//      body: bytes del archivo (binario)
//      → 200 { ok: true, attachment: { filename: "evidencia1.jpg" } }
//
// Secrets:
//   MAINTAINX_TOKEN  (obligatorio) — API key de MaintainX, en la app web:
//     Settings → Integrations → API Keys (app.getmaintainx.com). La key es
//     un JWT; se envía como "Authorization: Bearer <token>".
//   REQUIRE_AUTH = 'true' (default) → exige JWT de Supabase válido.
//     Poner 'false' solo para pruebas locales sin app.
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const MAINTAINX_BASE = 'https://api.getmaintainx.com/v1';

/** Roles que pueden crear órdenes de mantenimiento (capitán + operación/admin). */
const ROLES_PERMITIDOS = ['capitan', 'operacion'];

const LIMITE_CREATE_BYTES = 200_000; // cuerpo JSON
const LIMITE_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB por archivo
const NOMBRE_ARCHIVO = /^[A-Za-z0-9][A-Za-z0-9._-]{0,140}$/;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' },
  });
}

/** Lee el error de MaintainX (texto plano o JSON) para mostrarlo al usuario. */
async function mensajeMaintainX(res: Response): Promise<string> {
  const text = (await res.text()).slice(0, 400);
  try {
    const parsed = JSON.parse(text) as { message?: string; errors?: unknown };
    if (typeof parsed.message === 'string' && parsed.message) return parsed.message;
  } catch {
    // no era JSON → se usa el texto crudo
  }
  return text.trim() || `HTTP ${res.status}`;
}

interface UsuarioVerificado {
  id: string;
  rol: string | null;
}

/** Valida el JWT de Supabase y devuelve el rol del perfil (o una Response de error). */
async function verificarUsuario(req: Request): Promise<UsuarioVerificado | Response> {
  const requireAuth = (Deno.env.get('REQUIRE_AUTH') ?? 'true').toLowerCase() !== 'false';
  if (!requireAuth) return { id: 'sin-auth', rol: 'operacion' };

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
    const { data: perfil } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', data.user.id)
      .maybeSingle();
    return { id: data.user.id, rol: perfil?.rol ?? null };
  } catch {
    return json({ ok: false, error: 'No se pudo verificar el JWT' }, 500);
  }
}

/** POST /workrequests — crea la orden de trabajo. */
async function crearWorkRequest(body: unknown, token: string): Promise<Response> {
  const b = body as Record<string, unknown>;
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (!title) return json({ ok: false, error: 'El título es obligatorio' }, 400);
  if (title.length > 200) {
    return json({ ok: false, error: 'El título no puede pasar de 200 caracteres' }, 400);
  }

  const payload: Record<string, unknown> = { title };
  const descripcion = typeof b.description === 'string' ? b.description.trim() : '';
  if (descripcion) {
    if (descripcion.length > 5000) {
      return json({ ok: false, error: 'La descripción no puede pasar de 5000 caracteres' }, 400);
    }
    payload.description = descripcion;
  }
  const PRIORIDADES = ['NONE', 'LOW', 'MEDIUM', 'HIGH'];
  if (b.priority !== undefined && b.priority !== null && b.priority !== '') {
    if (!PRIORIDADES.includes(String(b.priority))) {
      return json(
        { ok: false, error: `Prioridad inválida: debe ser ${PRIORIDADES.join(', ')}` },
        400,
      );
    }
    payload.priority = String(b.priority);
  }
  for (const campo of ['assetId', 'locationId'] as const) {
    const v = b[campo];
    if (v !== undefined && v !== null && v !== '') {
      const n = Number(v);
      if (!Number.isInteger(n) || n <= 0) {
        return json({ ok: false, error: `${campo} debe ser un id entero positivo` }, 400);
      }
      payload[campo] = n;
    }
  }

  const res = await fetch(`${MAINTAINX_BASE}/workrequests`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    const detail = text.trim().slice(0, 300);
    return json(
      { ok: false, error: `MaintainX rechazó la orden (${res.status}): ${detail || 'sin detalle'}` },
      502,
    );
  }
  const data = (text ? JSON.parse(text) : {}) as { id?: number };
  if (!data.id) return json({ ok: false, error: 'MaintainX no devolvió el id de la orden' }, 502);
  return json({ ok: true, workrequest: { id: data.id } });
}

/** PUT /workrequests/{id}/attachments/{filename} — adjunta un archivo binario. */
async function adjuntarArchivo(
  req: Request,
  params: URLSearchParams,
  token: string,
): Promise<Response> {
  const id = Number(params.get('workrequestId'));
  const filename = params.get('filename') ?? '';
  if (!Number.isInteger(id) || id <= 0) {
    return json({ ok: false, error: 'workrequestId debe ser un id entero positivo' }, 400);
  }
  if (!NOMBRE_ARCHIVO.test(filename)) {
    return json(
      { ok: false, error: 'Nombre de archivo no válido (solo letras, números, . _ -)' },
      400,
    );
  }

  const bytes = await req.arrayBuffer();
  if (bytes.byteLength === 0) {
    return json({ ok: false, error: 'El archivo está vacío' }, 400);
  }
  if (bytes.byteLength > LIMITE_ATTACHMENT_BYTES) {
    return json(
      { ok: false, error: 'El archivo pasa de 10 MB — comprime la foto e inténtalo de nuevo' },
      413,
    );
  }

  const contentType = req.headers.get('content-type') ?? 'application/octet-stream';
  const res = await fetch(
    `${MAINTAINX_BASE}/workrequests/${id}/attachments/${encodeURIComponent(filename)}`,
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': contentType,
      },
      body: bytes,
    },
  );
  if (!res.ok) {
    const detail = await mensajeMaintainX(res);
    return json(
      { ok: false, error: `No se pudo adjuntar ${filename} (${res.status}): ${detail}` },
      502,
    );
  }
  return json({ ok: true, attachment: { filename } });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const token = Deno.env.get('MAINTAINX_TOKEN');
  if (!token) {
    return json(
      { ok: false, error: 'Falta el secret MAINTAINX_TOKEN en la función' },
      500,
    );
  }

  const usuario = await verificarUsuario(req);
  if (usuario instanceof Response) return usuario;
  if (usuario.rol && !ROLES_PERMITIDOS.includes(usuario.rol)) {
    return json(
      { ok: false, error: `Tu rol (${usuario.rol}) no puede enviar órdenes de mantenimiento` },
      403,
    );
  }

  const url = new URL(req.url);
  const op = url.searchParams.get('op') ?? 'create';

  try {
    if (op === 'attachment') {
      return await adjuntarArchivo(req, url.searchParams, token);
    }
    if (op === 'create') {
      if (req.method !== 'POST') {
        return json({ ok: false, error: 'Para crear usa POST' }, 405);
      }
      const contentLength = Number(req.headers.get('content-length') ?? 0);
      if (contentLength > LIMITE_CREATE_BYTES) {
        return json({ ok: false, error: 'Cuerpo demasiado grande' }, 413);
      }
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return json({ ok: false, error: 'El cuerpo debe ser JSON válido' }, 400);
      }
      return await crearWorkRequest(body, token);
    }
    return json({ ok: false, error: `Operación desconocida: ${op}` }, 400);
  } catch (e) {
    return json(
      { ok: false, error: e instanceof Error ? e.message : 'Error interno' },
      502,
    );
  }
});
