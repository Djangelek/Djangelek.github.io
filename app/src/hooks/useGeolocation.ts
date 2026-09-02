import { useCallback, useEffect, useRef, useState } from 'react';

export type GeoState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; lat: number; lng: number }
  | { status: 'error'; message: string };

function mensajeError(err: GeolocationPositionError): string {
  if (err.code === 1) return 'Permiso de ubicación denegado';
  if (err.code === 2) return 'La ubicación no está disponible';
  if (err.code === 3) return 'Tiempo de espera agotado';
  return 'No se pudo obtener la posición';
}

/**
 * GPS del teléfono con soporte de "watch" (segundo plano):
 * con `watch: true` (default) la posición se pide y se refresca sola
 * mientras se llena el formulario, para que al enviar ya esté lista.
 * También expone `getGeo` (toma puntual) como respaldo.
 */
export function useGeolocation({ watch = true }: { watch?: boolean } = {}) {
  const [state, setState] = useState<GeoState>({ status: 'idle' });
  const watchId = useRef<number | null>(null);

  const get = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'error', message: 'Este navegador no tiene GPS' });
      return;
    }
    setState({ status: 'loading' });
    navigator.geolocation.getCurrentPosition(
      (pos) => setState({ status: 'ok', lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setState({ status: 'error', message: mensajeError(err) }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }, []);

  useEffect(() => {
    if (!watch) return;
    if (!('geolocation' in navigator)) {
      setState({ status: 'error', message: 'Este navegador no tiene GPS' });
      return;
    }
    setState((s) => (s.status === 'ok' ? s : { status: 'loading' }));
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => setState({ status: 'ok', lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setState({ status: 'error', message: mensajeError(err) }),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 5_000 },
    );
    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    };
  }, [watch]);

  return { geo: state, getGeo: get, watching: watch };
}
