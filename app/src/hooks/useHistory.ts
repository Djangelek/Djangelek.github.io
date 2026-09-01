import { useQuery } from '@tanstack/react-query';
import { ds } from '../services';

/** Reportes filtrados por rango de fechas (para Historial / Exportar Excel). */
export function useReportes(
  desde: Date | null,
  hasta: Date | null,
  barcoId: string,
  estadoId: string,
) {
  return useQuery({
    queryKey: [
      'reportes',
      desde?.toISOString() ?? 'none',
      hasta?.toISOString() ?? 'none',
      barcoId,
      estadoId,
    ],
    queryFn: () =>
      ds.listReportes(
        desde && hasta ? { desde, hasta } : undefined,
        { barcoId: barcoId || undefined, estadoId: estadoId || undefined },
      ),
    enabled: !!desde && !!hasta,
  });
}

/** Bitácora de un barco en un rango (recorrido del día). */
export function useReportesDeBarco(barcoId: string, desde: Date, hasta: Date) {
  return useQuery({
    queryKey: ['bitacora', barcoId, desde.toISOString(), hasta.toISOString()],
    queryFn: () => ds.listReportesDeBarco(barcoId, desde, hasta),
    enabled: !!barcoId,
  });
}
