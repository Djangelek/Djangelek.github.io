import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { ReactNode } from 'react';
import type { Rol } from '../../types';

interface Props {
  children: ReactNode;
  rol?: Rol | Rol[];
}

/** Inicio por defecto según el rol. */
export function inicioDe(rol: Rol): string {
  return rol === 'capitan' || rol === 'marinero' ? '/reportar' : '/mapa';
}

/** Bloquea rutas: sin sesión → /login; rol incorrecto → su inicio por defecto. */
export default function ProtectedRoute({ children, rol }: Props) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="center-screen">Cargando…</div>;
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  if (rol) {
    const roles = Array.isArray(rol) ? rol : [rol];
    if (!roles.includes(session.profile.rol)) {
      return <Navigate to={inicioDe(session.profile.rol)} replace />;
    }
  }
  return <>{children}</>;
}
