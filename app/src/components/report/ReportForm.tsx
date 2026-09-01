import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useBarcos, useBitacoraDeHoy, useEstados, useMiBarco } from '../../hooks/useFleet';
import { useGeolocation } from '../../hooks/useGeolocation';
import { ds } from '../../services';
import { useUIStore } from '../../store/uiStore';
import { finDelDia, formatHora, hace, inicioDelDia } from '../../utils/format';
import { Icono } from '../ui/Iconos';
import type { Report } from '../../types';

/**
 * REPORTE OPERATIVO — experiencia de tripulación en el teléfono.
 * - Solo disponible si la Check Bitácora de hoy ya está sellada (gate).
 * - El barco viene auto-asignado (no hay que escribirlo).
 * - Estado en chips grandes; "Recogida de pasajeros" pide PAX/maletas/bolsos
 *   (pre-rellenados del reporte anterior); los demás estados solo piden lugar.
 * - GPS automático; se puede enviar sin coordenadas.
 */
export default function ReportForm() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pushToast = useUIStore((s) => s.pushToast);

  const esCapitan = session?.profile.rol === 'capitan';
  const { data: barcos = [] } = useBarcos();
  const { data: estados = [] } = useEstados();
  const { geo, getGeo } = useGeolocation();

  const miAsignacion = useMiBarco(session?.profile.id ?? null, session?.profile.rol ?? null);
  const barcoId = miAsignacion?.barco_id ?? null;
  const barco = barcos.find((b) => b.id === barcoId);

  const { data: bitacora, isLoading: cargandoGate } = useBitacoraDeHoy(barcoId);

  const [estadoId, setEstadoId] = useState('');
  const [lugar, setLugar] = useState('');
  const [pasajeros, setPasajeros] = useState('');
  const [maletas, setMaletas] = useState('');
  const [bolsos, setBolsos] = useState('');
  const [notas, setNotas] = useState('');
  const [prellenado, setPrellenado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const estadoSel = estados.find((e) => e.id === estadoId);
  const pideCarga = estadoSel?.es_recogida ?? false;

  // Último reporte del barco (para pre-rellenar la recogida)
  const { data: ultimos = [] } = useQuery({
    queryKey: ['ultimos'],
    queryFn: () => ds.listUltimosReportes(),
    refetchInterval: 15_000,
  });
  const ultimoReporte = useMemo(
    () => ultimos.find((r) => r.barco_id === barcoId) ?? null,
    [ultimos, barcoId],
  );

  // Pre-relleno al elegir "Recogida de pasajeros" (datos del reporte anterior)
  useEffect(() => {
    if (!pideCarga || !ultimoReporte || prellenado) return;
    setPasajeros(String(ultimoReporte.pasajeros));
    setMaletas(String(ultimoReporte.maletas));
    setBolsos(String(ultimoReporte.bolsos));
    setPrellenado(true);
  }, [pideCarga, ultimoReporte, prellenado]);

  // Bitácora del día del barco (línea de tiempo bajo el formulario)
  const desdeHoy = inicioDelDia(new Date());
  const hastaHoy = finDelDia(new Date());
  const { data: bitacoraDia = [] } = useQuery({
    queryKey: ['reportes-de-hoy', barcoId],
    queryFn: () =>
      barcoId ? ds.listReportesDeBarco(barcoId, desdeHoy, hastaHoy) : Promise.resolve([] as Report[]),
    enabled: !!barcoId,
    refetchInterval: 15_000,
  });

  const estadoNombre = (id: string) => estados.find((e) => e.id === id)?.nombre ?? '';
  const estadoColor = (id: string) => estados.find((e) => e.id === id)?.color ?? '#94a3b8';

  async function enviar() {
    if (!barcoId || !estadoId) {
      pushToast('Selecciona el estado / actividad', 'error');
      return;
    }
    setEnviando(true);
    try {
      let lat: number | null = geo.status === 'ok' ? geo.lat : null;
      let lng: number | null = geo.status === 'ok' ? geo.lng : null;

      if (lat === null && 'geolocation' in navigator) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              lat = pos.coords.latitude;
              lng = pos.coords.longitude;
              resolve();
            },
            () => resolve(),
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
          );
        });
      }

      await ds.insertReporte({
        barco_id: barcoId,
        bitacora_id: bitacora?.id ?? null,
        estado_id: estadoId,
        pasajeros: pideCarga ? parseInt(pasajeros || '0', 10) || 0 : 0,
        maletas: pideCarga ? parseInt(maletas || '0', 10) || 0 : 0,
        bolsos: pideCarga ? parseInt(bolsos || '0', 10) || 0 : 0,
        lugar: lugar.trim(),
        lat,
        lng,
        notas: notas.trim(),
      });

      pushToast('Reporte enviado', 'success');
      if (lat === null) pushToast('Sin posición GPS — se envió sin coordenadas', 'info');
      await queryClient.invalidateQueries({ queryKey: ['ultimos'] });
      await queryClient.invalidateQueries({ queryKey: ['reportes-de-hoy', barcoId] });
      setNotas('');
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Error al enviar el reporte', 'error');
    } finally {
      setEnviando(false);
    }
  }

  // ---- Gate: sin bitácora del día no hay reporte ----
  if (!miAsignacion) {
    return (
      <div className="report-page">
        <h1 className="con-icono">
          <Icono nombre="reportar" />
          Reporte Operativo
        </h1>
        <div className="gate">
          <span className="gate-icono">
            <Icono nombre="brujula" size={36} />
          </span>
          <p>
            No tienes una embarcación asignada en tu tripulación.
            <br />
            Contacta a operaciones para que te asigne a tu barco.
          </p>
        </div>
      </div>
    );
  }

  if (cargandoGate) {
    return (
      <div className="report-page">
        <h1 className="con-icono">
          <Icono nombre="reportar" />
          Reporte Operativo
        </h1>
        <div className="esqueleto" />
        <div className="esqueleto" style={{ marginTop: 10 }} />
      </div>
    );
  }

  if (!bitacora) {
    return (
      <div className="report-page">
        <h1 className="con-icono">
          <Icono nombre="reportar" />
          Reporte Operativo
        </h1>
        <div className="gate">
          <span className="gate-icono">
            <Icono nombre="bitacora" size={36} />
          </span>
          {esCapitan ? (
            <>
              <p>
                Tu día aún no está abierto. La <b>Check Bitácora</b> es lo primero: séllala y se
                habilitan los reportes de toda tu tripulación.
              </p>
              <button className="btn-stamp" onClick={() => navigate('/bitacora')}>
                <Icono nombre="bitacora" />
                HACER CHECK BITÁCORA
              </button>
            </>
          ) : (
            <>
              <p>
                {barco?.nombre ?? 'Tu barco'} aún no abre el día. Espera a que el capitán haga la{' '}
                <b>Check Bitácora</b> y podrás reportar.
              </p>
              <Link to="/" className="btn-link">
                Actualizar
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="report-page">
      <h1 className="con-icono">
        <Icono nombre="reportar" />
        Reporte Operativo
      </h1>

      <div className="hoja">
        <div className="fila-dato" style={{ justifyContent: 'space-between' }}>
          <div>
            <span className="rotulo">Embarcación / Yate</span>
            <div className="dato" style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icono nombre="barco" size={18} />
              {barco?.nombre ?? '…'}
            </div>
          </div>
          <span className="sello ok">
            <Icono nombre="sello" size={14} />
            Día abierto
          </span>
        </div>

        <div className="campo">
          <label>Estado / Actividad</label>
          <div className="chips-estado" role="radiogroup" aria-label="Estado o actividad">
            {estados.map((e) => (
              <button
                key={e.id}
                type="button"
                role="radio"
                aria-checked={estadoId === e.id}
                className={`chip-estado${estadoId === e.id ? ' sel' : ''}`}
                style={estadoId === e.id ? { borderColor: e.color } : undefined}
                onClick={() => setEstadoId(e.id)}
              >
                <span className="estado-dot" style={{ background: e.color }} />
                {e.nombre}
              </button>
            ))}
          </div>
        </div>

        {pideCarga && (
          <div className="perforado">
            <div className="fila-dato">
              <span className="rotulo">Carga de este embarque</span>
              {prellenado && ultimoReporte && (
                <span className="dato-anterior">tomada de tu último reporte — ajústala si cambió</span>
              )}
            </div>
            <div className="grid-3">
              <div className="campo">
                <label htmlFor="rep-pasajeros">Pasajeros</label>
                <input
                  id="rep-pasajeros"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={pasajeros}
                  onChange={(e) => setPasajeros(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="campo">
                <label htmlFor="rep-maletas">Maletas</label>
                <input
                  id="rep-maletas"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={maletas}
                  onChange={(e) => setMaletas(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="campo">
                <label htmlFor="rep-bolsos">Bolsos</label>
                <input
                  id="rep-bolsos"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={bolsos}
                  onChange={(e) => setBolsos(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        )}

        <div className={`campo${pideCarga ? '' : ' perforado'}`}>
          <label htmlFor="rep-lugar">Lugar / Referencia</label>
          <input
            id="rep-lugar"
            type="text"
            value={lugar}
            onChange={(e) => setLugar(e.target.value)}
            placeholder="Ej: Isla Grande / Cholón"
            list="lugares-sugeridos"
          />
          <datalist id="lugares-sugeridos">
            <option value="Muelle La Bodeguita" />
            <option value="Bocachica" />
            <option value="Tierrabomba" />
            <option value="Cholón" />
            <option value="Isla Grande" />
            <option value="Playa Blanca" />
            <option value="Punta Arena" />
          </datalist>
        </div>

        <div className={`gps gps-${geo.status}`}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icono nombre="ubicacion" size={14} />
            {geo.status === 'idle' && 'GPS: sin posición aún (se intentará al enviar)'}
            {geo.status === 'loading' && 'GPS: obteniendo posición…'}
            {geo.status === 'ok' && `GPS: ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}`}
            {geo.status === 'error' && `GPS: ${geo.message}`}
          </span>
          <button type="button" className="btn-mini" onClick={getGeo}>
            Obtener posición
          </button>
        </div>

        <div className="campo">
          <label htmlFor="rep-notas">Notas (opcional)</label>
          <textarea
            id="rep-notas"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Observaciones…"
            rows={2}
          />
        </div>
      </div>

      <div className="hoja">
        <div className="hoja-titulo">
          <span>Bitácora de hoy — {barco?.nombre ?? '…'}</span>
          <span className="sello ok">Abierta</span>
        </div>
        {bitacoraDia.length === 0 && <p className="muted">Sin reportes hoy todavía.</p>}
        <ul className="bitacora-list">
          {[...bitacoraDia].reverse().map((r) => (
            <li key={r.id}>
              <span className="hora">{formatHora(r.created_at)}</span>
              <span className="estado-dot" style={{ background: estadoColor(r.estado_id) }} />
              <b>{estadoNombre(r.estado_id)}</b>
              <span className="muted">
                · {r.lugar || 'sin lugar'}
                {r.pasajeros > 0 && ` · ${r.pasajeros} PAX`}
                {r.maletas + r.bolsos > 0 && ` · ${r.maletas}M/${r.bolsos}B`}
              </span>
              <span className="muted">{hace(r.created_at)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="barra-enviar">
        <button
          className="btn-stamp"
          onClick={() => void enviar()}
          disabled={enviando || !estadoId}
        >
          <Icono nombre="antena" />
          {enviando ? 'ENVIANDO…' : `ENVIAR REPORTE${estadoSel ? ` — ${estadoSel.nombre.toUpperCase()}` : ''}`}
        </button>
      </div>
    </div>
  );
}
