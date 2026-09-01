import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import {
  useAsignaciones,
  useBarcos,
  useBitacoraDeHoy,
  usePerfiles,
  useRutas,
  useTripulacionDeBarco,
} from '../../hooks/useFleet';
import { ds } from '../../services';
import { useUIStore } from '../../store/uiStore';
import { formatFechaDia, hoyLocalISO } from '../../utils/format';
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
  const { data: asignaciones = [] } = useAsignaciones();

  // Barcos elegibles: el capitán solo ve SUS barcos; operación, todos.
  const barcosElegibles = useMemo(() => {
    if (esCapitan && session) {
      const mios = asignaciones
        .filter((a) => a.perfil_id === session.profile.id && a.es_capitan)
        .map((a) => a.barco_id);
      return barcos.filter((b) => mios.includes(b.id));
    }
    return barcos.filter((b) => b.activo);
  }, [esCapitan, session, asignaciones, barcos]);

  // Barco: el capitán usa sus barcos asignados; operación elige cualquiera.
  const [barcoId, setBarcoId] = useState('');
  const { crew } = useTripulacionDeBarco(barcoId || null);

  // Auto-selección cuando hay un único barco (caso típico del capitán).
  useEffect(() => {
    if (!barcoId && barcosElegibles.length === 1) {
      setBarcoId(barcosElegibles[0].id);
    }
  }, [barcoId, barcosElegibles]);

  const { data: bitacora, isLoading } = useBitacoraDeHoy(barcoId || null);
  const [editando, setEditando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [sellada, setSellada] = useState(false);

  const [rutaId, setRutaId] = useState('');
  const [pasajeros, setPasajeros] = useState('0');
  const [combustible, setCombustible] = useState(100);
  const [marinerosSel, setMarinerosSel] = useState<string[]>([]);

  const marineros = useMemo(
    () => crew.filter((c) => !c.asignacion.es_capitan && c.perfil),
    [crew],
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

  const hoy = formatFechaDia(hoyLocalISO());

  return (
    <div className="report-page">
      <h1 className="con-icono">
        <Icono nombre="bitacora" />
        Check Bitácora
      </h1>

      <div className="hoja">
        <div className="campo">
          <label htmlFor="bitacora-barco">Barco</label>
          <select id="bitacora-barco" value={barcoId} onChange={(e) => setBarcoId(e.target.value)}>
            <option value="">Selecciona barco…</option>
            {barcosElegibles.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
          <div className="fila-dato" style={{ marginTop: 8, justifyContent: 'center' }}>
            <span className="rotulo">Fecha</span>
            <span className="dato">{hoy}</span>
          </div>
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
                <p className="muted">
                  Operaciones aún no ha registrado tripulación para este barco.
                </p>
              )}
              <div className="grid-2" style={{ gap: 8 }}>
                {marineros.map(({ perfil }) => (
                  <label
                    key={perfil!.id}
                    className="chip-estado"
                    style={{ minHeight: 48, cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={marinerosSel.includes(perfil!.id)}
                      onChange={(e) =>
                        setMarinerosSel((prev) =>
                          e.target.checked
                            ? [...prev, perfil!.id]
                            : prev.filter((id) => id !== perfil!.id),
                        )
                      }
                    />
                    {perfil!.nombre}
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
