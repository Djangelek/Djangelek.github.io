import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import { useGpsPositions } from '../../hooks/useGpsPositions';
import { useBarcos } from '../../hooks/useFleet';
import { gpsEnabled, normalizarNombre } from '../../services/gps';
import { hace } from '../../utils/format';
import { svgAnclaBlanco } from '../ui/Iconos';
import type { GpsBoat } from '../../types/gps';

/**
 * Capa de GPS en vivo sobre el mapa: marcadores con la posición real de
 * cada yate leída de la plataforma Gomez GPS (vía Edge Function).
 * Se superpone a los reportes manuales; el color indica el estado GPS:
 *   verde  = en movimiento (online)
 *   amarillo = conectado pero parado (ack)
 *   rojo   = sin señal (offline)
 */
export default function GpsMarkers() {
  const { data } = useGpsPositions();
  const { data: barcos = [] } = useBarcos();

  const items = data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <>
      {items.map((b) => {
        if (b.lat == null || b.lng == null) return null;
        const barco = barcos.find((x) => normalizarNombre(x.nombre) === normalizarNombre(b.name));
        return (
          <Marker key={`gps-${b.id}`} position={[b.lat, b.lng]} icon={gpsIcon(b)}>
            <Popup>
              <div className="popup">
                <b>{b.name}</b>
                <div>
                  Estado GPS:{' '}
                  <b style={{ color: estadoColor(b) }}>
                    {estadoTexto(b)}
                  </b>
                </div>
                <div>
                  Velocidad:{' '}
                  <b style={{ color: estadoColor(b) }}>
                    {b.speed != null ? `${b.speed} nudos` : '—'}
                  </b>
                  {b.course != null ? ` · rumbo ${b.course}°` : ''}
                </div>
                <div className="muted">Pos: {b.lat.toFixed(5)}, {b.lng.toFixed(5)}</div>
                <div className="muted">
                  {b.time ? hace(b.time) : 'sin hora'} · GPS GomezGPS
                </div>
                {barco && <Link to={`/barco/${barco.id}`}>Ver bitácora del día →</Link>}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

/** Chip pequeño "GPS en vivo" para poner junto a los filtros del dashboard. */
export function GpsStatusChip() {
  const { data, isLoading, error } = useGpsPositions();
  if (!gpsEnabled) return null;
  const n = data?.items.length ?? 0;
  const texto = error
    ? 'GPS sin conexión'
    : isLoading && !data
      ? 'GPS conectando…'
      : data && data.fetched_at
        ? `GPS en vivo · ${n} barcos · ${hace(data.fetched_at)}`
        : 'GPS en vivo';
  return <span className={`gps-chip${error ? ' err' : ''}`}>{texto}</span>;
}

function estadoColor(b: GpsBoat): string {
  if (b.online === 'online') return '#22c55e';
  if (b.online === 'offline') return '#ef4444';
  return '#f59e0b';
}

function estadoTexto(b: GpsBoat): string {
  if (b.online === 'online') return 'En movimiento';
  if (b.online === 'offline') return 'Sin señal';
  return 'Conectado';
}

function gpsIcon(b: GpsBoat): L.DivIcon {
  const color = estadoColor(b);
  const moviendo = (b.speed ?? 0) >= 1 ? ' moviendo' : '';
  return L.divIcon({
    className: 'gps-marker-wrap',
    html: `<div class="gps-marker${moviendo}" style="background:${color}">${svgAnclaBlanco}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}
