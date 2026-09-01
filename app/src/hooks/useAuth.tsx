import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ds } from '../services';
import type { Session } from '../types';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ds.getSession()
      .then((s) => setSession(s))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string): Promise<string | null> {
    const s = await ds.login(email, password);
    if (!s) return 'Credenciales inválidas';
    setSession(s);
    return null;
  }

  async function logout(): Promise<void> {
    await ds.logout();
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{ session, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
