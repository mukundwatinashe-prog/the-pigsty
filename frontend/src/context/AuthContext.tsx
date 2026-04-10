import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  loginWithGoogle: (idToken: string) => Promise<User>;
  register: (name: string, email: string, password: string, phone: string) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function invalidateAppData(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    api
      .get('/auth/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    setUser(data.user);
    invalidateAppData(qc);
    return data.user as User;
  };

  const loginWithGoogle = async (idToken: string) => {
    const { data } = await api.post('/auth/google', { idToken });
    setUser(data.user);
    invalidateAppData(qc);
    return data.user as User;
  };

  const register = async (name: string, email: string, password: string, phone: string) => {
    const { data } = await api.post('/auth/register', { name, email, password, phone });
    setUser(data.user);
    invalidateAppData(qc);
    return data.user as User;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Still clear client state if the network fails
    }
    setUser(null);
    qc.removeQueries();
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    invalidateAppData(qc);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Colocated hook + provider — standard React pattern for small apps. */
// eslint-disable-next-line react-refresh/only-export-components -- see above
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
