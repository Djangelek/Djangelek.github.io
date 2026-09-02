import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ds } from './index';

/**
 * services/maintainX.ts — Órdenes de mantenimiento hacia MaintainX.
 *
 * El navegador NO llama a MaintainX directamente: pasa por la edge function
 * de Supabase `maintainx`, que guarda el token de la API como secret y
 * verifica la sesión del usuario (ver app/supabase/functions/maintainx/).
 * Solo funciona en modo 'supabase'; en modo demo local no hay backend.
 *
 * Flujo: 1) POST → crea la work request (título + descripción + prioridad),
 *        2) PUT por cada foto → attachments/evidenciaN.jpg (bytes comprimidos).
 */

export type PrioridadMantenimiento = 'LOW' | 'MEDIUM' | 'HIGH';

export interface OrdenMantenimiento {
  title: string;
  description: string;
  priority?: PrioridadMantenimiento;
  /** Ids opcionales de MaintainX (activo/ubicación) — null si no hay mapeo. */
  assetId?: number | null;
  locationId?: number | null;
}

export interface ResultadoMantenimiento {
  workrequestId: number;
  fotosSubidas: number;
  fotosFallidas: number;
}

/** Lado más largo al que se reduce cada foto antes de subirla (~≤1 MB). */
const MAX_LADO_PX = 1600;
const CALIDAD_JPEG = 0.82;
const MAX_FOTOS = 6;

let cliente: SupabaseClient | null = null;

function config(): { url: string; key: string } {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) {
    throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en app/.env');
  }
  return { url, key };
}

function getCliente(): SupabaseClient {
  const { url, key } = config();
  cliente ??= createClient(url, key);
  return cliente;
}

async function tokenSesion(): Promise<string> {
  const { data } = await getCliente().auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Sesión expirada — vuelve a entrar a la app');
  }
  return token;
}

/** URL de la edge function maintainx. */
function fnUrl(): string {
  return `${config().url}/functions/v1/maintainx`;
}

/** Comprime una foto a JPEG (máx. MAX_LADO_PX). Si no se puede decodificar
 *  (HEIC, etc.), devuelve el archivo original sin tocar. */
async function comprimirFoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // sin decodificador → se manda el original
  }
  try {
    const lado = Math.max(bitmap.width, bitmap.height);
    const escala = Math.min(1, MAX_LADO_PX / lado);
    const w = Math.max(1, Math.round(bitmap.width * escala));
    const h = Math.max(1, Math.round(bitmap.height * escala));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', CALIDAD_JPEG),
    );
    if (blob) return blob;
    return file;
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}

async function crearOrden(
  orden: OrdenMantenimiento,
  token: string,
): Promise<number> {
  const payload: Record<string, unknown> = {
    title: orden.title,
    description: orden.description,
  };
  if (orden.priority) payload.priority = orden.priority;
  if (orden.assetId) payload.assetId = orden.assetId;
  if (orden.locationId) payload.locationId = orden.locationId;

  const res = await fetch(fnUrl(), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    workrequest?: { id?: number };
  };
  if (!res.ok || !data.ok || !data.workrequest?.id) {
    throw new Error(data.error ?? `MaintainX respondió HTTP ${res.status}`);
  }
  return data.workrequest.id;
}

async function adjuntarFoto(
  workrequestId: number,
  blob: Blob,
  filename: string,
  token: string,
): Promise<void> {
  const q = new URLSearchParams({ op: 'attachment' });
  q.set('workrequestId', String(workrequestId));
  q.set('filename', filename);
  const res = await fetch(`${fnUrl()}?${q.toString()}`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': blob.type || 'application/octet-stream',
    },
    body: blob,
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? `No se pudo adjuntar ${filename} (HTTP ${res.status})`);
  }
}

/** Verifica que el modo actual pueda enviar órdenes (requiere Supabase). */
export function mantenimientoDisponible(): boolean {
  return ds.mode === 'supabase';
}

export function motivoNoDisponible(): string {
  return 'Las órdenes de mantenimiento se envían por Supabase; actívalo con VITE_DATA_SOURCE=supabase.';
}

/**
 * Crea la work request en MaintainX y adjunta las fotos (evidencia1.jpg,
 * evidencia2.jpg, …). Si una foto falla no se aborta el resto; se reporta
 * cuántas quedaron pendientes.
 */
export async function enviarOrdenMantenimiento(
  orden: OrdenMantenimiento,
  fotos: File[],
  onFotos?: (subidas: number, total: number) => void,
): Promise<ResultadoMantenimiento> {
  if (!mantenimientoDisponible()) throw new Error(motivoNoDisponible());
  const token = await tokenSesion();

  const workrequestId = await crearOrden(orden, token);

  let fotosSubidas = 0;
  let fotosFallidas = 0;
  const elegidas = fotos.slice(0, MAX_FOTOS);
  for (let i = 0; i < elegidas.length; i++) {
    try {
      const blob = await comprimirFoto(elegidas[i]);
      await adjuntarFoto(workrequestId, blob, `evidencia${i + 1}.jpg`, token);
      fotosSubidas++;
    } catch {
      fotosFallidas++;
    }
    onFotos?.(fotosSubidas, elegidas.length);
  }

  return { workrequestId, fotosSubidas, fotosFallidas };
}
