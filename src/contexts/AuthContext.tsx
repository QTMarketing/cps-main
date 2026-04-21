"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface User {
  id: string;
  username: string;
  role: string;
  email?: string | null;
  storeId?: number | null;
  createdAt?: string;
  /** DB override (cents); null = use org default for store users. */
  maxChequeAmountCents?: number | null;
  /** Effective per-check cap in cents; null = no limit. */
  chequeLimitCents?: number | null;
  store?: {
    id: number;
    code?: string;
    name: string;
    address?: string | null;
    phone?: string | null;
  } | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<{ success: boolean; role?: string }>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check for existing token on mount
  useEffect(() => {
    if (!mounted) return;

    const checkAuth = async () => {
      try {
        const savedToken = document.cookie
          .split('; ')
          .find(row => row.startsWith('auth-token='))
          ?.split('=')[1];

        if (savedToken) {
          setToken(savedToken);
          await fetchUser();
        }
      } catch (error) {
        console.error("Auth check error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [mounted]);

  const fetchUser = async () => {
    try {
      const response = await fetch("/api/auth/session", { credentials: "include" });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        // Token is invalid, remove it
        document.cookie = "auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        setUser(null);
        setToken(null);
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      document.cookie = "auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      setToken(null);
    }
  };

  const login = async (
    username: string,
    password: string
  ): Promise<{ success: boolean; role?: string }> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Ensure cookies are sent/received
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const text = await response.text();
        const data = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
        if (!data?.token) {
          console.error("Login failed: expected JSON token, got:", text);
          return { success: false };
        }
        setToken(data.token);
        
        // Set cookie client-side as backup (server also sets it)
        document.cookie = `auth-token=${data.token}; path=/; max-age=86400; SameSite=Lax`;
        
        console.log('[AUTH] Login successful, fetching user...');
        await fetchUser();
        return { success: true, role: data?.user?.role };
      } else {
        const text = await response.text();
        const errorData = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
        console.error("Login failed:", errorData ?? text);
        return { success: false };
      }
    } catch (error) {
      console.error("Login error:", error);
      return { success: false };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    document.cookie = "auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    
    // Call logout API for cleanup
    fetch("/api/auth/logout", { method: "POST" }).catch(console.error);
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isLoading: isLoading || !mounted,
    isAuthenticated: !!user && !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}