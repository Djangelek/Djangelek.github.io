import { useState } from 'react';
import {
  useAsignaciones,
  useBarcos,
  useEstados,
  usePerfiles,
  useRutas,
} from '../../hooks/useFleet';
import { ds } from '../../services';
import { useUIStore } from '../../store/uiStore';
import { Icono } from '../ui/Iconos';
import type { Rol } from '../../types';

const ROLES: Rol[] = ['capitan', 'marinero', 'operacion', 'ventas'];
const ROL_LABEL: Record<Rol, string> = {
  capitan: 'Capitán',
  marinero: 'Marinero',
  operacion: 'Operación',
  ventas: 'Ventas',
};

/**
 * PANEL ADMIN (solo operación): embarcaciones, estados, rutas,
 * tripulación (capitán/marinero → barco) y personas (nombres y roles).
 */
export default function Admin() {
  const { data: barcos = [], refetch: refetchBarcos } = useBarcos();
  const { data: estados = [], refetch: refetchEstados } = useEstados();
  const { data: rutas = [], refetch: refetchRutas } = useRutas();
  const { data: perfiles = [], refetch: refetchPerfiles } = usePerfiles();
  const { data: asignaciones = [], refetch: refetchAsignaciones } = useAsignaciones();
  const pushToast = useUIStore((s) => s.pushToast);

  // Embarcaciones
  const [nuevoBarco, setNuevoBarco] = useState('');
  const [capacidad, setCapacidad] = useState('0');
  // Estados
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [colorEstado, setColorEstado] = useState('#0e7c7b');
  const [estadoRecogida, setEstadoRecogida] = useState(false);
  // Rutas
  const [nuevaRuta, setNuevaRuta] = useState('');
  // Tripulación
  const [asignarPerfil, setAsignarPerfil] = useState('');
  const [asignarBarco, setAsignarBarco] = useState('');
  const [asignarComo, setAsignarComo] = useState<'capitan' | 'marinero'>('marinero');
  const [asignarPrincipal, setAsignarPrincipal] = useState(false);

  function refetchTodo() {
    void refetchBarcos();
    void refetchEstados();
    void refetchRutas();
    void refetchPerfiles();
    void refetchAsignaciones();
  }

  async function agregarBarco() {
    if (!nuevoBarco.trim()) return;
    try {
      await ds.addBarco(nuevoBarco.trim(), parseInt(capacidad || '0', 10) || 0);
      pushToast('Barco agregado', 'success');
      setNuevoBarco('');
      refetchTodo();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Error', 'error');
    }
  }

  async function renombrarBarco(id: string, nombre: string) {
    const nuevo = window.prompt('Nuevo nombre del barco:', nombre);
    if (!nuevo || nuevo.trim() === '' || nuevo.trim() === nombre) return;
    try {
      await ds.updateBarco?.(id, { nombre: nuevo.trim() });
      pushToast('Nombre actualizado', 'success');
      refetchTodo();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Error', 'error');
    }
  }

  async function eliminarBarco(id: string, nombre: string) {
    if (!window.confirm(`¿Eliminar el barco ${nombre} y su historial?`)) return;
    try {
      await ds.removeBarco(id);
      pushToast('Barco eliminado', 'success');
      refetchTodo();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Error', 'error');
    }
  }

  async function agregarEstado() {
    if (!nuevoEstado.trim()) return;
    try {
      await ds.addEstado(nuevoEstado.trim(), colorEstado, estadoRecogida);
      pushToast('Estado agregado', 'success');
      setNuevoEstado('');
      setEstadoRecogida(false);
      refetchTodo();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Error', 'error');
    }
  }

  async function toggleRecogida(id: string, esRecogida: boolean) {
    try {
      await ds.updateEstado(id, { es_recogida: esRecogida });
      refetchTodo();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Error', 'error');
    }
  }

  async function eliminarEstado(id: string) {
    try {
      await ds.removeEstado(id);
      pushToast('Estado eliminado', 'success');
      refetchTodo();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Error', 'error');
    }
  }

  async function agregarRuta() {
    if (!nuevaRuta.trim()) return;
    try {
      await ds.addRuta(nuevaRuta.trim());
      pushToast('Ruta agregada', 'success');
      setNuevaRuta('');
      refetchTodo();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Error', 'error');
    }
  }

  async function eliminarRuta(id: string) {
    try {
      await ds.removeRuta(id);
      pushToast('Ruta eliminada', 'success');
      refetchTodo();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Error', 'error');
    }
  }

  async function asignar() {
    if (!asignarPerfil || !asignarBarco) return;
    try {
      await ds.assignBoat(asignarPerfil, asignarBarco, {
        es_capitan: asignarComo === 'capitan',
        es_principal: asignarPrincipal,
      });
      pushToast('Tripulante asignado al barco', 'success');
      setAsignarPerfil('');
      setAsignarBarco('');
      refetchTodo();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Error', 'error');
    }
  }

  async function desasignar(perfilId: string, barcoId: string) {
    try {
      await ds.unassignBoat(perfilId, barcoId);
      refetchTodo();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Error', 'error');
    }
  }

  async function cambiarRol(id: string, rol: Rol) {
    try {
      await ds.updateProfile(id, { rol });
      pushToast('Rol actualizado', 'success');
      refetchTodo();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Error', 'error');
    }
  }

  async function renombrarPersona(id: string, nombre: string) {
    const nuevo = window.prompt('Nuevo nombre:', nombre);
    if (!nuevo || nuevo.trim() === '' || nuevo.trim() === nombre) return;
    try {
      await ds.updateProfile(id, { nombre: nuevo.trim() });
      pushToast('Nombre actualizado', 'success');
      refetchTodo();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Error', 'error');
    }
  }

  return (
    <div className="admin">
      <h1 className="con-icono">
        <Icono nombre="admin" />
        Panel de administración
      </h1>

      <div className="admin-grid">
        {/* Embarcaciones */}
        <section className="hoja">
          <div className="hoja-titulo">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Icono nombre="barco" size={18} />
              Embarcaciones
            </span>
          </div>
          <ul className="admin-list">
            {barcos.map((b) => (
              <li key={b.id}>
                <span>
                  {b.nombre} <span className="muted">· cap. {b.capacidad_pax} pax</span>
                </span>
                <span style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-mini" onClick={() => void renombrarBarco(b.id, b.nombre)}>
                    <Icono nombre="editar" size={16} />
                    Nombre
                  </button>
                  <button className="btn-mini danger" onClick={() => void eliminarBarco(b.id, b.nombre)}>
                    Eliminar
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <div className="admin-form">
            <input
              type="text"
              placeholder="Nombre del barco"
              aria-label="Nombre del barco"
              value={nuevoBarco}
              onChange={(e) => setNuevoBarco(e.target.value)}
            />
            <input
              type="number"
              min={0}
              placeholder="Capacidad PAX"
              aria-label="Capacidad de pasajeros"
              value={capacidad}
              onChange={(e) => setCapacidad(e.target.value)}
              style={{ maxWidth: 150 }}
            />
            <button className="btn-mini" onClick={() => void agregarBarco()}>
              + Agregar
            </button>
          </div>
        </section>

        {/* Estados */}
        <section className="hoja">
          <div className="hoja-titulo">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Icono nombre="diana" size={18} />
              Estados / Actividades
            </span>
          </div>
          <ul className="admin-list">
            {estados.map((e) => (
              <li key={e.id}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="estado-dot" style={{ background: e.color }} />
                  <span>{e.nombre}</span>
                </span>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={e.es_recogida}
                      onChange={(ev) => void toggleRecogida(e.id, ev.target.checked)}
                    />
                    Recogida (pide PAX/maletas/bolsos)
                  </label>
                  <button className="btn-mini danger" onClick={() => void eliminarEstado(e.id)}>
                    Eliminar
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <div className="admin-form">
            <input
              type="text"
              placeholder="Nombre del estado"
              aria-label="Nombre del estado"
              value={nuevoEstado}
              onChange={(e) => setNuevoEstado(e.target.value)}
            />
            <input
              type="color"
              value={colorEstado}
              onChange={(e) => setColorEstado(e.target.value)}
              title="Color del estado"
              aria-label="Color del estado"
            />
            <button className="btn-mini" onClick={() => void agregarEstado()}>
              + Agregar
            </button>
          </div>
        </section>

        {/* Rutas */}
        <section className="hoja">
          <div className="hoja-titulo">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Icono nombre="brujula" size={18} />
              Rutas
            </span>
          </div>
          <ul className="admin-list">
            {rutas.map((r) => (
              <li key={r.id}>
                <span>{r.nombre}</span>
                <button className="btn-mini danger" onClick={() => void eliminarRuta(r.id)}>
                  Eliminar
                </button>
              </li>
            ))}
            {rutas.length === 0 && <li className="muted">Sin rutas todavía.</li>}
          </ul>
          <div className="admin-form">
            <input
              type="text"
              placeholder="Ej: Cartagena → Islas del Rosario"
              aria-label="Nueva ruta"
              value={nuevaRuta}
              onChange={(e) => setNuevaRuta(e.target.value)}
            />
            <button className="btn-mini" onClick={() => void agregarRuta()}>
              + Agregar
            </button>
          </div>
        </section>

        {/* Personas */}
        <section className="hoja">
          <div className="hoja-titulo">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Icono nombre="personas" size={18} />
              Personas y roles
            </span>
          </div>
          <ul className="admin-list">
            {perfiles.map((p) => (
              <li key={p.id} className="persona-row">
                <b>{p.nombre}</b>
                <select
                  value={p.rol}
                  onChange={(e) => void cambiarRol(p.id, e.target.value as Rol)}
                  aria-label={`Rol de ${p.nombre}`}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROL_LABEL[r]}
                    </option>
                  ))}
                </select>
                <button className="btn-mini" onClick={() => void renombrarPersona(p.id, p.nombre)}>
                  <Icono nombre="editar" size={16} />
                </button>
              </li>
            ))}
          </ul>
          <p className="muted">
            Los marineros y capitanes se crean como usuarios de Supabase y luego se asignan a un
            barco aquí abajo.
          </p>
        </section>

        {/* Tripulación */}
        <section className="hoja admin-section">
          <div className="hoja-titulo">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Icono nombre="bitacora" size={18} />
              Tripulación — asignación a barcos
            </span>
          </div>
          <div className="admin-form" style={{ marginBottom: 12 }}>
            <select value={asignarPerfil} onChange={(e) => setAsignarPerfil(e.target.value)}>
              <option value="">Tripulante…</option>
              {perfiles
                .filter((p) => p.rol === 'capitan' || p.rol === 'marinero')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({ROL_LABEL[p.rol]})
                  </option>
                ))}
            </select>
            <select value={asignarBarco} onChange={(e) => setAsignarBarco(e.target.value)}>
              <option value="">Barco…</option>
              {barcos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
            <select
              value={asignarComo}
              onChange={(e) => setAsignarComo(e.target.value as 'capitan' | 'marinero')}
              aria-label="Rol a bordo"
            >
              <option value="marinero">Como marinero</option>
              <option value="capitan">Como capitán</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={asignarPrincipal}
                onChange={(e) => setAsignarPrincipal(e.target.checked)}
              />
              Barco principal
            </label>
            <button className="btn-mini" onClick={() => void asignar()}>
              Asignar
            </button>
          </div>
          <ul className="admin-list">
            {barcos.map((b) => {
              const trip = asignaciones
                .filter((a) => a.barco_id === b.id)
                .map((a) => ({
                  asignacion: a,
                  perfil: perfiles.find((p) => p.id === a.perfil_id),
                }))
                .filter((t) => t.perfil)
                .sort((a, b2) => Number(b2.asignacion.es_capitan) - Number(a.asignacion.es_capitan));
              return (
                <li key={b.id}>
                  <div>
                    <b>{b.nombre}</b>
                    <div className="muted" style={{ marginTop: 2 }}>
                      {trip.length === 0
                        ? 'sin tripulación asignada'
                        : trip
                            .map(
                              (t) =>
                                `${t.perfil!.nombre}${t.asignacion.es_capitan ? ' (capitán)' : ''}${
                                  t.asignacion.es_principal ? ' (principal)' : ''
                                }`,
                            )
                            .join(', ')}
                    </div>
                  </div>
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {trip.map((t) => (
                      <button
                        key={t.asignacion.id}
                        className="btn-mini danger"
                        onClick={() => void desasignar(t.perfil!.id, b.id)}
                      >
                        Quitar {t.perfil!.nombre}
                      </button>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
