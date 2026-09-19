import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem('taskforge_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.get('/auth/me');
      setUser(data.user);
      setPermissions(data.permissions);
    } catch (err) {
      localStorage.removeItem('taskforge_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  async function login(email, password) {
    const data = await api.post('/auth/login', { email, password });
    localStorage.setItem('taskforge_token', data.token);
    setUser(data.user);
    // /auth/me returns the permission list; fetch it right after login
    const me = await api.get('/auth/me');
    setPermissions(me.permissions);
  }

  function logout() {
    localStorage.removeItem('taskforge_token');
    setUser(null);
    setPermissions([]);
  }

  // Client-side convenience only - purely cosmetic (show/hide buttons).
  // The server re-checks every one of these independently and is the
  // only thing that actually enforces them.
  function can(action) {
    return permissions.includes(action);
  }

  return (
    <AuthContext.Provider value={{ user, permissions, can, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
