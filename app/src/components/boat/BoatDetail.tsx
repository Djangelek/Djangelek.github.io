import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapContainer, Marker, Popup, Polyline, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { useBarcos, useBitacoraDeHoy, useEstados, usePerfiles, useRutas } from '../../hooks/useFleet';
import { useReportesDeBarco } from '../../hooks/useHistory';
import { distanciaRuta, formatKm } from '../../utils/distance';
import { finDelDia, formatFechaDia, formatHora, hace, inicioDelDia } from '../../utils/format';

/**
 * Vista de un barco para SUPERVISIÓN (operación / ventas):
 * - Cabecera de la Check Bitácora del día (ruta, pax, combustible, tripulación).
 * - Recorrido del día en el mapa (polilínea) + distancia total.
 * - Bitácora del día: línea de tiempo con todos los reportes.
 */
export default function BoatDetail() {
  const { id = '' } = useParams();
  const { data: barcos = [] } = useBarcos();
  const { data: estados = [] } = useEstados();
  const { data: perfiles = [] } = usePerfiles();
  const { data: rutas = [] } = useRutas();
  const { data: bitacora } = useBitacoraDeHoy(id);

  const barco = barcos.find((b) => b.id === id);

  const desde = inicioDelDia(new Date());
  const hasta = finDelDia(new Date());
  const { data: reportes = [] } = useReportesDeBarco(id, desde, hasta);

  const puntos = useMemo(
    () =>
      reportes
        .filter((r) => r.lat != null && r.lng != null)
        .map((r) => [r.lat as number, r.lng as number] as [number, number]),
    [reportes],
  );
  const distancia = useMemo(
    () => distanciaRuta(puntos.map(([lat, lng]) => ({ lat, lng }))),
    [puntos],
  );

  const nombreDe = (pid: string) => perfiles.find((p) => p.id === pid)?.nombre ?? '—';

  if (!barco) return <div className="center pad">Barco no encontrado.</div>;

  const icono = L.divIcon({
    className: 'fleet-dot',
    html: '<span class="dot" style="background:#2e6f9e"></span>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

  const ultimo = reportes[reportes.length - 1];
  const ultimoEstado = ultimo ? estados.find((e) => e.id === ultimo.estado_id) : undefined;
  const rutaNombre = rutas.find((r) => r.id === bitacora?.ruta_id)?.nombre;

  return (
    <div className="boat-detail">
      <Link to="/mapa" className="btn-link">
        ← Volver al mapa
      </Link>

      <div className="hoja">
        <div className="hoja-titulo" style={{ borderBottom: 'none', marginBottom: 0 }}>
          <span>{barco.nombre}</span>
          {bitacora ? <span className="sello ok">Día abierto</span> : <span className="sello">Sin bitácora hoy</span>}
        </div>
        <div className="fila-dato" style={{ flexWrap: 'wrap', gap: '6px 16px' }}>
          <span>
            <span className="rotulo">Ruta · </span>
            <span className="dato">{rutaNombre ?? '—'}</span>
          </span>
          <span>
            <span className="rotulo">Pax · </span>
            <span className="dato">{bitacora?.pasajeros ?? '—'}</span>
          </span>
          <span>
            <span className="rotulo">Combustible · </span>
            <span className="dato">{bitacora?.combustible != null ? `${bitacora.combustible}%` : '—'}</span>
          </span>
          <span>
            <span className="rotulo">Marineros · </span>
            <span className="dato">{bitacora?.marineros.map(nombreDe).join(', ') || '—'}</span>
          </span>
          {ultimo && (
            <span className="muted">
              Estado:{' '}
              <b style={{ color: ultimoEstado?.color }}>{ultimoEstado?.nombre ?? '—'}</b> ·{' '}
              {hace(ultimo.created_at)}
            </span>
          )}
        </div>
      </div>

      <div className="resumen">
        <div className="stat">
          <b>{reportes.length}</b>
          <span>Reportes hoy</span>
        </div>
        <div className="stat">
          <b>{ultimo?.pasajeros ?? 0}</b>
          <span>PAX a bordo</span>
        </div>
        <div className="stat">
          <b>{formatKm(distancia)}</b>
          <span>Recorrido</span>
        </div>
        <div className="stat">
          <b>{formatFechaDia(bitacora?.fecha ?? new Date().toISOString().slice(0, 10))}</b>
          <span>Fecha</span>
        </div>
      </div>

      <div className="mapa-wrap" style={{ height: 460 }}>
        <MapContainer center={puntos[0] ?? [10.4, -75.53]} zoom={12} className="mapa">
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}"
            attribution="&copy; Esri, GEBCO"
            maxZoom={16}
          />
          {puntos.length > 1 && (
            <Polyline
              positions={puntos}
              pathOptions={{ color: '#185a9c', weight: 4, opacity: 0.9, dashArray: '6 8' }}
            />
          )}
          {reportes
            .filter((r) => r.lat != null && r.lng != null)
            .map((r) => (
              <Marker key={r.id} position={[r.lat as number, r.lng as number]} icon={icono}>
                <Popup>
                  <div className="popup">
                    <b>{formatHora(r.created_at)}</b>
                    <div>{estados.find((e) => e.id === r.estado_id)?.nombre ?? '—'}</div>
                    <div>
                      {r.lugar || '—'} · {r.pasajeros} PAX
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </div>

      <div className="hoja">
        <div className="hoja-titulo">Bitácora del día</div>
        <ul className="bitacora-list">
          {reportes.length === 0 && <li className="muted">Sin reportes hoy.</li>}
          {[...reportes].reverse().map((r) => {
            const est = estados.find((e) => e.id === r.estado_id);
            const operador = perfiles.find((p) => p.id === r.operador_id);
            return (
              <li key={r.id}>
                <span className="hora">{formatHora(r.created_at)}</span>
                <span className="estado-dot" style={{ background: est?.color ?? '#94a3b8' }} />
                <b>{est?.nombre ?? '—'}</b>
                <span className="muted">
                  · {r.lugar || 'sin lugar'}
                  {r.pasajeros > 0 && ` · ${r.pasajeros} PAX`}
                  {r.maletas + r.bolsos > 0 && ` · ${r.maletas} maletas · ${r.bolsos} bolsos`}
                </span>
                {r.notas && <div className="muted notas">“{r.notas}”</div>}
                <div className="muted">por {operador?.nombre ?? '—'}</div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
