import type {
  Assignment,
  Bitacora,
  Boat,
  Estado,
  FleetEntry,
  FiltrosReportes,
  NewBitacora,
  NewReport,
  Profile,
  RangoFechas,
  Report,
  Rol,
  Ruta,
  Session,
} from '../types';

/**
 * Interfaz única de acceso a datos.
 * Se implementa en modo 'local' (demo, localStorage) o 'supabase' (PostgreSQL real).
 * Los componentes NO saben qué implementación hay detrás.
 */
export interface DataSource {
  mode: 'local' | 'supabase';

  // Auth
  login(email: string, password: string): Promise<Session | null>;
  logout(): Promise<void>;
  getSession(): Promise<Session | null>;

  // Catálogos
  listBarcos(): Promise<Boat[]>;
  listEstados(): Promise<Estado[]>;
  listRutas(): Promise<Ruta[]>;
  listProfiles(): Promise<Profile[]>;
  listAsignaciones(): Promise<Assignment[]>;

  // Bitácoras (Check Bitácora diaria)
  getBitacoraDeHoy(barcoId: string): Promise<Bitacora | null>;
  /** Bitácora de HOY creada por un capitán (define el barco de su día). */
  getBitacoraDeHoyDelCapitan(capitanId: string): Promise<Bitacora | null>;
  listBitacoras(rango?: RangoFechas): Promise<Bitacora[]>;
  createBitacora(input: NewBitacora): Promise<Bitacora>;
  updateBitacora(id: string, input: Partial<NewBitacora>): Promise<Bitacora>;

  // Reportes
  listUltimosReportes(): Promise<Report[]>; // último reporte por barco (mapa)
  listReportes(rango?: RangoFechas, filtros?: FiltrosReportes): Promise<Report[]>;
  listReportesDeBarco(barcoId: string, desde: Date, hasta: Date): Promise<Report[]>;
  insertReporte(input: NewReport): Promise<Report>;
  deleteReportesDeBarco(barcoId: string): Promise<void>;

  // Admin (solo operación; la BD lo garantiza con RLS)
  addBarco(nombre: string, capacidadPax: number): Promise<Boat>;
  updateBarco(id: string, cambios: Partial<Pick<Boat, 'nombre' | 'capacidad_pax' | 'activo'>>): Promise<Boat>;
  removeBarco(id: string): Promise<void>;
  addEstado(nombre: string, color: string, esRecogida?: boolean, esDesembarque?: boolean): Promise<Estado>;
  updateEstado(id: string, cambios: Partial<Pick<Estado, 'nombre' | 'color' | 'es_recogida' | 'es_desembarque'>>): Promise<Estado>;
  removeEstado(id: string): Promise<void>;
  addRuta(nombre: string): Promise<Ruta>;
  removeRuta(id: string): Promise<void>;
  updateProfile(id: string, cambios: { nombre?: string; rol?: Rol }): Promise<Profile>;
  assignBoat(perfilId: string, barcoId: string, opciones?: { es_capitan?: boolean; es_principal?: boolean }): Promise<void>;
  unassignBoat(perfilId: string, barcoId: string): Promise<void>;

  // Tiempo real: reportes y bitácoras nuevos
  onNewReport(cb: (r: Report) => void): () => void;
  onBitacoraChange(cb: (b: Bitacora) => void): () => void;

  // Solo modo local (demo)
  simularReporteEntrante?(): Promise<void>;
}

/** Une reportes con sus catálogos para la UI. */
export function joinFleet(
  reports: Report[],
  barcos: Boat[],
  estados: Estado[],
  perfiles: Profile[],
): FleetEntry[] {
  return reports.map((report) => ({
    report,
    barco:
      barcos.find((b) => b.id === report.barco_id) ?? {
        id: report.barco_id,
        nombre: 'Desconocido',
        capacidad_pax: 0,
        activo: true,
      },
    estado: estados.find((e) => e.id === report.estado_id) ?? null,
    operador: perfiles.find((p) => p.id === report.operador_id) ?? null,
  }));
}
