import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const isProd = import.meta.env.PROD;
const baseUrl = isProd ? '' : 'http://localhost:5005';
const AUTH_API = `${baseUrl}/api/auth`;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Fetch current user profile on mount / token change
  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const res = await axios.get(`${AUTH_API}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(res.data.data || res.data);
    } catch (err) {
      console.error('Failed to fetch user:', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    const res = await axios.post(`${AUTH_API}/login`, { username, password });
    const { token: newToken, username: uname } = res.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', uname);
    setToken(newToken);
    return res.data;
  };

  const register = async (username, password) => {
    const res = await axios.post(`${AUTH_API}/register`, { username, password });
    const { token: newToken, username: uname } = res.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', uname);
    setToken(newToken);
    return res.data;
  };

  /**
   * Guest join: no account needed — just a share code and optional display name.
   * Returns a short-lived JWT; the user can only see the one shared chat.
   */
  const guestJoin = async (shareCode, displayName) => {
    const res = await axios.post(`${AUTH_API}/guest-join`, { shareCode, displayName });
    const { token: newToken, username: uname } = res.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', uname);
    setToken(newToken);
    return res.data;
  };

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(null);
    setUser(null);
  }, []);

  // Derived guest flags from user profile (set by backend in JWT/getMe)
  const isGuest = user?.isGuest === true || user?.role === 'guest';
  const guestChatId = user?.guestChatId || null;

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token,
    isGuest,
    guestChatId,
    login,
    register,
    guestJoin,
    logout,
    fetchUser,
    setToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
