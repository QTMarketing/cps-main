"use client";

import { useState, useCallback, useRef, useEffect } from 'react';

// =============================================================================
// TYPES
// =============================================================================

interface ReAuthState {
  isRequired: boolean;
  isLoading: boolean;
  error: string | null;
  timeRemaining: number;
}

interface ReAuthOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  sensitiveAction?: string;
}

// =============================================================================
// HOOK
// =============================================================================

export function useReAuth(options: ReAuthOptions = {}) {
  const [state, setState] = useState<ReAuthState>({
    isRequired: false,
    isLoading: false,
    error: null,
    timeRemaining: 0,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const reAuthTokenRef = useRef<string | null>(null);

  // =============================================================================
  // UTILITY FUNCTIONS
  // =============================================================================

  const getAuthToken = useCallback(() => {
    // Get JWT token from localStorage or cookies
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authToken') || 
             document.cookie
               .split('; ')
               .find(row => row.startsWith('authToken='))
               ?.split('=')[1];
    }
    return null;
  }, []);

  const setReAuthToken = useCallback((token: string) => {
    reAuthTokenRef.current = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('reAuthToken', token);
    }
  }, []);

  const getReAuthToken = useCallback(() => {
    if (reAuthTokenRef.current) {
      return reAuthTokenRef.current;
    }
    
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('reAuthToken');
      if (token) {
        reAuthTokenRef.current = token;
        return token;
      }
    }
    
    return null;
  }, []);

  const clearReAuthToken = useCallback(() => {
    reAuthTokenRef.current = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('reAuthToken');
    }
  }, []);

  // =============================================================================
  // API FUNCTIONS
  // =============================================================================

  const verifyPassword = useCallback(async (password: string): Promise<boolean> => {
    try {
      const authToken = getAuthToken();
      if (!authToken) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ password }),
      });

      const result = await response.json();

      if (response.ok) {
        // Store the re-auth token
        setReAuthToken(result.reAuthToken);
        
        // Start countdown timer
        startCountdown(result.expiresIn);
        
        setState(prev => ({
          ...prev,
          isRequired: false,
          isLoading: false,
          error: null,
        }));

        options.onSuccess?.();
        return true;
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: result.error || 'Password verification failed',
        }));

        options.onError?.(result.error || 'Password verification failed');
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      options.onError?.(errorMessage);
      return false;
    }
  }, [getAuthToken, setReAuthToken, options]);

  const checkReAuthStatus = useCallback(async (): Promise<boolean> => {
    try {
      const authToken = getAuthToken();
      if (!authToken) {
        return false;
      }

      const response = await fetch('/api/auth/verify-password', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      const result = await response.json();

      if (response.ok) {
        const isRequired = result.reAuthRequired;
        
        setState(prev => ({
          ...prev,
          isRequired,
          error: null,
        }));

        if (!isRequired && result.expiresAt) {
          // Calculate remaining time
          const expiresAt = new Date(result.expiresAt).getTime();
          const remaining = Math.max(0, expiresAt - Date.now());
          setState(prev => ({
            ...prev,
            timeRemaining: Math.floor(remaining / 1000),
          }));
          
          if (remaining > 0) {
            startCountdown(Math.floor(remaining / 1000));
          }
        }

        return !isRequired;
      } else {
        setState(prev => ({
          ...prev,
          isRequired: true,
        }));
        return false;
      }
    } catch (error) {
      console.error('Error checking re-auth status:', error);
      setState(prev => ({
        ...prev,
        isRequired: true,
        error: 'Failed to check re-auth status',
      }));
      return false;
    }
  }, [getAuthToken]);

  // =============================================================================
  // TIMER FUNCTIONS
  // =============================================================================

  const startCountdown = useCallback((seconds: number) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setState(prev => ({
      ...prev,
      timeRemaining: seconds,
    }));

    intervalRef.current = setInterval(() => {
      setState(prev => {
        const newTimeRemaining = prev.timeRemaining - 1;
        
        if (newTimeRemaining <= 0) {
          // Re-auth expired
          clearReAuthToken();
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          
          return {
            ...prev,
            timeRemaining: 0,
            isRequired: true,
          };
        }
        
        return {
          ...prev,
          timeRemaining: newTimeRemaining,
        };
      });
    }, 1000);
  }, [clearReAuthToken]);

  const stopCountdown = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // =============================================================================
  // PUBLIC FUNCTIONS
  // =============================================================================

  const requireReAuth = useCallback((sensitiveAction?: string) => {
    setState(prev => ({
      ...prev,
      isRequired: true,
      error: null,
    }));
  }, []);

  const clearReAuth = useCallback(() => {
    clearReAuthToken();
    stopCountdown();
    setState({
      isRequired: false,
      isLoading: false,
      error: null,
      timeRemaining: 0,
    });
  }, [clearReAuthToken, stopCountdown]);

  const formatTimeRemaining = useCallback((seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  // =============================================================================
  // EFFECTS
  // =============================================================================

  useEffect(() => {
    // Check re-auth status on mount
    checkReAuthStatus();

    // Cleanup on unmount
    return () => {
      stopCountdown();
    };
  }, [checkReAuthStatus, stopCountdown]);

  // =============================================================================
  // RETURN
  // =============================================================================

  return {
    // State
    isRequired: state.isRequired,
    isLoading: state.isLoading,
    error: state.error,
    timeRemaining: state.timeRemaining,
    
    // Actions
    verifyPassword,
    requireReAuth,
    clearReAuth,
    checkReAuthStatus,
    
    // Utilities
    formatTimeRemaining,
    
    // Computed
    hasValidReAuth: !state.isRequired && state.timeRemaining > 0,
    timeRemainingFormatted: formatTimeRemaining(state.timeRemaining),
  };
}





