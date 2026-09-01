import { useQuery } from '@tanstack/react-query';
import { fetchGpsSnapshot, gpsEnabled } from '../services/gps';

/**
 * Posición GPS en vivo de los barcos (desde la Edge Function de Supabase).
 * Hace poll cada `intervalMs` (default 30 s); la función cachea 15 s
 * para no saturar la plataforma GomezGPS.
 */
export function useGpsPositions(intervalMs = 30_000) {
  return useQuery({
    queryKey: ['gps-posiciones'],
    queryFn: fetchGpsSnapshot,
    enabled: gpsEnabled,
    refetchInterval: intervalMs,
    staleTime: intervalMs,
    retry: 1,
  });
}
