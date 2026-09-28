import { createContext, useContext, useState, useEffect } from 'react';
import { AuthAPI } from '../api/auth.api';
import { fetchCsrfToken } from '../lib/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Eagerly fetch CSRF token on initial application load
        await fetchCsrfToken();
        const response = await AuthAPI.status();
        if (response.success && response.payload) {
          setUser(response.payload);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    // Refresh CSRF token upon session state change
    fetchCsrfToken();
  };

  const logout = async () => {
    try {
      await AuthAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      fetchCsrfToken();
    }
  };

  const logoutAll = async () => {
    try {
      await AuthAPI.logoutAll();
    } catch (error) {
      console.error('Logout All error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      fetchCsrfToken();
    }
  };

  const updateUser = (updatedData) => {
    setUser((prev) => (prev ? { ...prev, ...updatedData } : updatedData));
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout, logoutAll, updateUser }}>
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
