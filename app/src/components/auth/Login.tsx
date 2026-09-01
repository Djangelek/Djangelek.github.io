import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ds, type DataSource } from '../../services';
import { Icono } from '../ui/Iconos';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function entrar(emailValue: string, passValue: string) {
    setLoading(true);
    setError(null);
    const err = await login(emailValue, passValue);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    navigate('/', { replace: true });
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <img src="logo.jpg" alt="Colombia Navega" className="login-logo" />
        <h2>Colombia Navega</h2>
        <p className="login-sub">Control de flota náutica — Cartagena</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void entrar(email, password);
          }}
        >
          <div className="campo">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="capitan@colombianavega.co"
              required
              autoComplete="email"
            />
          </div>
          <div className="campo">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          {error && <div className="status-error-msg">{error}</div>}
          <div style={{ marginTop: 20 }}>
            <button className="btn-stamp" disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </div>
        </form>

        {ds.mode === 'local' && (
          <div className="demo-box">
            <p>
              <b>Modo demo</b> (sin base de datos) · contraseña:{' '}
              <code>{(ds as DataSource & { PASSWORD_DEMO?: string }).PASSWORD_DEMO ?? 'demo123'}</code>
            </p>
            <div className="demo-buttons">
              <button
                className="btn-demo"
                onClick={() => void entrar('capitan@colombianavega.co', 'demo123')}
              >
                <Icono nombre="ancla" size={16} />
                Capitán
              </button>
              <button
                className="btn-demo"
                onClick={() => void entrar('marinero@colombianavega.co', 'demo123')}
              >
                <Icono nombre="barco" size={16} />
                Marinero
              </button>
              <button
                className="btn-demo"
                onClick={() => void entrar('operacion@colombianavega.co', 'demo123')}
              >
                <Icono nombre="admin" size={16} />
                Operación
              </button>
              <button
                className="btn-demo"
                onClick={() => void entrar('ventas@colombianavega.co', 'demo123')}
              >
                <Icono nombre="historial" size={16} />
                Ventas
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
