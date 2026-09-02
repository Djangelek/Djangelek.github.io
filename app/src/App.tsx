import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Header from './components/layout/Header';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Toasts from './components/layout/Toasts';
import Login from './components/auth/Login';
import BitacoraForm from './components/report/BitacoraForm';
import ReportForm from './components/report/ReportForm';
import MantenimientoForm from './components/report/MantenimientoForm';
import Dashboard from './components/dashboard/Dashboard';
import BoatDetail from './components/boat/BoatDetail';
import History from './components/history/History';
import Admin from './components/admin/Admin';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function Inicio() {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  const rol = session.profile.rol;
  // Capitanes: primero la Check Bitácora. Marineros: a reportar.
  // Operación y ventas: al mapa de supervisión.
  if (rol === 'capitan') return <Navigate to="/bitacora" replace />;
  if (rol === 'marinero') return <Navigate to="/reportar" replace />;
  return <Navigate to="/mapa" replace />;
}

function Shell() {
  return (
    <div className="app">
      <Header />
      <main className="main">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Inicio />} />
          <Route
            path="/bitacora"
            element={
              <ProtectedRoute rol={['capitan', 'operacion']}>
                <BitacoraForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reportar"
            element={
              <ProtectedRoute rol={['capitan', 'marinero']}>
                <ReportForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mantenimiento"
            element={
              <ProtectedRoute rol={['capitan', 'marinero']}>
                <MantenimientoForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mapa"
            element={
              <ProtectedRoute rol={['operacion', 'ventas']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/barco/:id"
            element={
              <ProtectedRoute rol={['operacion', 'ventas']}>
                <BoatDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/historial"
            element={
              <ProtectedRoute rol={['operacion', 'ventas']}>
                <History />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute rol="operacion">
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="site-footer">Colombia Navega © {new Date().getFullYear()}</footer>
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <HashRouter>
          <Shell />
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
