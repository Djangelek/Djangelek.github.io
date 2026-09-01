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

  const claseTab = ({ isActive }: { isActive: boolean }) =>
    `tab-btn${isActive ? ' active' : ''}`;

  return (
    <header className="site-header">
      <div className="brand">
        <img src="logo.jpg" alt="Colombia Navega" />
        <div>
          <div className="brand-name">Colombia Navega</div>
          <div className="brand-tag">Manifiesto de flota</div>
        </div>
      </div>

      <nav className="nav-tabs" aria-label="Secciones">
        {esTripulacion ? (
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
        )}
      </nav>

      <div className="user-box">
        <div className="user-info">
          <span className="user-name">{session.profile.nombre}</span>
          <span className={`badge-rol ${rol}`}>{ROL_LABEL[rol]}</span>
        </div>
        <div className="user-actions">
          <button
            className="btn-icon"
            title={tema === 'papel' ? 'Cambiar a tema tinta (noche)' : 'Cambiar a tema papel (día)'}
            aria-label={tema === 'papel' ? 'Cambiar a tema tinta (noche)' : 'Cambiar a tema papel (día)'}
            onClick={() => setTema(tema === 'papel' ? 'tinta' : 'papel')}
          >
            <Icono nombre={tema === 'papel' ? 'luna' : 'sol'} size={18} />
          </button>
          <button className="btn-salir" onClick={() => void logout()}>
            <Icono nombre="salida" size={16} />
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
