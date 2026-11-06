"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUserStore, UserProfile } from '@/store/user-store';
import { Permission, hasPermission } from '@/auth/permissions';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, profile: UserProfile) => void;
  logout: () => void;
  checkPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, setUser, logout: clearStore } = useUserStore();
  const [isLoading, setIsLoading] = useState(true);

  const logout = async () => {
    localStorage.removeItem('cfo_auth_token');
    clearStore();
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('API logout failed:', err);
    }
    window.location.href = '/login';
  };

  useEffect(() => {
    // Perform initial session verification on mount
    const verifySession = async () => {
      try {
        const token = localStorage.getItem('cfo_auth_token');
        if (!token) {
          clearStore();
          setIsLoading(false);
          return;
        }

        const res = await fetch('/api/auth/me');
        if (res.status === 401) {
          await logout();
          return;
        }

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            setUser({
              id: String(data.user.id),
              name: data.user.email.split('@')[0],
              email: data.user.email,
              role: 'owner',
              permissions: ['*']
            });
          } else {
            await logout();
          }
        }
      } catch (err) {
        console.error('Session verification failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    verifySession();

    // Global fetch interceptor for 401 errors
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        const url = typeof args[0] === 'string'
          ? args[0]
          : (args[0] instanceof URL ? args[0].toString() : (args[0] as Request).url);
        
        // Don't intercept authentication and admin routes to avoid redirection loops
        if (
          !url.includes('/api/auth/login') &&
          !url.includes('/api/auth/register') &&
          !url.includes('/api/auth/logout') &&
          !url.includes('/api/auth/me') &&
          !url.includes('/api/admin') &&
          !url.includes('/admin')
        ) {
          await logout();
        }
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [clearStore]);

  const login = (token: string, profile: UserProfile) => {
    localStorage.setItem('cfo_auth_token', token);
    setUser(profile);
  };

  const checkPermission = (permission: Permission): boolean => {
    if (!user) return false;
    return hasPermission(user.role, permission);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
        checkPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
