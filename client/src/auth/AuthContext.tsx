import { createContext, useContext, useState, type ReactNode } from 'react';
import type { User } from '../lib/types';
import { api, storedUser, setAuth, clearAuth } from '../lib/api';
import { useToast } from '../ui';

const ROLE_ACCESS: Record<string, string[]> = {
  Administrator: ['dashboard', 'reservations', 'calendar', 'front-desk', 'rooms', 'housekeeping', 'guests', 'billing', 'reports', 'staff'],
  Manager: ['dashboard', 'reservations', 'calendar', 'front-desk', 'rooms', 'housekeeping', 'guests', 'billing', 'reports', 'staff'],
  Receptionist: ['dashboard', 'reservations', 'calendar', 'front-desk', 'rooms', 'guests', 'billing'],
  Housekeeping: ['housekeeping', 'rooms'],
  Accountant: ['dashboard', 'billing', 'reports', 'reservations'],
};

interface AuthCtx {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  can: (page: string) => boolean;
}
const Ctx = createContext<AuthCtx>({ user: null, login: async () => {}, logout: () => {}, can: () => true });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(storedUser());
  const { push } = useToast();

  const login = async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>('/api/auth/login', { email, password });
    setAuth(res.token, res.user);
    setUser(res.user);
    push(`Welcome back, ${res.user.name.split(' ')[0]}`, 'success');
  };
  const logout = () => {
    api.post('/api/auth/logout').catch(() => {});
    clearAuth();
    setUser(null);
  };
  const can = (page: string) => {
    if (!user) return false;
    return (ROLE_ACCESS[user.role] || []).includes(page);
  };
  return <Ctx.Provider value={{ user, login, logout, can }}>{children}</Ctx.Provider>;
}
