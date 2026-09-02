import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useBarcos, useMiBarco, useMiBitacoraHoy } from '../../hooks/useFleet';
import {
  enviarOrdenMantenimiento,
  mantenimientoDisponible,
  motivoNoDisponible,
  type PrioridadMantenimiento,
} from '../../services/maintainX';
import { useUIStore } from '../../store/uiStore';
import { Icono } from '../ui/Iconos';

/**
 * REPORTE DE MANTENIMIENTO (capitanes) — orden de trabajo a MaintainX.
 * Formulario limpio a bordo: título (qué pasó), fotos/evidencia, descripción
 * (contexto), dónde está el daño (opcional) y qué tan urgente (opcional).
 * Se crea una WORK ORDER asignada al usuario de mantenimiento y las fotos se
 * adjuntan como evidencia1.jpg, evidencia2.jpg… El contexto completo (barco,
 * quién reporta, hora) viaja en la descripción para quien revise.
 */
export default function MantenimientoForm() {
  const { session } = useAuth();
  const pushToast = useUIStore((s) => s.pushToast);
  const { data: barcos = [] } = useBarcos();
  const inputFotos = useRef<HTMLInputElement>(null);

  const esCapitan = session?.profile.rol === 'capitan';
  const rolLabel = esCapitan ? 'capitán' : session?.profile.rol ?? '';

  const miAsignacion = useMiBarco(session?.profile.id ?? null, session?.profile.rol ?? null);
  const { data: miBitacoraHoy } = useMiBitacoraHoy(session?.profile.id ?? null);
  const barcosElegibles = useMemo(() => barcos.filter((b) => b.activo), [barcos]);

  const [barcoId, setBarcoId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [zona, setZona] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [prioridad, setPrioridad] = useState<PrioridadMantenimiento | ''>('');
  const [fotos, setFotos] = useState<{ file: File; url: string }[]>([]);

  const [fase, setFase] = useState<'form' | 'enviando' | 'hecho'>('form');
  const [orderId, setOrderId] = useState<number | null>(null);
  const [fotosProgreso, setFotosProgreso] = useState<{ subidas: number; total: number } | null>(null);
  const [fotosFallidas, setFotosFallidas] = useState(0);

  const nombreBarco = barcos.find((b) => b.id === barcoId)?.nombre ?? '…';

  // Barco por defecto: el del día del capitán (su bitácora de hoy); si no,
  // el asignado por operaciones; si no, el único activo.
  useEffect(() => {
    if (barcoId) return;
    const enLista = (id?: string) => !!id && barcosElegibles.some((b) => b.id === id);
    const hoy = miBitacoraHoy?.barco_id;
    const asignado = miAsignacion?.barco_id;
    const inicial =
      (enLista(hoy) && hoy) ||
      (enLista(asignado) && asignado) ||
      (barcosElegibles.length === 1 ? barcosElegibles[0].id : '');
    setBarcoId(inicial);
  }, [barcoId, miAsignacion, miBitacoraHoy, barcosElegibles]);

  // Limpieza de las vistas previas al desmontar (ref para ver las fotos actuales).
  const fotosRef = useRef(fotos);
  fotosRef.current = fotos;
  useEffect(() => {
    return () => fotosRef.current.forEach((f) => URL.revokeObjectURL(f.url));
  }, []);

  function agregarFotos(lista: FileList | null) {
    if (!lista) return;
    const nuevas = Array.from(lista)
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, Math.max(0, 6 - fotos.length));
    if (nuevas.length === 0) return;
    setFotos((prev) => [
      ...prev,
      ...nuevas.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ]);
    if (inputFotos.current) inputFotos.current.value = '';
  }

  function quitarFoto(i: number) {
    setFotos((prev) => {
      URL.revokeObjectURL(prev[i].url);
      return prev.filter((_, j) => j !== i);
    });
  }

  function puedeEnviar() {
    return fase === 'form' && barcoId && titulo.trim().length > 0;
  }

  async function enviar() {
    if (!puedeEnviar() || !session) return;
    setFase('enviando');
    setFotosFallidas(0);
    setFotosProgreso(null);

    // Contexto completo en la descripción: lo que el capitán escribe + quién,
    // dónde (barco) y cuándo — quien revise en MaintainX lo lee todo aquí.
    const texto = [zona.trim() && `Ubicación del daño: ${zona.trim()}`, descripcion.trim()]
      .filter(Boolean)
      .join('\n\n');
    const ahora = new Date().toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const pie = `Barco: ${nombreBarco}\nReportado por: ${session.profile.nombre} (${rolLabel}) · ${ahora}`;
    const description = texto ? `${texto}\n\n${pie}` : pie;

    try {
      const res = await enviarOrdenMantenimiento(
        {
          title: titulo.trim(),
          description,
          priority: prioridad || undefined,
        },
        fotos.map((f) => f.file),
        (subidas, total) => setFotosProgreso({ subidas, total }),
      );
      setOrderId(res.orderId);
      setFotosFallidas(res.fotosFallidas);
      setFase('hecho');
      pushToast(
        res.fotosFallidas > 0
          ? `Orden #${res.orderId} enviada (${res.fotosSubidas} foto(s) subidas, ${res.fotosFallidas} pendientes)`
          : `Orden #${res.orderId} enviada a mantenimiento`,
        res.fotosFallidas > 0 ? 'info' : 'success',
      );
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Error al enviar la orden', 'error');
      setFase('form');
    }
  }

  function reiniciar() {
    setTitulo('');
    setZona('');
    setDescripcion('');
    setPrioridad('');
    setFotos((prev) => {
      prev.forEach((f) => URL.revokeObjectURL(f.url));
      return [];
    });
    setOrderId(null);
    setFase('form');
  }

  return (
    <div className="report-page">
      <h1 className="con-icono">
        <Icono nombre="mantenimiento" />
        Reporte de Mantenimiento
      </h1>

      {!mantenimientoDisponible() && (
        <div className="gate">
          <span className="gate-icono">
            <Icono nombre="alerta" size={36} />
          </span>
          <p>{motivoNoDisponible()}</p>
        </div>
      )}

      {mantenimientoDisponible() && fase === 'hecho' && orderId && (
        <div className="hoja">
          <div className="perforado">
            <div className="fila-dato" style={{ justifyContent: 'center' }}>
              <span className="sello ok sello-cae">
                <Icono nombre="sello" size={14} />
                Orden enviada
              </span>
            </div>
            <p style={{ textAlign: 'center', margin: '14px 0 0' }}>
              Tu orden <b>#{orderId}</b> ya está en MaintainX para el equipo de mantenimiento.
            </p>
            {fotosFallidas > 0 && (
              <p className="muted" style={{ textAlign: 'center', marginBottom: 0 }}>
                {fotosFallidas} foto(s) no se pudieron adjuntar — revisa tu conexión o comprímelas e
                intenta de nuevo.
              </p>
            )}
          </div>
          <button className="btn-secundario" style={{ width: '100%', marginTop: 12 }} onClick={reiniciar}>
            ENVIAR OTRA ORDEN
          </button>
        </div>
      )}

      {mantenimientoDisponible() && fase !== 'hecho' && (
        <>
          {barcosElegibles.length === 0 && (
            <div className="gate">
              <span className="gate-icono">
                <Icono nombre="alerta" size={36} />
              </span>
              <p>No hay embarcaciones activas para reportar daños.</p>
            </div>
          )}

          {barcosElegibles.length > 0 && (
            <>
              <div className="hoja">
                <div className="campo">
                  <label htmlFor="manto-barco">Barco / Yate</label>
                  <select id="manto-barco" value={barcoId} onChange={(e) => setBarcoId(e.target.value)}>
                    <option value="">Selecciona barco…</option>
                    {barcosElegibles.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="campo">
                  <label htmlFor="manto-titulo">Título — qué pasó</label>
                  <input
                    id="manto-titulo"
                    type="text"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ej: Fuga de agua en camarote proa"
                    maxLength={200}
                    autoComplete="off"
                  />
                </div>

                <div className="campo">
                  <label>Fotos / evidencia (recomendado)</label>
                  <input
                    ref={inputFotos}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={(e) => agregarFotos(e.target.files)}
                    style={{ display: 'none' }}
                  />
                  {fotos.length === 0 ? (
                    <button
                      type="button"
                      className="btn-secundario"
                      style={{ width: '100%' }}
                      onClick={() => inputFotos.current?.click()}
                    >
                      <Icono nombre="camara" size={16} />
                      AGREGAR FOTOS
                    </button>
                  ) : (
                    <div className="manto-fotos">
                      {fotos.map((f, i) => (
                        <div className="manto-foto" key={f.url}>
                          <img src={f.url} alt={`Evidencia ${i + 1}`} />
                          <button
                            type="button"
                            className="manto-foto-x"
                            title="Quitar foto"
                            aria-label={`Quitar foto ${i + 1}`}
                            onClick={() => quitarFoto(i)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {fotos.length < 6 && (
                        <button
                          type="button"
                          className="manto-foto manto-foto-agregar"
                          onClick={() => inputFotos.current?.click()}
                          aria-label="Agregar más fotos"
                        >
                          +
                        </button>
                      )}
                    </div>
                  )}
                  <p className="muted" style={{ marginBottom: 0 }}>
                    Se envían como evidencia1.jpg, evidencia2.jpg… (máx. 6, se comprimen solas).
                  </p>
                </div>

                <div className="campo">
                  <label htmlFor="manto-zona">¿Dónde está el daño? (opcional)</label>
                  <input
                    id="manto-zona"
                    type="text"
                    value={zona}
                    onChange={(e) => setZona(e.target.value)}
                    placeholder="Ej: camarote proa, lado estribor"
                    maxLength={200}
                  />
                </div>

                <div className="campo">
                  <label htmlFor="manto-descripcion">Descripción (opcional)</label>
                  <textarea
                    id="manto-descripcion"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Tipo de daño, qué observaste, qué necesita el equipo de mantenimiento…"
                    rows={4}
                    maxLength={3000}
                  />
                </div>

                <div className="campo">
                  <label>Qué tan urgente (opcional)</label>
                  <div className="chips-estado" role="radiogroup" aria-label="Prioridad">
                    {PRIORIDADES.map((p) => (
                      <button
                        key={p.valor}
                        type="button"
                        role="radio"
                        aria-checked={prioridad === p.valor}
                        className={`chip-estado${prioridad === p.valor ? ' sel' : ''}`}
                        onClick={() => setPrioridad(prioridad === p.valor ? '' : p.valor)}
                      >
                        <span
                          className="estado-dot"
                          style={{
                            background:
                              p.valor === 'HIGH' ? 'var(--sello)' : p.valor === 'MEDIUM' ? 'var(--ambar)' : 'var(--puerto)',
                          }}
                        />
                        {p.etiqueta}
                      </button>
                    ))}
                  </div>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    Barco, quién reporta y la hora se agregan solos a la descripción para el equipo de
                    mantenimiento.
                  </p>
                </div>
              </div>

              <div className="barra-enviar">
                <button
                  className="btn-stamp"
                  onClick={() => void enviar()}
                  disabled={!puedeEnviar()}
                >
                  <Icono nombre="mantenimiento" />
                  {fase === 'enviando'
                    ? fotosProgreso && fotosProgreso.total > 0
                      ? `SUBIENDO FOTOS ${fotosProgreso.subidas}/${fotosProgreso.total}…`
                      : 'ENVIANDO A MANTENIMIENTO…'
                    : 'ENVIAR A MANTENIMIENTO'}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

const PRIORIDADES: { valor: PrioridadMantenimiento; etiqueta: string }[] = [
  { valor: 'LOW', etiqueta: 'Baja' },
  { valor: 'MEDIUM', etiqueta: 'Media' },
  { valor: 'HIGH', etiqueta: 'Alta' },
];
