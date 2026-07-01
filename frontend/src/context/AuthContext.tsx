import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { clearStoredFarm } from './FarmContext';
import { mfaService } from '../services/security.service';
import { clearAuthTokens } from '../lib/native';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User | { mfaRequired: true; mfaChallenge: string }>;
  loginWithGoogle: (idToken: string) => Promise<User | { mfaRequired: true; mfaChallenge: string }>;
  completeMfaLogin: (mfaChallenge: string, code: string) => Promise<User>;
  register: (name: string, email: string, password: string, phone: string) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function invalidateAppData(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries();
}

type LoginResponse = { user: User } | { mfaRequired: true; mfaChallenge: string };

function parseLoginResponse(data: LoginResponse): User | { mfaRequired: true; mfaChallenge: string } {
  if ('mfaRequired' in data && data.mfaRequired) {
    return { mfaRequired: true, mfaChallenge: data.mfaChallenge };
  }
  return (data as { user: User }).user;
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
    const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
    const result = parseLoginResponse(data);
    if ('mfaRequired' in result) return result;
    setUser(result);
    invalidateAppData(qc);
    return result;
  };

  const loginWithGoogle = async (idToken: string) => {
    const { data } = await api.post<LoginResponse>('/auth/google', { idToken });
    const result = parseLoginResponse(data);
    if ('mfaRequired' in result) return result;
    setUser(result);
    invalidateAppData(qc);
    return result;
  };

  const completeMfaLogin = async (mfaChallenge: string, code: string) => {
    const { user: u } = await mfaService.verifyLogin(mfaChallenge, code);
    setUser(u);
    invalidateAppData(qc);
    return u;
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
    await clearAuthTokens();
    clearStoredFarm();
    setUser(null);
    qc.removeQueries();
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    invalidateAppData(qc);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, loginWithGoogle, completeMfaLogin, register, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
