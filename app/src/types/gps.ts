/**
 * Tipos del puente GPS (Edge Function gomezgps-gps).
 * Los datos vienen de la plataforma Gomez GPS vía Supabase Edge Function.
 */

export type GpsOnline = 'online' | 'ack' | 'offline' | string;

export interface GpsBoat {
  /** id interno en la plataforma GomezGPS */
  id: number;
  /** nombre del yate/barco, ej. "YATE HOPE" */
  name: string;
  /** online = en movimiento, ack = conectado/parado, offline = sin señal */
  online: GpsOnline;
  lat: number | null;
  lng: number | null;
  /** velocidad en nudos */
  speed: number | null;
  /** rumbo en grados (0–360) */
  course: number | null;
  altitude: number | null;
  /** hora del último reporte GPS (ISO) */
  time: string | null;
}

export interface GpsSnapshot {
  ok: boolean;
  cached?: boolean;
  fetched_at?: string;
  items: GpsBoat[];
  error?: string;
}
