import { useEffect } from 'react';
import { ds } from '../services';
import { useUIStore } from '../store/uiStore';
import { playBeep } from '../utils/sound';
import type { Bitacora, Boat, Estado, Report } from '../types';

/**
 * NOTIFICACIÓN DE ACTIVIDAD NUEVA (experiencia de operación/ventas en PC):
 * sonido + toast + notificación del navegador cuando llega una bitácora
 * (apertura del día) o un reporte. Se suscribe a ds.onNewReport y
 * ds.onBitacoraChange (Realtime en Supabase; eventos en modo local).
 */
export function useReportNotifications(barcos: Boat[], estados: Estado[]) {
  const soundEnabled = useUIStore((s) => s.soundEnabled);
  const notificationsEnabled = useUIStore((s) => s.notificationsEnabled);
  const pushToast = useUIStore((s) => s.pushToast);

  useEffect(() => {
    const notificar = (msg: string) => {
      if (soundEnabled) playBeep();
      pushToast(msg, 'success');
      if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Colombia Navega', { body: msg });
        } catch {
          // algunos navegadores bloquean en contextos específicos
        }
      }
    };

    const offReportes = ds.onNewReport((r: Report) => {
      const barco = barcos.find((b) => b.id === r.barco_id)?.nombre ?? 'Barco';
      const estado = estados.find((e) => e.id === r.estado_id);
      const detalle = estado?.es_recogida ? ` (${r.pasajeros} pax · ${r.maletas} maletas · ${r.bolsos} bolsos)` : '';
      notificar(`Nuevo reporte: ${barco} — ${estado?.nombre ?? ''}${detalle}`);
    });

    const offBitacoras = ds.onBitacoraChange((b: Bitacora) => {
      const barco = barcos.find((x) => x.id === b.barco_id)?.nombre ?? 'Barco';
      notificar(`📋 Check Bitácora: ${barco} abrió el día`);
    });

    return () => {
      offReportes();
      offBitacoras();
    };
  }, [barcos, estados, soundEnabled, notificationsEnabled, pushToast]);
}
