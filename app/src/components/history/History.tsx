import { useMemo, useState } from 'react';
import { useBarcos, useEstados, usePerfiles } from '../../hooks/useFleet';
import { useReportes } from '../../hooks/useHistory';
import { exportarAExcel, filasDesdeEntries } from '../../export/exportExcel';
import { joinFleet } from '../../services';
import { useUIStore } from '../../store/uiStore';
import { finDelDia, formatDateTime, haceNDiasISO, hoyISO } from '../../utils/format';
import { Icono } from '../ui/Iconos';

const LIMITE_VISIBLE = 300;

/**
 * HISTORIAL: consulta por rango de fechas (+ filtros de barco/estado)
 * y EXPORTACIÓN A EXCEL del resultado.
 */
export default function History() {
  const { data: barcos = [] } = useBarcos();
  const { data: estados = [] } = useEstados();
  const { data: perfiles = [] } = usePerfiles();
  const pushToast = useUIStore((s) => s.pushToast);

  const [desde, setDesde] = useState(haceNDiasISO(7));
  const [hasta, setHasta] = useState(hoyISO());
  const [barcoId, setBarcoId] = useState('');
  const [estadoId, setEstadoId] = useState('');

  const desdeDate = useMemo(() => (desde ? new Date(`${desde}T00:00:00`) : null), [desde]);
  const hastaDate = useMemo(
    () => (hasta ? finDelDia(new Date(`${hasta}T00:00:00`)) : null),
    [hasta],
  );

  const { data: reportes = [], isLoading, isError } = useReportes(desdeDate, hastaDate, barcoId, estadoId);

  const entries = useMemo(
    () => joinFleet(reportes, barcos, estados, perfiles),
    [reportes, barcos, estados, perfiles],
  );

  async function exportar() {
    if (entries.length === 0) {
      pushToast('No hay reportes en el rango seleccionado', 'error');
      return;
    }
    try {
      await exportarAExcel(filasDesdeEntries(entries), `reportes_flota_${desde}_${hasta}.xlsx`);
      pushToast(`Exportados ${entries.length} reportes a Excel`, 'success');
    } catch {
      pushToast('Error al exportar el Excel', 'error');
    }
  }

  const visibles = entries.slice(0, LIMITE_VISIBLE);

  return (
    <div className="history">
      <h1 className="con-icono">
        <Icono nombre="historial" />
        Historial y exportación
      </h1>

      <div className="hoja">
        <div className="grid-4">
          <div>
            <label htmlFor="hist-desde">Desde</label>
            <input id="hist-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <label htmlFor="hist-hasta">Hasta</label>
            <input id="hist-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div>
            <label htmlFor="hist-barco">Embarcación</label>
            <select id="hist-barco" value={barcoId} onChange={(e) => setBarcoId(e.target.value)}>
              <option value="">Todas</option>
              {barcos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="hist-estado">Estado</label>
            <select id="hist-estado" value={estadoId} onChange={(e) => setEstadoId(e.target.value)}>
              <option value="">Todos</option>
              {estados.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="history-bar">
          <span className="muted">
            {isLoading
              ? 'Consultando…'
              : `${entries.length} reportes encontrados${entries.length > LIMITE_VISIBLE ? ` (mostrando ${LIMITE_VISIBLE})` : ''}`}
          </span>
          <button className="btn-export" onClick={() => void exportar()} disabled={isLoading}>
            <Icono nombre="descargar" size={18} />
            Exportar a Excel
          </button>
        </div>

        {isError && <div className="status-error-msg">Error consultando los reportes.</div>}

        <div className="table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Embarcación</th>
                <th>Estado</th>
                <th>Operador</th>
                <th>Lugar</th>
                <th>PAX</th>
                <th>Maletas</th>
                <th>Bolsos</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((e) => (
                <tr key={e.report.id}>
                  <td>{formatDateTime(e.report.created_at)}</td>
                  <td>
                    <b>{e.barco.nombre}</b>
                  </td>
                  <td>
                    <span style={{ color: e.estado?.color }}>{e.estado?.nombre ?? '—'}</span>
                  </td>
                  <td>{e.operador?.nombre ?? '—'}</td>
                  <td>{e.report.lugar || '—'}</td>
                  <td className="num">{e.report.pasajeros}</td>
                  <td className="num">{e.report.maletas}</td>
                  <td className="num">{e.report.bolsos}</td>
                </tr>
              ))}
              {!isLoading && visibles.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted center pad">
                    Sin reportes en el rango seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
