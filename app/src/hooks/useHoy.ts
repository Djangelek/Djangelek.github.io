import { useEffect, useState } from 'react';
import { hoyLocalISO } from '../utils/format';

/**
 * Devuelve la fecha "de hoy" en la zona de la operación (Colombia) y
 * re-renderiza al componente cuando cambia el día (medianoche), para que
 * la UI de la bitácora se reinicie en cada jornada.
 */
export function useHoy(): string {
  const [hoy, setHoy] = useState(hoyLocalISO());
  useEffect(() => {
    const id = setInterval(() => {
      const h = hoyLocalISO();
      setHoy((prev) => (prev === h ? prev : h));
    }, 20_000);
    return () => clearInterval(id);
  }, []);
  return hoy;
}
