import { useCallback, useState } from 'react';

export type GeoState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; lat: number; lng: number }
  | { status: 'error'; message: string };

/** Envuelve navigator.geolocation con estado explícito para la UI. */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: 'idle' });

  const get = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'error', message: 'Este navegador no tiene GPS' });
      return;
    }
    setState({ status: 'loading' });
    navigator.geolocation.getCurrentPosition(
      (pos) => setState({ status: 'ok', lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        setState({
          status: 'error',
          message:
            err.code === 1
              ? 'Permiso de ubicación denegado'
              : err.code === 3
                ? 'Tiempo de espera agotado'
                : 'No se pudo obtener la posición',
        }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }, []);

  return { geo: state, getGeo: get };
}
