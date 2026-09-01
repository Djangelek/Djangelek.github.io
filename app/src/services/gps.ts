import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { GpsSnapshot } from '../types/gps';

/**
 * Servicio GPS: llama a la Edge Function `gomezgps-gps` de Supabase,
 * que hace de puente con la plataforma GomezGPS (login + snapshot).
 * El navegador nunca toca GomezGPS directamente.
 */

let client: SupabaseClient | null = null;
function supabase(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) {
    throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en app/.env');
  }
  client = createClient(url, key);
  return client;
}

/** El GPS solo aplica en modo supabase (en modo local no hay Edge Function). */
export const gpsEnabled = (import.meta.env.VITE_DATA_SOURCE as string | undefined) === 'supabase';

export async function fetchGpsSnapshot(): Promise<GpsSnapshot> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gomezgps-gps`;
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token ?? '';
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      /* cuerpo no JSON */
    }
    throw new Error(`Edge function gomezgps-gps: ${detail}`);
  }
  return (await res.json()) as GpsSnapshot;
}

/** Normaliza nombres para emparejar barcos de GomezGPS con la tabla `barcos`. */
export function normalizarNombre(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
