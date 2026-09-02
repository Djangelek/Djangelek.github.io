import { useQuery } from '@tanstack/react-query';
import { ds, joinFleet } from '../services';
import { hoyLocalISO } from '../utils/format';
import type { Bitacora, FleetEntry } from '../types';

export function useBarcos() {
  return useQuery({
    queryKey: ['barcos'],
    queryFn: () => ds.listBarcos(),
    staleTime: 60_000,
  });
}

export function useEstados() {
  return useQuery({
    queryKey: ['estados'],
    queryFn: () => ds.listEstados(),
    staleTime: 60_000,
  });
}

export function useRutas() {
  return useQuery({
    queryKey: ['rutas'],
    queryFn: () => ds.listRutas(),
    staleTime: 60_000,
  });
}

export function usePerfiles() {
  return useQuery({
    queryKey: ['perfiles'],
    queryFn: () => ds.listProfiles(),
    staleTime: 60_000,
  });
}

export function useAsignaciones() {
  return useQuery({
    queryKey: ['asignaciones'],
    queryFn: () => ds.listAsignaciones(),
    staleTime: 60_000,
  });
}

/** Bitácora de HOY de un barco (null → el barco no ha abierto el día).
 *  El día va en la clave de la consulta, así que al cambiar la fecha la
 *  bitácora de ayer deja de tenerse en cuenta (reinicio diario). */
export function useBitacoraDeHoy(barcoId: string | null) {
  const hoy = hoyLocalISO();
  return useQuery({
    queryKey: ['bitacora', 'hoy', hoy, barcoId],
    queryFn: () => (barcoId ? ds.getBitacoraDeHoy(barcoId) : Promise.resolve(null)),
    enabled: !!barcoId,
    refetchInterval: 15_000,
  });
}

/** Bitácora de HOY que abrió un capitán (define el barco de su día). */
export function useMiBitacoraHoy(perfilId: string | null) {
  const hoy = hoyLocalISO();
  return useQuery({
    queryKey: ['bitacora', 'capitan', 'hoy', hoy, perfilId],
    queryFn: () => (perfilId ? ds.getBitacoraDeHoyDelCapitan(perfilId) : Promise.resolve(null)),
    enabled: !!perfilId,
    refetchInterval: 15_000,
  });
}

/** Bitácora de HOY donde el usuario participa (capitán que la abrió o marinero a bordo). */
export function useMiBitacoraTripulante(perfilId: string | null) {
  const hoy = hoyLocalISO();
  return useQuery({
    queryKey: ['bitacora', 'tripulante', 'hoy', hoy, perfilId],
    queryFn: () => (perfilId ? ds.getBitacoraDeHoyDelTripulante(perfilId) : Promise.resolve(null)),
    enabled: !!perfilId,
    refetchInterval: 15_000,
  });
}

/** Todas las bitácoras de hoy (panel de supervisión). */
export function useBitacorasDeHoy() {
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);
  const hasta = new Date();
  hasta.setHours(23, 59, 59, 999);
  return useQuery({
    queryKey: ['bitacoras', 'hoy'],
    queryFn: () => ds.listBitacoras({ desde, hasta }),
    refetchInterval: 15_000,
  });
}

/** Bitácoras de un barco en un rango (historial). */
export function useBitacorasDeBarco(barcoId: string, desde: Date, hasta: Date) {
  return useQuery({
    queryKey: ['bitacoras', barcoId, desde.toISOString(), hasta.toISOString()],
    queryFn: () => ds.listBitacoras({ desde, hasta }),
    staleTime: 30_000,
  });
}

/** Último reporte por barco (lo que pinta el mapa). Refresca cada 10 s. */
export function useUltimosReportes() {
  return useQuery({
    queryKey: ['ultimos'],
    queryFn: () => ds.listUltimosReportes(),
    refetchInterval: 10_000,
  });
}

/** Flota completa unida con catálogos, lista para la UI. */
export function useFleet(): { entries: FleetEntry[]; isLoading: boolean } {
  const barcos = useBarcos();
  const estados = useEstados();
  const perfiles = usePerfiles();
  const ultimos = useUltimosReportes();

  const entries = joinFleet(
    ultimos.data ?? [],
    barcos.data ?? [],
    estados.data ?? [],
    perfiles.data ?? [],
  );

  return { entries, isLoading: ultimos.isLoading };
}

/** Tripulación asignada a un barco (capitán + marineros), con perfil unido. */
export function useTripulacionDeBarco(barcoId: string | null) {
  const asignaciones = useAsignaciones();
  const perfiles = usePerfiles();
  const crew = (asignaciones.data ?? [])
    .filter((a) => barcoId && a.barco_id === barcoId)
    .map((a) => ({
      asignacion: a,
      perfil: (perfiles.data ?? []).find((p) => p.id === a.perfil_id) ?? null,
    }))
    .sort((a, b) => Number(b.asignacion.es_capitan) - Number(a.asignacion.es_capitan));
  return { crew, isLoading: asignaciones.isLoading || perfiles.isLoading };
}

/** Barco "principal" del usuario actual (capitán/marinero), según su bitácora. */
export function useMiBarco(perfilId: string | null, rol: string | null) {
  const asignaciones = useAsignaciones();
  if (!perfilId) return null;
  const mias = (asignaciones.data ?? [])
    .filter((a) => a.perfil_id === perfilId)
    .sort(
      (a, b) =>
        Number(b.es_principal) - Number(a.es_principal) ||
        Number(b.es_capitan) - Number(a.es_capitan),
    );
  if (rol === 'capitan') {
    const deCapitan = mias.filter((a) => a.es_capitan);
    if (deCapitan.length > 0) return deCapitan[0];
  }
  return mias[0] ?? null;
}

export type { Bitacora };
