import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useUIStore } from '../../store/uiStore';
import { Icono } from '../ui/Iconos';
import type { Rol } from '../../types';

const ROL_LABEL: Record<Rol, string> = {
  capitan: 'Capitán',
  marinero: 'Marinero',
  operacion: 'Operación',
  ventas: 'Ventas',
};

export default function Header() {
  const { session, logout } = useAuth();
  const tema = useUIStore((s) => s.tema);
  const setTema = useUIStore((s) => s.setTema);

  // El tema vive en <html data-theme> para que CSS lo resuelva en toda la app.
  useEffect(() => {
    document.documentElement.dataset.theme = tema;
  }, [tema]);

  if (!session) return null;

  const rol = session.profile.rol;
  // Tripulación: solo bitácora y reporte. Operación: todo. Ventas: solo lectura.
  const esTripulacion = rol === 'capitan' || rol === 'marinero';
  const esOperacion = rol === 'operacion';
  // Si el nombre es el rol en crudo ("capitan"), solo se muestra la insignia
  // para no repetir "Capitán" dos veces.
  const esNombreRol = session.profile.nombre.toLowerCase() === rol;

  const claseTab = ({ isActive }: { isActive: boolean }) =>
    `tab-btn${isActive ? ' active' : ''}`;

  const tabs = esTripulacion ? (
    <>
      {rol === 'capitan' && (
        <NavLink to="/bitacora" className={claseTab}>
          <Icono nombre="bitacora" size={18} />
          Bitácora
        </NavLink>
      )}
      <NavLink to="/reportar" className={claseTab}>
        <Icono nombre="reportar" size={18} />
        Reportar
      </NavLink>
    </>
  ) : (
    <>
      <NavLink to="/mapa" className={claseTab}>
        <Icono nombre="mapa" size={18} />
        Mapa
      </NavLink>
      <NavLink to="/historial" className={claseTab}>
        <Icono nombre="historial" size={18} />
        Historial
      </NavLink>
      {esOperacion && (
        <NavLink to="/admin" className={claseTab}>
          <Icono nombre="admin" size={18} />
          Admin
        </NavLink>
      )}
    </>
  );

  return (
    <>
      <header className="site-header">
        <div className="brand">
          <img src="logo.jpg" alt="Colombia Navega" />
          <div>
            <div className="brand-name">Colombia Navega</div>
            <div className="brand-tag">Manifiesto de flota</div>
          </div>
        </div>

        <nav className="nav-tabs" aria-label="Secciones">
          {tabs}
        </nav>

        <div className="user-box">
          <div className="user-info">
            {!esNombreRol && <span className="user-name">{session.profile.nombre}</span>}
            <span className={`badge-rol ${rol}`}>{ROL_LABEL[rol]}</span>
          </div>
          <div className="user-actions">
            <button
              className="btn-icon"
              title={tema === 'papel' ? 'Modo noche' : 'Modo día'}
              aria-label={tema === 'papel' ? 'Activar modo noche' : 'Activar modo día'}
              onClick={() => setTema(tema === 'papel' ? 'tinta' : 'papel')}
            >
              <Icono nombre={tema === 'papel' ? 'luna' : 'sol'} size={18} />
            </button>
            <button
              className="btn-icon salir"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              onClick={() => void logout()}
            >
              <Icono nombre="salida" size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Barra inferior estilo app móvil (visible solo en pantallas pequeñas) */}
      <nav className="bottom-nav" aria-label="Secciones principales">
        {tabs}
      </nav>
    </>
  );
}
