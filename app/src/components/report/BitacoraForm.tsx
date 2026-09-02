import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import {
  useBarcos,
  useBitacoraDeHoy,
  useMiBarco,
  useMiBitacoraHoy,
  usePerfiles,
  useRutas,
} from '../../hooks/useFleet';
import { ds } from '../../services';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useUIStore } from '../../store/uiStore';
import { useHoy } from '../../hooks/useHoy';
import { formatFechaDia } from '../../utils/format';
import { Icono } from '../ui/Iconos';
import type { Bitacora } from '../../types';

/**
 * CHECK BITÁCORA — el ritual de apertura del día.
 * Una por barco y día: ruta, marineros a bordo, pasajeros y combustible.
 * Sellarla habilita los reportes de la tripulación (el gate vive en la BD).
 */
export default function BitacoraForm() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pushToast = useUIStore((s) => s.pushToast);

  const esCapitan = session?.profile.rol === 'capitan';
  const { data: barcos = [] } = useBarcos();
  const { data: rutas = [] } = useRutas();
  const { data: perfiles = [] } = usePerfiles();
  // GPS en segundo plano:se obtiene solo mientras se llena la bitácora.
  const { geo } = useGeolocation();

  // Al iniciar el día el capitán puede elegir CUALQUIER barco activo
  // (la BD lo permite: bitacoras_insert para cualquier capitán).
  const barcosElegibles = useMemo(() => barcos.filter((b) => b.activo), [barcos]);

  // Barco: auto-seleccionado cuando hay uno solo; si no, se elige.
  const [barcoId, setBarcoId] = useState('');

  // El capitán elige su barco al abrir la bitácora (una vez por día).
  // Pre-seleccionamos el que ya abrió hoy; si no, el que le tiene asignado
  // operaciones (corregible); si no, el único activo; si no, que lo elija.
  const miAsignacion = useMiBarco(session?.profile.id ?? null, session?.profile.rol ?? null);
  const { data: miBitacoraHoy } = useMiBitacoraHoy(session?.profile.id ?? null);

  // Auto-selección cuando hay un único barco o el del capitán.
  useEffect(() => {
    if (barcoId) return;
    const asignado = miAsignacion?.barco_id;
    const hoy = miBitacoraHoy?.barco_id;
    const enLista = (id?: string) => !!id && barcosElegibles.some((b) => b.id === id);
    const inicial =
      (enLista(hoy) && hoy) || (enLista(asignado) && asignado) || (barcosElegibles.length === 1 ? barcosElegibles[0].id : '');
    setBarcoId(inicial);
  }, [barcoId, miAsignacion, miBitacoraHoy, barcosElegibles]);

  const { data: bitacora, isLoading } = useBitacoraDeHoy(barcoId || null);
  const [editando, setEditando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [sellada, setSellada] = useState(false);

  const [rutaId, setRutaId] = useState('');
  const [pasajeros, setPasajeros] = useState('0');
  const [combustible, setCombustible] = useState(100);
  const [marinerosSel, setMarinerosSel] = useState<string[]>([]);

  // El capitán asigna a los marineros a bordo desde el formulario: se eligen
  // de TODOS los marineros (rol marinero), no de una asignación previa.
  const marineros = useMemo(
    () => perfiles.filter((p) => p.rol === 'marinero'),
    [perfiles],
  );

  const rutaDe = (b: Bitacora | null | undefined) =>
    rutas.find((r) => r.id === b?.ruta_id)?.nombre ?? '—';
  const nombreDe = (id: string) => perfiles.find((p) => p.id === id)?.nombre ?? '—';

  async function sellar() {
    if (!barcoId) {
      pushToast('Selecciona la embarcación', 'error');
      return;
    }
    setEnviando(true);
    try {
      await ds.createBitacora({
        barco_id: barcoId,
        capitan_id: session?.profile.id ?? null,
        ruta_id: rutaId || null,
        pasajeros: parseInt(pasajeros || '0', 10) || 0,
        combustible,
        lat: geo.status === 'ok' ? geo.lat : null,
        lng: geo.status === 'ok' ? geo.lng : null,
        marineros: marinerosSel,
      });
      await queryClient.invalidateQueries({ queryKey: ['bitacora', 'hoy'] });
      setSellada(true);
      setEditando(false);
      pushToast('Bitácora sellada — día abierto', 'success');
      if (esCapitan) setTimeout(() => navigate('/reportar'), 900);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Error al sellar la bitácora', 'error');
    } finally {
      setEnviando(false);
    }
  }

  async function guardarEdicion() {
    if (!bitacora) return;
    setEnviando(true);
    try {
      await ds.updateBitacora(bitacora.id, {
        ruta_id: rutaId || null,
        pasajeros: parseInt(pasajeros || '0', 10) || 0,
        combustible,
        marineros: marinerosSel,
      });
      await queryClient.invalidateQueries({ queryKey: ['bitacora', 'hoy'] });
      setEditando(false);
      pushToast('Bitácora actualizada', 'success');
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Error al actualizar', 'error');
    } finally {
      setEnviando(false);
    }
  }

  function empezarEdicion() {
    if (!bitacora) return;
    setRutaId(bitacora.ruta_id ?? '');
    setPasajeros(String(bitacora.pasajeros));
    setCombustible(bitacora.combustible ?? 100);
    setMarinerosSel(bitacora.marineros);
    setEditando(true);
  }

  const hoyStr = useHoy();
  const hoy = formatFechaDia(hoyStr);

  // Reinicio diario: al cambiar la fecha, la bitácora vuelve a estar vacía
  // y el capitán empieza un día nuevo (nuevo barco, nuevos marineros).
  useEffect(() => {
    setBarcoId('');
    setRutaId('');
    setPasajeros('0');
    setCombustible(100);
    setMarinerosSel([]);
    setEditando(false);
    setSellada(false);
  }, [hoyStr]);

  return (
    <div className="report-page">
      <h1 className="con-icono">
        <Icono nombre="bitacora" />
        Check Bitácora
      </h1>

      <div className="hoja">
        <div className="campo">
          <div className="fila-dato" style={{ justifyContent: 'center', marginBottom: 10 }}>
            <span className="rotulo">Fecha</span>
            <span className="dato">{hoy}</span>
          </div>
          <label htmlFor="bitacora-barco">Barco</label>
          <select id="bitacora-barco" value={barcoId} onChange={(e) => setBarcoId(e.target.value)}>
            <option value="">Selecciona barco…</option>
            {barcosElegibles.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </div>

        {isLoading && <div className="esqueleto" style={{ marginTop: 14 }} />}

        {!isLoading && bitacora && !editando && (
          <div className="perforado">
            <div className="fila-dato" style={{ justifyContent: 'space-between' }}>
              <div>
                <span className={`sello ok${sellada ? ' sello-cae' : ''}`}>
                  <Icono nombre="sello" size={14} />
                  Día abierto
                </span>
              </div>
              {esCapitan && (
                <button className="btn-mini" onClick={empezarEdicion}>
                  Editar
                </button>
              )}
            </div>
            <div className="fila-dato" style={{ marginTop: 12 }}>
              <span className="rotulo">Ruta</span>
              <span className="dato">{rutaDe(bitacora)}</span>
            </div>
            <div className="fila-dato">
              <span className="rotulo">Pasajeros</span>
              <span className="dato">{bitacora.pasajeros}</span>
              <span className="rotulo" style={{ marginLeft: 14 }}>
                Combustible
              </span>
              <span className="dato">{bitacora.combustible ?? '—'}%</span>
            </div>
            <div className="fila-dato">
              <span className="rotulo">Marineros a bordo</span>
              <span>
                {bitacora.marineros.length > 0
                  ? bitacora.marineros.map(nombreDe).join(', ')
                  : '—'}
              </span>
            </div>
            {esCapitan && (
              <p className="muted" style={{ marginBottom: 0 }}>
                Tu tripulación ya puede enviar reportes operativos.
              </p>
            )}
          </div>
        )}

        {!isLoading && (!bitacora || editando) && (
          <div className="perforado">
            {editando && (
              <div className="status-ok-msg" style={{ marginTop: 0 }}>
                Editando la bitácora de hoy — los cambios aplican al instante.
              </div>
            )}

            <div className="campo">
              <label htmlFor="bitacora-ruta">Ruta</label>
              <select id="bitacora-ruta" value={rutaId} onChange={(e) => setRutaId(e.target.value)}>
                <option value="">Selecciona ruta…</option>
                {rutas
                  .filter((r) => r.activo)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
              </select>
            </div>

            <div className="campo">
              <label>Marineros a bordo</label>
              {marineros.length === 0 && (
                <p className="muted">No hay marineros registrados en la tripulación.</p>
              )}
              {marineros.length > 0 && (
                <p className="muted">Tú asignas quién va a bordo hoy (marca los que suben).</p>
              )}
              <div className="grid-2" style={{ gap: 8 }}>
                {marineros.map((p) => (
                  <label
                    key={p.id}
                    className="chip-estado"
                    style={{ minHeight: 48, cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={marinerosSel.includes(p.id)}
                      onChange={(e) =>
                        setMarinerosSel((prev) =>
                          e.target.checked
                            ? [...prev, p.id]
                            : prev.filter((id) => id !== p.id),
                        )
                      }
                    />
                    {p.nombre}
                  </label>
                ))}
              </div>
            </div>

            <div className="campo">
              <label htmlFor="bitacora-pasajeros">Número de pasajeros</label>
              <input
                id="bitacora-pasajeros"
                type="number"
                inputMode="numeric"
                min={0}
                value={pasajeros}
                onChange={(e) => setPasajeros(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="campo">
              <label htmlFor="bitacora-combustible">Nivel de combustible</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  id="bitacora-combustible"
                  className="rango"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={combustible}
                  onChange={(e) => setCombustible(parseInt(e.target.value, 10))}
                />
                <span className="rango-valor">{combustible}%</span>
              </div>
            </div>

            <div className={`gps gps-${geo.status}`} style={{ marginTop: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icono nombre="ubicacion" size={14} />
                {geo.status === 'idle' && 'GPS: a la espera…'}
                {geo.status === 'loading' && 'GPS: ubicando la posición…'}
                {geo.status === 'ok' && `GPS: ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}`}
                {geo.status === 'error' && `GPS: ${geo.message}`}
              </span>
              <span className="muted">· se guarda en la bitácora al sellar</span>
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
              {editando && (
                <button
                  className="btn-secundario"
                  style={{ flex: 1 }}
                  onClick={() => setEditando(false)}
                  disabled={enviando}
                >
                  Cancelar
                </button>
              )}
              <button
                className="btn-stamp"
                style={{ flex: 2 }}
                onClick={() => void (editando ? guardarEdicion() : sellar())}
                disabled={enviando || !barcoId}
              >
                {enviando ? 'SELLANDO…' : editando ? 'GUARDAR CAMBIOS' : 'SELLAR BITÁCORA'}
              </button>
            </div>
          </div>
        )}
      </div>

      {esCapitan && bitacora && !editando && (
        <Link to="/reportar" className="btn-stamp exito" style={{ textDecoration: 'none' }}>
          <Icono nombre="reportar" />
          IR A REPORTAR
        </Link>
      )}
    </div>
  );
}
