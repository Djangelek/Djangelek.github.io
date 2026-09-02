import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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
 * Modo PRODUCCIÓN: base de datos PostgreSQL real (Supabase).
 * Requiere VITE_DATA_SOURCE=supabase y las claves en app/.env
 * La seguridad real la da RLS (ver supabase/schema.sql).
 */
export class SupabaseSource implements DataSource {
  mode = 'supabase' as const;
  private client: SupabaseClient;

  constructor() {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!url || !key) {
      throw new Error(
        'Modo supabase activado pero falta VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en app/.env',
      );
    }
    this.client = createClient(url, key);
  }

  /** Lanza el error de Supabase para que react-query lo vea (no se traga). */
  private raise(error: { message: string } | null): void {
    if (error) throw new Error(error.message);
  }

  private async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    this.raise(error);
    return data as Profile | null;
  }

  async login(email: string, password: string): Promise<Session | null> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error || !data.user) return null;
    const profile = await this.getProfile(data.user.id);
    if (!profile) return null;
    return { profile };
  }

  async logout(): Promise<void> {
    await this.client.auth.signOut();
  }

  async getSession(): Promise<Session | null> {
    const { data } = await this.client.auth.getSession();
    const user = data.session?.user;
    if (!user) return null;
    const profile = await this.getProfile(user.id);
    return profile ? { profile } : null;
  }

  async listBarcos(): Promise<Boat[]> {
    const { data, error } = await this.client.from('barcos').select('*').order('nombre');
    this.raise(error);
    return (data ?? []) as Boat[];
  }

  async listEstados(): Promise<Estado[]> {
    const { data, error } = await this.client.from('estados').select('*').order('nombre');
    this.raise(error);
    return (data ?? []) as Estado[];
  }

  async listRutas(): Promise<Ruta[]> {
    const { data, error } = await this.client.from('rutas').select('*').order('nombre');
    this.raise(error);
    return (data ?? []) as Ruta[];
  }

  async listProfiles(): Promise<Profile[]> {
    const { data, error } = await this.client.from('profiles').select('*').order('nombre');
    this.raise(error);
    return (data ?? []) as Profile[];
  }

  async listAsignaciones(): Promise<Assignment[]> {
    const { data, error } = await this.client.from('asignaciones').select('*');
    this.raise(error);
    return (data ?? []) as Assignment[];
  }

  // ---- Bitácoras -------------------------------------------------

  async getBitacoraDeHoy(barcoId: string): Promise<Bitacora | null> {
    // fecha "hoy" en hora local de la operación (Colombia)
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const { data, error } = await this.client
      .from('bitacoras')
      .select('*')
      .eq('barco_id', barcoId)
      .eq('fecha', hoy)
      .maybeSingle();
    this.raise(error);
    if (!data) return null;
    const bitacora = data as Bitacora;
    const { data: trip, error: errTrip } = await this.client
      .from('bitacora_tripulantes')
      .select('perfil_id')
      .eq('bitacora_id', bitacora.id);
    this.raise(errTrip);
    bitacora.marineros = (trip ?? []).map((t) => t.perfil_id);
    return bitacora;
  }

  async getBitacoraDeHoyDelCapitan(capitanId: string): Promise<Bitacora | null> {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const { data, error } = await this.client
      .from('bitacoras')
      .select('*')
      .eq('capitan_id', capitanId)
      .eq('fecha', hoy)
      .maybeSingle();
    this.raise(error);
    if (!data) return null;
    const bitacora = data as Bitacora;
    const { data: trip, error: errTrip } = await this.client
      .from('bitacora_tripulantes')
      .select('perfil_id')
      .eq('bitacora_id', bitacora.id);
    this.raise(errTrip);
    bitacora.marineros = (trip ?? []).map((t) => t.perfil_id);
    return bitacora;
  }

  async listBitacoras(rango?: RangoFechas): Promise<Bitacora[]> {
    let q = this.client.from('bitacoras').select('*').order('fecha', { ascending: false });
    if (rango) {
      const fmt = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      q = q.gte('fecha', fmt(rango.desde)).lte('fecha', fmt(rango.hasta));
    }
    const { data, error } = await q;
    this.raise(error);
    return (data ?? []) as Bitacora[];
  }

  async createBitacora(input: NewBitacora): Promise<Bitacora> {
    const { marineros = [], ...datos } = input;
    const { data, error } = await this.client
      .from('bitacoras')
      .insert([datos])
      .select()
      .single();
    this.raise(error);
    const bitacora = data as Bitacora;
    if (marineros.length > 0) {
      const { error: errTrip } = await this.client
        .from('bitacora_tripulantes')
        .insert(marineros.map((perfil_id) => ({ bitacora_id: bitacora.id, perfil_id })));
      this.raise(errTrip);
    }
    bitacora.marineros = marineros;
    return bitacora;
  }

  async updateBitacora(id: string, input: Partial<NewBitacora>): Promise<Bitacora> {
    const { marineros, ...datos } = input;
    const { data, error } = await this.client
      .from('bitacoras')
      .update(datos)
      .eq('id', id)
      .select()
      .single();
    this.raise(error);
    const bitacora = data as Bitacora;
    if (marineros !== undefined) {
      const { error: errDel } = await this.client
        .from('bitacora_tripulantes')
        .delete()
        .eq('bitacora_id', id);
      this.raise(errDel);
      if (marineros.length > 0) {
        const { error: errIns } = await this.client
          .from('bitacora_tripulantes')
          .insert(marineros.map((perfil_id) => ({ bitacora_id: id, perfil_id })));
        this.raise(errIns);
      }
      bitacora.marineros = marineros;
    }
    return bitacora;
  }

  // ---- Reportes --------------------------------------------------

  async listUltimosReportes(): Promise<Report[]> {
    const { data, error } = await this.client.from('ultimos_reportes').select('*');
    this.raise(error);
    return (data ?? []) as Report[];
  }

  async listReportes(rango?: RangoFechas, filtros?: FiltrosReportes): Promise<Report[]> {
    let q = this.client.from('reportes').select('*').order('created_at', { ascending: false });
    if (rango) {
      q = q.gte('created_at', rango.desde.toISOString()).lte('created_at', rango.hasta.toISOString());
    }
    if (filtros?.barcoId) q = q.eq('barco_id', filtros.barcoId);
    if (filtros?.estadoId) q = q.eq('estado_id', filtros.estadoId);
    const { data, error } = await q.limit(5000);
    this.raise(error);
    return (data ?? []) as Report[];
  }

  async listReportesDeBarco(barcoId: string, desde: Date, hasta: Date): Promise<Report[]> {
    const { data, error } = await this.client
      .from('reportes')
      .select('*')
      .eq('barco_id', barcoId)
      .gte('created_at', desde.toISOString())
      .lte('created_at', hasta.toISOString())
      .order('created_at', { ascending: true });
    this.raise(error);
    return (data ?? []) as Report[];
  }

  async insertReporte(input: NewReport): Promise<Report> {
    // El servidor además fuerza operador_id = auth.uid() vía trigger (schema.sql)
    // y RLS bloquea el insert si no existe la bitácora del día (el gate).
    const { data: userData } = await this.client.auth.getUser();
    const operadorId = userData.user?.id;
    const { data, error } = await this.client
      .from('reportes')
      .insert([{ ...input, operador_id: operadorId }])
      .select()
      .single();
    this.raise(error);
    return data as Report;
  }

  async deleteReportesDeBarco(barcoId: string): Promise<void> {
    const { error } = await this.client.from('reportes').delete().eq('barco_id', barcoId);
    this.raise(error);
  }

  // ---- Admin -----------------------------------------------------

  async addBarco(nombre: string, capacidadPax: number): Promise<Boat> {
    const { data, error } = await this.client
      .from('barcos')
      .insert([{ nombre, capacidad_pax: capacidadPax }])
      .select()
      .single();
    this.raise(error);
    return data as Boat;
  }

  async updateBarco(
    id: string,
    cambios: Partial<Pick<Boat, 'nombre' | 'capacidad_pax' | 'activo'>>,
  ): Promise<Boat> {
    const { data, error } = await this.client
      .from('barcos')
      .update(cambios)
      .eq('id', id)
      .select()
      .single();
    this.raise(error);
    return data as Boat;
  }

  async removeBarco(id: string): Promise<void> {
    // Nota: en v3 las FKs de reportes/bitácoras/asignaciones a barcos tienen
    // on delete cascade, así que el borrado limpia el historial asociado.
    const { error } = await this.client.from('barcos').delete().eq('id', id);
    this.raise(error);
  }

  async addEstado(nombre: string, color: string, esRecogida = false): Promise<Estado> {
    const { data, error } = await this.client
      .from('estados')
      .insert([{ nombre, color, es_recogida: esRecogida }])
      .select()
      .single();
    this.raise(error);
    return data as Estado;
  }

  async updateEstado(
    id: string,
    cambios: Partial<Pick<Estado, 'nombre' | 'color' | 'es_recogida'>>,
  ): Promise<Estado> {
    const { data, error } = await this.client
      .from('estados')
      .update(cambios)
      .eq('id', id)
      .select()
      .single();
    this.raise(error);
    return data as Estado;
  }

  async removeEstado(id: string): Promise<void> {
    const { error } = await this.client.from('estados').delete().eq('id', id);
    this.raise(error);
  }

  async addRuta(nombre: string): Promise<Ruta> {
    const { data, error } = await this.client
      .from('rutas')
      .insert([{ nombre }])
      .select()
      .single();
    this.raise(error);
    return data as Ruta;
  }

  async removeRuta(id: string): Promise<void> {
    const { error } = await this.client.from('rutas').delete().eq('id', id);
    this.raise(error);
  }

  async updateProfile(id: string, cambios: { nombre?: string; rol?: Rol }): Promise<Profile> {
    const { data, error } = await this.client
      .from('profiles')
      .update(cambios)
      .eq('id', id)
      .select()
      .single();
    this.raise(error);
    return data as Profile;
  }

  async assignBoat(
    perfilId: string,
    barcoId: string,
    opciones: { es_capitan?: boolean; es_principal?: boolean } = {},
  ): Promise<void> {
    const { error } = await this.client.from('asignaciones').insert([
      {
        perfil_id: perfilId,
        barco_id: barcoId,
        es_capitan: opciones.es_capitan ?? true,
        es_principal: opciones.es_principal ?? false,
      },
    ]);
    this.raise(error);
  }

  async unassignBoat(perfilId: string, barcoId: string): Promise<void> {
    const { error } = await this.client
      .from('asignaciones')
      .delete()
      .eq('perfil_id', perfilId)
      .eq('barco_id', barcoId);
    this.raise(error);
  }

  // ---- Tiempo real ------------------------------------------------

  onNewReport(cb: (r: Report) => void): () => void {
    const channel = this.client
      .channel('reportes-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reportes' },
        (payload) => cb(payload.new as Report),
      )
      .subscribe();
    return () => {
      void this.client.removeChannel(channel);
    };
  }

  onBitacoraChange(cb: (b: Bitacora) => void): () => void {
    const channel = this.client
      .channel('bitacoras-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bitacoras' },
        (payload) => cb(payload.new as Bitacora),
      )
      .subscribe();
    return () => {
      void this.client.removeChannel(channel);
    };
  }
}
