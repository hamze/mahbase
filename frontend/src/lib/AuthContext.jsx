'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getRefreshToken, onSessionEnded, refreshSession } from '@/api/client';
import { getMe, logout as apiLogout, verifyLoginCode } from '@/api/auth';

const AuthContext = createContext(null);

/**
 * Customer session. Tokens live in the central API client; on start a stored refresh token is exchanged so the
 * customer stays signed in (the backend keeps a used session alive for 90 days).
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      setUser(await getMe());
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const restore = getRefreshToken() ? refreshSession().then((ok) => ok && loadUser()) : Promise.resolve();
    restore.finally(() => setIsLoadingAuth(false));
    return onSessionEnded(() => setUser(null));
  }, [loadUser]);

  const login = useCallback(
    async (mobile, code) => {
      await verifyLoginCode(mobile, code);
      await loadUser();
    },
    [loadUser],
  );

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: Boolean(user), isLoadingAuth, login, logout, reloadUser: loadUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

/** Price tier of the signed-in customer (``RETAIL`` for guests): part of the catalog query keys. */
export function usePriceTier() {
  return useAuth().user?.customer_tier === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
}
