export type Rol = 'capitan' | 'marinero' | 'operacion' | 'ventas';

export interface Profile {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
}

export interface Boat {
  id: string;
  nombre: string;
  capacidad_pax: number;
  activo: boolean;
}

export interface Estado {
  id: string;
  nombre: string;
  color: string;
  /** true → el reporte pide pasajeros/maletas/bolsos (embarque) */
  es_recogida: boolean;
  /** true → estado de desembarque: reinicia pasajeros y equipaje a 0 */
  es_desembarque: boolean;
}

export interface Ruta {
  id: string;
  nombre: string;
  activo: boolean;
}

/** Tripulación: capitán (es_capitan=true) o marinero (false) en un barco. */
export interface Assignment {
  id: string;
  perfil_id: string;
  barco_id: string;
  es_capitan: boolean;
  es_principal: boolean;
}

/** Check Bitácora diaria: una por barco y día. */
export interface Bitacora {
  id: string;
  barco_id: string;
  capitan_id: string | null;
  fecha: string; // YYYY-MM-DD (hora local de la operación)
  ruta_id: string | null;
  pasajeros: number;
  combustible: number | null; // 0–100
  /** Coordenadas donde se selló la bitácora (GPS del capitán). */
  lat: number | null;
  lng: number | null;
  /** Ids de perfil de los marineros a bordo ese día. */
  marineros: string[];
  created_at: string;
  updated_at: string;
}

export interface NewBitacora {
  barco_id: string;
  capitan_id: string | null;
  ruta_id: string | null;
  pasajeros: number;
  combustible: number | null;
  lat?: number | null;
  lng?: number | null;
  marineros?: string[];
}

export interface Report {
  id: string;
  barco_id: string;
  bitacora_id: string | null;
  estado_id: string;
  operador_id: string;
  pasajeros: number;
  maletas: number;
  bolsos: number;
  equipaje: number; // legado: maletas + bolsos
  lugar: string;
  lat: number | null;
  lng: number | null;
  notas: string;
  created_at: string;
}

export interface NewReport {
  barco_id: string;
  bitacora_id: string | null;
  estado_id: string;
  pasajeros: number;
  maletas: number;
  bolsos: number;
  lugar: string;
  lat: number | null;
  lng: number | null;
  notas: string;
}

export interface Session {
  profile: Profile;
}

export interface RangoFechas {
  desde: Date;
  hasta: Date;
}

export interface FiltrosReportes {
  barcoId?: string;
  estadoId?: string;
}

export interface FleetEntry {
  report: Report;
  barco: Boat;
  estado: Estado | null;
  operador: Profile | null;
}
