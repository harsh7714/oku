import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';
import { useToast } from './ToastContext';
import { unsubscribeFromPush } from '../utils/push';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  // Load user on startup
  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        setUser(data);
      } catch (err) {
        console.error('Error fetching auth user:', err);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const login = async (emailOrUsername, password) => {
    try {
      const { data } = await api.post('/auth/login', { emailOrUsername, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data));
      setUser(data);
      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
      const message = err.response?.data?.message || 'Login failed, check credentials';
      toast.error(message);
      return { success: false, message };
    }
  };

  const register = async (username, email, password) => {
    try {
      const { data } = await api.post('/auth/register', { username, email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data));
      setUser(data);
      return { success: true };
    } catch (err) {
      console.error('Registration error:', err);
      const message = err.response?.data?.message || 'Registration failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const logout = async () => {
    // Best-effort: drop this device's push subscription (both locally and
    // on the server) before clearing the token, so a shared/public device
    // doesn't keep receiving this account's push notifications after
    // someone logs out of it.
    try {
      await unsubscribeFromPush();
    } catch (err) {
      console.warn('Push unsubscribe on logout skipped:', err.message);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateProfile = async (formData) => {
    try {
      // Need multipart header for file uploads
      const { data } = await api.put('/users/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Update local storage
      const token = localStorage.getItem('token');
      const updatedUserObj = { ...data, token };
      localStorage.setItem('user', JSON.stringify(updatedUserObj));
      setUser(data);
      return { success: true };
    } catch (err) {
      console.error('Profile update error:', err);
      const message = err.response?.data?.message || 'Failed to update profile';
      toast.error(message);
      return { success: false, message };
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
