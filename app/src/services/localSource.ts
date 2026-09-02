import type {
  Assignment,
  Bitacora,
  Boat,
  Estado,
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
import type { DataSource } from './dataSource';

/**
 * Modo DEMO: persiste todo en localStorage con datos de ejemplo.
 * Funciona sin backend: ideal para desarrollar y demostrar el producto.
 * Reproduce el gate de la bitácora del día igual que la BD real.
 */

interface DB {
  profiles: Profile[];
  barcos: Boat[];
  estados: Estado[];
  rutas: Ruta[];
  asignaciones: Assignment[];
  bitacoras: Bitacora[];
  reportes: Report[];
}

const DB_KEY = 'cnv3_db_v1';
const SESSION_KEY = 'cnv3_session_v1';
export const PASSWORD_DEMO = 'demo123';

const iso = (d: Date) => d.toISOString();
const haceHoras = (h: number) => iso(new Date(Date.now() - h * 3600_000));
const haceMin = (m: number) => iso(new Date(Date.now() - m * 60_000));

/** Fecha de hoy en la zona de la operación (Colombia), formato YYYY-MM-DD. */
function fechaHoy(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

function seed(): DB {
  const profiles: Profile[] = [
    { id: 'p1', email: 'capitan@colombianavega.co', nombre: 'Capitán Juan Pérez', rol: 'capitan' },
    { id: 'p2', email: 'operacion@colombianavega.co', nombre: 'Carlos Operación', rol: 'operacion' },
    { id: 'p3', email: 'capitana@colombianavega.co', nombre: 'Capitana María Torres', rol: 'capitan' },
    { id: 'p4', email: 'marinero@colombianavega.co', nombre: 'Luis Marín', rol: 'marinero' },
    { id: 'p5', email: 'marinera@colombianavega.co', nombre: 'Ana Ríos', rol: 'marinero' },
    { id: 'p6', email: 'ventas@colombianavega.co', nombre: 'Ventas Colombia Navega', rol: 'ventas' },
  ];

  const barcos: Boat[] = [
    { id: 'b1', nombre: 'Barcaza Calamar', capacidad_pax: 80, activo: true },
    { id: 'b2', nombre: 'Yate Isla del Sol', capacidad_pax: 45, activo: true },
    { id: 'b3', nombre: 'Lancha Don Pepe', capacidad_pax: 25, activo: true },
    { id: 'b4', nombre: 'Catamarán Mar Azul', capacidad_pax: 60, activo: true },
  ];

  const estados: Estado[] = [
    { id: 'e0', nombre: 'Recogida de pasajeros', color: '#e0a03c', es_recogida: true, es_desembarque: false },
    { id: 'e1', nombre: 'En navegación', color: '#22c55e', es_recogida: false, es_desembarque: false },
    { id: 'e2', nombre: 'Fondeado', color: '#38bdf8', es_recogida: false, es_desembarque: false },
    { id: 'e3', nombre: 'En puerto', color: '#f59e0b', es_recogida: false, es_desembarque: false },
    { id: 'e4', nombre: 'Emergencia', color: '#ef4444', es_recogida: false, es_desembarque: false },
    { id: 'e5', nombre: 'Desembarque de pasajeros', color: '#6366f1', es_recogida: false, es_desembarque: true },
  ];

  const rutas: Ruta[] = [
    { id: 'rt1', nombre: 'Cartagena → Islas del Rosario', activo: true },
    { id: 'rt2', nombre: 'Cartagena → Cholón', activo: true },
    { id: 'rt3', nombre: 'Cartagena → Playa Blanca', activo: true },
    { id: 'rt4', nombre: 'Bahía de Cartagena', activo: true },
  ];

  const asignaciones: Assignment[] = [
    { id: 'a1', perfil_id: 'p1', barco_id: 'b1', es_capitan: true, es_principal: true },
    { id: 'a2', perfil_id: 'p3', barco_id: 'b2', es_capitan: true, es_principal: true },
    { id: 'a3', perfil_id: 'p3', barco_id: 'b3', es_capitan: true, es_principal: false },
    { id: 'a4', perfil_id: 'p4', barco_id: 'b1', es_capitan: false, es_principal: false },
    { id: 'a5', perfil_id: 'p5', barco_id: 'b2', es_capitan: false, es_principal: false },
    { id: 'a6', perfil_id: 'p5', barco_id: 'b3', es_capitan: false, es_principal: false },
  ];

  const hoy = fechaHoy();
  const bitacoras: Bitacora[] = [
    {
      id: 'bit1',
      barco_id: 'b1',
      capitan_id: 'p1',
      fecha: hoy,
      ruta_id: 'rt1',
      pasajeros: 52,
      combustible: 80,
      lat: 10.407,
      lng: -75.545,
      marineros: ['p4'],
      created_at: haceHoras(8),
      updated_at: haceHoras(8),
    },
    {
      id: 'bit2',
      barco_id: 'b2',
      capitan_id: 'p3',
      fecha: hoy,
      ruta_id: 'rt3',
      pasajeros: 28,
      combustible: 65,
      lat: 10.32,
      lng: -75.58,
      marineros: ['p5'],
      created_at: haceHoras(7),
      updated_at: haceHoras(7),
    },
    // b3 y b4 no tienen bitácora hoy → su tripulación NO puede reportar (gate)
  ];

  const reportes: Report[] = [
    // Barcaza Calamar (bitácora bit1): recogida → navegación → fondeado
    { id: 'r1', barco_id: 'b1', bitacora_id: 'bit1', estado_id: 'e0', operador_id: 'p1', pasajeros: 52, maletas: 30, bolsos: 22, equipaje: 52, lugar: 'Muelle La Bodeguita', lat: 10.407, lng: -75.545, notas: 'Recogida completa, 07:10', created_at: haceHoras(8) },
    { id: 'r2', barco_id: 'b1', bitacora_id: 'bit1', estado_id: 'e1', operador_id: 'p4', pasajeros: 52, maletas: 30, bolsos: 22, equipaje: 52, lugar: 'Frente a Tierrabomba', lat: 10.347, lng: -75.565, notas: '', created_at: haceHoras(7) },
    { id: 'r3', barco_id: 'b1', bitacora_id: 'bit1', estado_id: 'e1', operador_id: 'p4', pasajeros: 50, maletas: 30, bolsos: 22, equipaje: 52, lugar: 'Cholón', lat: 10.27, lng: -75.71, notas: '2 pax en planchón', created_at: haceHoras(5) },
    { id: 'r4', barco_id: 'b1', bitacora_id: 'bit1', estado_id: 'e2', operador_id: 'p1', pasajeros: 50, maletas: 30, bolsos: 22, equipaje: 52, lugar: 'Isla Grande', lat: 10.19, lng: -75.74, notas: 'Fondeado', created_at: haceMin(35) },
    // Yate Isla del Sol (bitácora bit2)
    { id: 'r5', barco_id: 'b2', bitacora_id: 'bit2', estado_id: 'e0', operador_id: 'p3', pasajeros: 28, maletas: 18, bolsos: 10, equipaje: 28, lugar: 'Muelle La Bodeguita', lat: 10.407, lng: -75.545, notas: '', created_at: haceHoras(7) },
    { id: 'r6', barco_id: 'b2', bitacora_id: 'bit2', estado_id: 'e1', operador_id: 'p5', pasajeros: 28, maletas: 18, bolsos: 10, equipaje: 28, lugar: 'Bocachica', lat: 10.32, lng: -75.58, notas: '', created_at: haceHoras(6) },
    { id: 'r7', barco_id: 'b2', bitacora_id: 'bit2', estado_id: 'e2', operador_id: 'p5', pasajeros: 26, maletas: 18, bolsos: 10, equipaje: 28, lugar: 'Playa Blanca', lat: 10.175, lng: -75.765, notas: '', created_at: haceMin(50) },
    // Lancha Don Pepe (SIN bitácora hoy → no debería tener reportes de hoy)
    // Catamarán Mar Azul: sin bitácora ni reporte → alerta de operación
  ];

  return { profiles, barcos, estados, rutas, asignaciones, bitacoras, reportes };
}

export class LocalSource implements DataSource {
  mode = 'local' as const;
  private db: DB;
  private listeners = new Set<(r: Report) => void>();
  private bitacoraListeners = new Set<(b: Bitacora) => void>();

  constructor() {
    this.db = this.load();
    // Sincronización entre pestañas
    window.addEventListener('storage', (e) => {
      if (e.key !== DB_KEY) return;
      const prevIds = new Set(this.db.reportes.map((r) => r.id));
      this.db = this.load();
      this.db.reportes.forEach((r) => {
        if (!prevIds.has(r.id)) this.emit(r);
      });
    });
  }

  private load(): DB {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) return JSON.parse(raw) as DB;
    } catch {
      // datos corruptos → reseed
    }
    const db = seed();
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    return db;
  }

  private persist() {
    localStorage.setItem(DB_KEY, JSON.stringify(this.db));
  }

  private emit(r: Report) {
    this.listeners.forEach((cb) => cb(r));
  }

  private emitBitacora(b: Bitacora) {
    this.bitacoraListeners.forEach((cb) => cb(b));
  }

  private perfilActual(): Profile | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return (JSON.parse(raw) as Session).profile;
    } catch {
      return null;
    }
  }

  onNewReport(cb: (r: Report) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  onBitacoraChange(cb: (b: Bitacora) => void): () => void {
    this.bitacoraListeners.add(cb);
    return () => this.bitacoraListeners.delete(cb);
  }

  async login(email: string, password: string): Promise<Session | null> {
    if (password !== PASSWORD_DEMO) {
      throw new Error(`Contraseña incorrecta — en la demo es "${PASSWORD_DEMO}"`);
    }
    const profile = this.db.profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());
    if (!profile) {
      throw new Error('Email no registrado en la demo — usa los botones de acceso rápido');
    }
    const session: Session = { profile };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  async logout(): Promise<void> {
    sessionStorage.removeItem(SESSION_KEY);
  }

  async getSession(): Promise<Session | null> {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') as Session | null;
    } catch {
      return null;
    }
  }

  async listBarcos(): Promise<Boat[]> {
    return [...this.db.barcos];
  }
  async listEstados(): Promise<Estado[]> {
    return [...this.db.estados];
  }
  async listRutas(): Promise<Ruta[]> {
    return [...this.db.rutas];
  }
  async listProfiles(): Promise<Profile[]> {
    return [...this.db.profiles];
  }
  async listAsignaciones(): Promise<Assignment[]> {
    return [...this.db.asignaciones];
  }

  // ---- Bitácoras -------------------------------------------------

  async getBitacoraDeHoy(barcoId: string): Promise<Bitacora | null> {
    const hoy = fechaHoy();
    return this.db.bitacoras.find((b) => b.barco_id === barcoId && b.fecha === hoy) ?? null;
  }

  async getBitacoraDeHoyDelCapitan(capitanId: string): Promise<Bitacora | null> {
    const hoy = fechaHoy();
    return this.db.bitacoras.find((b) => b.capitan_id === capitanId && b.fecha === hoy) ?? null;
  }

  async listBitacoras(rango?: RangoFechas): Promise<Bitacora[]> {
    return this.db.bitacoras
      .filter((b) => {
        if (rango) {
          const t = new Date(`${b.fecha}T12:00:00`).getTime();
          if (t < rango.desde.getTime() || t > rango.hasta.getTime()) return false;
        }
        return true;
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  async createBitacora(input: NewBitacora): Promise<Bitacora> {
    const hoy = fechaHoy();
    const existente = await this.getBitacoraDeHoy(input.barco_id);
    if (existente) throw new Error('Este barco ya tiene bitácora hoy');
    const { marineros = [], lat = null, lng = null, ...datos } = input;
    const bitacora: Bitacora = {
      ...datos,
      lat,
      lng,
      id: `bit${Date.now()}`,
      fecha: hoy,
      marineros,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.db.bitacoras.push(bitacora);
    this.persist();
    this.emitBitacora(bitacora);
    return bitacora;
  }

  async updateBitacora(id: string, input: Partial<NewBitacora>): Promise<Bitacora> {
    const idx = this.db.bitacoras.findIndex((b) => b.id === id);
    if (idx === -1) throw new Error('Bitácora no encontrada');
    this.db.bitacoras[idx] = {
      ...this.db.bitacoras[idx],
      ...input,
      updated_at: new Date().toISOString(),
    };
    this.persist();
    this.emitBitacora(this.db.bitacoras[idx]);
    return this.db.bitacoras[idx];
  }

  // ---- Reportes --------------------------------------------------

  async listUltimosReportes(): Promise<Report[]> {
    const map = new Map<string, Report>();
    [...this.db.reportes]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .forEach((r) => {
        if (!map.has(r.barco_id)) map.set(r.barco_id, r);
      });
    return [...map.values()];
  }

  async listReportes(rango?: RangoFechas, filtros?: FiltrosReportes): Promise<Report[]> {
    return this.db.reportes
      .filter((r) => {
        if (rango) {
          const t = new Date(r.created_at).getTime();
          if (t < rango.desde.getTime() || t > rango.hasta.getTime()) return false;
        }
        if (filtros?.barcoId && r.barco_id !== filtros.barcoId) return false;
        if (filtros?.estadoId && r.estado_id !== filtros.estadoId) return false;
        return true;
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async listReportesDeBarco(barcoId: string, desde: Date, hasta: Date): Promise<Report[]> {
    return this.db.reportes
      .filter((r) => {
        const t = new Date(r.created_at).getTime();
        return r.barco_id === barcoId && t >= desde.getTime() && t <= hasta.getTime();
      })
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async insertReporte(input: NewReport): Promise<Report> {
    // GATE (igual que RLS en Supabase): sin bitácora de hoy no hay reporte,
    // salvo para operación (admin).
    const rol = this.perfilActual()?.rol;
    const bitacora = await this.getBitacoraDeHoy(input.barco_id);
    if (rol !== 'operacion' && !bitacora) {
      throw new Error('Primero debe hacerse la Check Bitácora de hoy');
    }
    const report: Report = {
      ...input,
      bitacora_id: bitacora?.id ?? input.bitacora_id,
      equipaje: input.maletas + input.bolsos,
      id: `r${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      operador_id: this.perfilActual()?.id ?? 'p1',
      created_at: new Date().toISOString(),
    };
    this.db.reportes.push(report);
    this.persist();
    this.emit(report);
    return report;
  }

  async deleteReportesDeBarco(barcoId: string): Promise<void> {
    this.db.reportes = this.db.reportes.filter((r) => r.barco_id !== barcoId);
    this.persist();
  }

  // ---- Admin -----------------------------------------------------

  async addBarco(nombre: string, capacidadPax: number): Promise<Boat> {
    const b: Boat = { id: `b${Date.now()}`, nombre, capacidad_pax: capacidadPax, activo: true };
    this.db.barcos.push(b);
    this.persist();
    return b;
  }

  async updateBarco(
    id: string,
    cambios: Partial<Pick<Boat, 'nombre' | 'capacidad_pax' | 'activo'>>,
  ): Promise<Boat> {
    const idx = this.db.barcos.findIndex((b) => b.id === id);
    if (idx === -1) throw new Error('Barco no encontrado');
    this.db.barcos[idx] = { ...this.db.barcos[idx], ...cambios };
    this.persist();
    return this.db.barcos[idx];
  }

  async removeBarco(id: string): Promise<void> {
    this.db.barcos = this.db.barcos.filter((b) => b.id !== id);
    this.db.reportes = this.db.reportes.filter((r) => r.barco_id !== id);
    this.db.bitacoras = this.db.bitacoras.filter((b) => b.barco_id !== id);
    this.db.asignaciones = this.db.asignaciones.filter((a) => a.barco_id !== id);
    this.persist();
  }

  async addEstado(nombre: string, color: string, esRecogida = false, esDesembarque = false): Promise<Estado> {
    const e: Estado = { id: `e${Date.now()}`, nombre, color, es_recogida: esRecogida, es_desembarque: esDesembarque };
    this.db.estados.push(e);
    this.persist();
    return e;
  }

  async updateEstado(
    id: string,
    cambios: Partial<Pick<Estado, 'nombre' | 'color' | 'es_recogida' | 'es_desembarque'>>,
  ): Promise<Estado> {
    const idx = this.db.estados.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error('Estado no encontrado');
    this.db.estados[idx] = { ...this.db.estados[idx], ...cambios };
    this.persist();
    return this.db.estados[idx];
  }

  async removeEstado(id: string): Promise<void> {
    this.db.estados = this.db.estados.filter((e) => e.id !== id);
    this.persist();
  }

  async addRuta(nombre: string): Promise<Ruta> {
    const r: Ruta = { id: `rt${Date.now()}`, nombre, activo: true };
    this.db.rutas.push(r);
    this.persist();
    return r;
  }

  async removeRuta(id: string): Promise<void> {
    this.db.rutas = this.db.rutas.filter((r) => r.id !== id);
    this.persist();
  }

  async updateProfile(id: string, cambios: { nombre?: string; rol?: Rol }): Promise<Profile> {
    const idx = this.db.profiles.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Perfil no encontrado');
    this.db.profiles[idx] = { ...this.db.profiles[idx], ...cambios };
    this.persist();
    return this.db.profiles[idx];
  }

  async assignBoat(
    perfilId: string,
    barcoId: string,
    opciones: { es_capitan?: boolean; es_principal?: boolean } = {},
  ): Promise<void> {
    const esPrincipal = opciones.es_principal ?? false;
    const esCapitan = opciones.es_capitan ?? true;
    if (this.db.asignaciones.some((a) => a.perfil_id === perfilId && a.barco_id === barcoId)) return;
    if (esPrincipal) {
      this.db.asignaciones = this.db.asignaciones.map((a) =>
        a.perfil_id === perfilId ? { ...a, es_principal: false } : a,
      );
    }
    this.db.asignaciones.push({
      id: `a${Date.now()}`,
      perfil_id: perfilId,
      barco_id: barcoId,
      es_capitan: esCapitan,
      es_principal: esPrincipal,
    });
    this.persist();
  }

  async unassignBoat(perfilId: string, barcoId: string): Promise<void> {
    this.db.asignaciones = this.db.asignaciones.filter(
      (a) => !(a.perfil_id === perfilId && a.barco_id === barcoId),
    );
    this.persist();
  }

  /** Demo: genera un reporte nuevo como si llegara de la tripulación. */
  async simularReporteEntrante(): Promise<void> {
    const hoy = fechaHoy();
    const conBitacora = this.db.bitacoras.filter((b) => b.fecha === hoy);
    if (conBitacora.length === 0) return;
    const bitacora = conBitacora[Math.floor(Math.random() * conBitacora.length)];
    const barco = this.db.barcos.find((b) => b.id === bitacora.barco_id);
    if (!barco) return;
    const estado = this.db.estados[Math.floor(Math.random() * this.db.estados.length)];
    const lugares: [string, number, number][] = [
      ['Cholón', 10.27, -75.71],
      ['Isla Grande', 10.19, -75.74],
      ['Playa Blanca', 10.175, -75.765],
      ['Punta Arena', 10.325, -75.545],
      ['Tierrabomba', 10.347, -75.565],
    ];
    const [lugar, lat, lng] = lugares[Math.floor(Math.random() * lugares.length)];
    const tripulante =
      this.db.profiles.find((p) =>
        this.db.asignaciones.some((a) => a.perfil_id === p.id && a.barco_id === barco.id),
      ) ?? this.db.profiles[0];
    const esRecogida = estado.es_recogida;
    const pasajeros = esRecogida ? Math.floor(Math.random() * 30) + 5 : 0;
    const maletas = esRecogida ? Math.floor(Math.random() * 15) + 2 : 0;
    const bolsos = esRecogida ? Math.floor(Math.random() * 10) + 2 : 0;

    const report: Report = {
      id: `r${Date.now()}`,
      barco_id: barco.id,
      bitacora_id: bitacora.id,
      estado_id: estado.id,
      operador_id: tripulante.id,
      pasajeros,
      maletas,
      bolsos,
      equipaje: maletas + bolsos,
      lugar,
      lat,
      lng,
      notas: 'Reporte de demostración',
      created_at: new Date().toISOString(),
    };
    this.db.reportes.push(report);
    this.persist();
    this.emit(report);
  }
}
