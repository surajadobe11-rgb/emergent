import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '@/services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCompanyId, setActiveCompanyIdState] = useState(null);
  const [activeCompanyName, setActiveCompanyName] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    const savedCompanyId = localStorage.getItem('activeCompanyId');
    const savedCompanyName = localStorage.getItem('activeCompanyName');
    if (token && savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setUser(u);
        if (savedCompanyId) {
          setActiveCompanyIdState(savedCompanyId);
          setActiveCompanyName(savedCompanyName || '');
        } else {
          setActiveCompanyIdState(u.company_id || '');
        }
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const setActiveCompanyId = useCallback((id, name = '') => {
    setActiveCompanyIdState(id);
    setActiveCompanyName(name);
    localStorage.setItem('activeCompanyId', id);
    localStorage.setItem('activeCompanyName', name);
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { access_token, user: userData } = res.data;
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(userData));
    // Initialize active company to user's own company
    localStorage.setItem('activeCompanyId', userData.company_id || '');
    localStorage.setItem('activeCompanyName', '');
    setUser(userData);
    setActiveCompanyIdState(userData.company_id || '');
    setActiveCompanyName('');
    return userData;
  };

  const register = async (email, password, name, company_name) => {
    const res = await api.post('/auth/register', { email, password, name, company_name });
    const { access_token, user: userData } = res.data;
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('activeCompanyId', userData.company_id || '');
    localStorage.setItem('activeCompanyName', company_name || '');
    setUser(userData);
    setActiveCompanyIdState(userData.company_id || '');
    setActiveCompanyName(company_name || '');
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('activeCompanyId');
    localStorage.removeItem('activeCompanyName');
    setUser(null);
    setActiveCompanyIdState(null);
    setActiveCompanyName('');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, activeCompanyId, activeCompanyName, setActiveCompanyId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
