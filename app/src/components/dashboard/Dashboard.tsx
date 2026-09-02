import { useMemo, useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useBarcos, useBitacorasDeHoy, useEstados, useFleet } from '../../hooks/useFleet';
import { useGpsPositions } from '../../hooks/useGpsPositions';
import { useReportNotifications } from '../../hooks/useReportNotifications';
import MapaNautico, { GpsStatusChip, type MarcadorMapa } from '../map/MapaNautico';
import { ds } from '../../services';
import { normalizarNombre } from '../../services/gps';
import { useUIStore } from '../../store/uiStore';
import { formatFechaDia, formatHora, hace, hoyLocalISO } from '../../utils/format';
import { Icono } from '../ui/Iconos';
import type { FleetEntry } from '../../types';
import type { GpsBoat } from '../../types/gps';

/**
 * EL MOSTRADOR — supervisión de operación y ventas en escritorio amplio:
 * flota a la izquierda, mapa grande al centro y las bitácoras del día
 * a la derecha. En móvil se apila en una sola columna.
 */
export default function Dashboard() {
  const { entries, isLoading } = useFleet();
  const { data: barcos = [] } = useBarcos();
  const { data: estados = [] } = useEstados();
  const { data: bitacorasHoy = [] } = useBitacorasDeHoy();
  const { data: gps } = useGpsPositions();
  const { session } = useAuth();
  const esOperacion = session?.profile.rol === 'operacion';

  const soundEnabled = useUIStore((s) => s.soundEnabled);
  const setSoundEnabled = useUIStore((s) => s.setSoundEnabled);
  const notificationsEnabled = useUIStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useUIStore((s) => s.setNotificationsEnabled);
  const horasSinReporte = useUIStore((s) => s.horasSinReporte);
  const setHorasSinReporte = useUIStore((s) => s.setHorasSinReporte);
  const pushToast = useUIStore((s) => s.pushToast);

  useReportNotifications(barcos, estados);

  const [filtroEstado, setFiltroEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [enfoque, setEnfoque] = useState<{ lat: number; lng: number } | null>(null);

  // GPS en vivo emparejado a los barcos por nombre (normalizado).
  const gpsPorBarco = useMemo(() => {
    const mapa = new Map<string, { item: GpsBoat }>();
    for (const item of gps?.items ?? []) {
      if (item.lat == null || item.lng == null) continue;
      const barco = barcos.find((b) => normalizarNombre(b.nombre) === normalizarNombre(item.name));
      if (barco) mapa.set(barco.id, { item });
    }
    return mapa;
  }, [gps, barcos]);

  // Un marcador por barco: GPS en vivo si existe; si no, el último reporte.
  const marcadores = useMemo<MarcadorMapa[]>(() => {
    const out: MarcadorMapa[] = [];
    for (const [barcoId, { item }] of gpsPorBarco) {
      const barco = barcos.find((b) => b.id === barcoId);
      const entry = entries.find((e) => e.barco.id === barcoId);
      const color = gpsColor(item);
      out.push({
        lat: item.lat as number,
        lng: item.lng as number,
        color,
        tipo: 'gps',
        speed: item.speed,
        course: item.course,
        name: item.name,
        html:
          `<div class="popup"><b>${item.name}</b>` +
          `<div>Estado GPS: <b style="color:${color}">${gpsTexto(item)}</b></div>` +
          `<div>Velocidad: <b style="color:${color}">${item.speed != null ? `${item.speed} nudos` : '—'}</b>${item.course != null ? ` · rumbo ${item.course}°` : ''}</div>` +
          (entry
            ? `<div>Último reporte: <b style="color:${entry.estado?.color}">${entry.estado?.nombre ?? '—'}</b> · ${entry.report.lugar || '—'}</div>`
            : '') +
          `<div class="muted">${item.time ? hace(item.time) : 'sin hora'} · GPS</div>` +
          `<a href="#/barco/${barcoId}">Historial y recorrido →</a></div>`,
      });
    }
    for (const e of entries) {
      if (gpsPorBarco.has(e.barco.id)) continue;
      if (e.report.lat == null || e.report.lng == null) continue;
      out.push({
        lat: e.report.lat,
        lng: e.report.lng,
        color: e.estado?.color ?? '#38bdf8',
        tipo: 'reporte',
        html:
          `<div class="popup"><b>${e.barco.nombre}</b>` +
          `<div>Estado: <b style="color:${e.estado?.color};display:inline">${e.estado?.nombre ?? '—'}</b></div>` +
          `<div>Lugar: ${e.report.lugar || '—'}</div>` +
          `<div>PAX: ${e.report.pasajeros} · Maletas: ${e.report.maletas} · Bolsos: ${e.report.bolsos}</div>` +
          `<div class="muted">${formatHora(e.report.created_at)} · ${hace(e.report.created_at)} · último reporte</div>` +
          `<a href="#/barco/${e.barco.id}">Historial y recorrido →</a></div>`,
      });
    }
    return out;
  }, [gpsPorBarco, barcos, entries]);

  function posicionDe(barcoId: string): { lat: number; lng: number } | null {
    const g = gpsPorBarco.get(barcoId);
    if (g) return { lat: g.item.lat as number, lng: g.item.lng as number };
    const e = entries.find((x) => x.barco.id === barcoId);
    if (e && e.report.lat != null && e.report.lng != null) {
      return { lat: e.report.lat, lng: e.report.lng };
    }
    return null;
  }

  function centrarBarco(barcoId: string) {
    const p = posicionDe(barcoId);
    if (p) setEnfoque(p);
  }

  const visibles = useMemo(
    () =>
      entries.filter((e) => {
        if (filtroEstado && e.estado?.id !== filtroEstado) return false;
        if (busqueda && !e.barco.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false;
        return true;
      }),
    [entries, filtroEstado, busqueda],
  );

  // Resumen (contadores de manifiesto)
  const totalBarcos = barcos.filter((b) => b.activo).length;
  const enNavegacion = entries.filter((e) => e.estado?.nombre?.toLowerCase().includes('navegac')).length;
  const paxMar = entries
    .filter((e) => !e.estado?.nombre?.toLowerCase().includes('puerto'))
    .reduce((acc, e) => acc + e.report.pasajeros, 0);
  const conBitacora = new Set(bitacorasHoy.map((b) => b.barco_id));
  const barcosSinBitacora = barcos.filter((b) => b.activo && !conBitacora.has(b.id));

  // Alertas: sin bitácora hoy + sin reporte reciente
  const alertas = useMemo(() => {
    const conReporte = new Set(entries.map((e) => e.barco.id));
    const stale = entries.filter(
      (e) => Date.now() - new Date(e.report.created_at).getTime() > horasSinReporte * 3600_000,
    );
    const sinReporte = barcos
      .filter((b) => b.activo && !conReporte.has(b.id))
      .map((b) => ({ barco: b, ultimo: null as null }));
    return [...stale.map((e) => ({ barco: e.barco, ultimo: e.report })), ...sinReporte];
  }, [entries, barcos, horasSinReporte]);

  function pedirPermisoNotificaciones() {
    if (!('Notification' in window)) {
      pushToast('Este navegador no soporta notificaciones', 'error');
      return;
    }
    void Notification.requestPermission().then((p) => {
      const ok = p === 'granted';
      setNotificationsEnabled(ok);
      pushToast(ok ? 'Notificaciones activadas' : 'Notificaciones denegadas', ok ? 'success' : 'info');
    });
  }

  function simular() {
    if (ds.mode === 'local') void ds.simularReporteEntrante?.();
  }

  return (
    <div className="dashboard">
      <div className="resumen">
        <div className="stat">
          <b>{totalBarcos}</b>
          <span>Barcos activos</span>
        </div>
        <div className="stat">
          <b>{enNavegacion}</b>
          <span>En navegación</span>
        </div>
        <div className="stat">
          <b>{paxMar}</b>
          <span>PAX en el mar</span>
        </div>
        <div className="stat">
          <b>{entries.length}</b>
          <span>Con reporte</span>
        </div>
        <div className="stat">
          <b>
            {conBitacora.size}/{totalBarcos}
          </b>
          <span>Bitácoras hoy</span>
        </div>
      </div>

      {esOperacion && (
        <div className="panel-ops">
          <button
            className={`btn-toggle${soundEnabled ? ' on' : ''}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            <Icono nombre="altavoz" size={16} />
            Sonido {soundEnabled ? 'on' : 'off'}
          </button>
          <button
            className={`btn-toggle${notificationsEnabled ? ' on' : ''}`}
            onClick={pedirPermisoNotificaciones}
          >
            <Icono nombre="campana" size={16} />
            Notificaciones {notificationsEnabled ? 'on' : 'off'}
          </button>
          <label className="btn-toggle" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Icono nombre="alerta" size={16} />
            Alerta sin reporte
            <select
              value={horasSinReporte}
              onChange={(e) => setHorasSinReporte(parseInt(e.target.value, 10))}
              style={{ minHeight: 36, padding: '4px 8px', width: 'auto' }}
            >
              {[2, 3, 4, 6, 8].map((h) => (
                <option key={h} value={h}>
                  {h} h
                </option>
              ))}
            </select>
          </label>
          {ds.mode === 'local' && (
            <button className="btn-toggle demo" onClick={simular}>
              <Icono nombre="antena" size={16} />
              Simular reporte entrante (demo)
            </button>
          )}
        </div>
      )}

      {alertas.length > 0 && (
        <div className="alertas">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icono nombre="alerta" size={18} />
            Alertas
          </h3>
          {barcosSinBitacora.map((b) => (
            <div key={`bit-${b.id}`} className="alerta">
              <b>{b.nombre}</b>
              <span>sin Check Bitácora hoy</span>
            </div>
          ))}
          {alertas.map((a) => (
            <div key={`rep-${a.barco.id}`} className="alerta">
              <b>{a.barco.nombre}</b>
              {a.ultimo ? <span>último reporte {hace(a.ultimo.created_at)}</span> : <span>sin reportes hoy</span>}
            </div>
          ))}
        </div>
      )}

      <div className="filtros">
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {estados.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Buscar barco…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar barco"
        />
        <GpsStatusChip />
      </div>

      <div className="dashboard-grid">
        <div className="columna-flota">
          <div className="hoja-titulo">Flota</div>
          <div className="fleet-list">
            {isLoading && (
              <>
                <div className="esqueleto" />
                <div className="esqueleto" />
              </>
            )}
            {!isLoading && visibles.length === 0 && (
              <div className="muted center pad">No hay barcos que coincidan.</div>
            )}
            {visibles.map((e) => (
              <BoatRow
                key={e.barco.id}
                entry={e}
                esOperacion={esOperacion}
                onCentrar={centrarBarco}
              />
            ))}
          </div>
        </div>

        <div className="mapa-wrap">
          <MapaNautico
            centro={[10.4, -75.53]}
            zoom={11}
            marcadores={marcadores}
            enfoque={enfoque}
          />
        </div>

        <div className="columna-dia">
          <div className="hoja-titulo">
            <span>Bitácoras del día</span>
            <span className="muted">{formatFechaDia(hoyLocalISO())}</span>
          </div>
          <div className="dia-list">
            {barcos
              .filter((b) => b.activo)
              .map((b) => {
                const bit = bitacorasHoy.find((x) => x.barco_id === b.id);
                const entry = entries.find((e) => e.barco.id === b.id);
                return (
                  <Link key={b.id} to={`/barco/${b.id}`} className="boat-row" style={{ textDecoration: 'none' }}>
                    <div className="boat-header" style={{ paddingRight: 0 }}>
                      <span className="boat-title">{b.nombre}</span>
                      {bit ? <span className="sello ok">Abierta</span> : <span className="sello">Pendiente</span>}
                    </div>
                    <div className="fila-dato">
                      <span className="rotulo">Pax</span>
                      <span className="dato">{bit?.pasajeros ?? '—'}</span>
                      <span className="rotulo" style={{ marginLeft: 10 }}>
                        Comb.
                      </span>
                      <span className="dato">{bit?.combustible != null ? `${bit.combustible}%` : '—'}</span>
                    </div>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {entry ? `${entry.estado?.nombre ?? '—'} · ${hace(entry.report.created_at)}` : 'sin reportes hoy'}
                    </div>
                  </Link>
                );
              })}
          </div>
          <div className="perforado leyenda">
            {estados.map((e) => (
              <span key={e.id} className="legend-item">
                <span className="estado-dot" style={{ background: e.color }} />
                {e.nombre}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BoatRow({
  entry,
  esOperacion,
  onCentrar,
}: {
  entry: FleetEntry;
  esOperacion: boolean;
  onCentrar: (barcoId: string) => void;
}) {
  const { report, barco, estado, operador } = entry;
  const pushToast = useUIStore((s) => s.pushToast);

  function borrar(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar TODOS los reportes de ${barco.nombre}? Esta acción no se puede deshacer.`)) {
      return;
    }
    ds.deleteReportesDeBarco(barco.id)
      .then(() => pushToast(`Reportes de ${barco.nombre} eliminados`, 'success'))
      .catch(() => pushToast('Error al eliminar', 'error'));
  }

  return (
    <div
      className="boat-row"
      role="button"
      tabIndex={0}
      style={{ cursor: 'pointer' }}
      onClick={() => onCentrar(barco.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onCentrar(barco.id);
      }}
    >
      {esOperacion && (
        <button
          className="btn-delete"
          title="Eliminar todos los reportes"
          aria-label={`Eliminar todos los reportes de ${barco.nombre}`}
          onClick={borrar}
        >
          <Icono nombre="papelera" size={18} />
        </button>
      )}
      <div className="boat-header">
        <span className="boat-title">{barco.nombre}</span>
        <span className="estado-tag" style={{ borderColor: estado?.color, color: estado?.color }}>
          <span className="estado-dot" style={{ background: estado?.color }} />
          {estado?.nombre ?? 'Sin estado'}
        </span>
      </div>
      <div className="boat-place" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icono nombre="ubicacion" size={14} />
        {report.lugar || 'Sin ubicación específica'}
      </div>
      <div className="boat-info">
        <span>
          <b>{report.pasajeros}</b> pax
        </span>
        <span>
          <b>{report.maletas}</b> maletas
        </span>
        <span>
          <b>{report.bolsos}</b> bolsos
        </span>
      </div>
      <div className="boat-time">
        {formatHora(report.created_at)} · {hace(report.created_at)}
        {operador ? ` · ${operador.nombre}` : ''}
      </div>
    </div>
  );
}

function gpsColor(b: GpsBoat): string {
  if (b.online === 'online') return '#22c55e';
  if (b.online === 'offline') return '#ef4444';
  return '#f59e0b';
}

function gpsTexto(b: GpsBoat): string {
  if (b.online === 'online') return 'En movimiento';
  if (b.online === 'offline') return 'Sin señal';
  return 'Conectado';
}
