/**
 * Re-Authentication Middleware
 * 
 * This middleware checks if a user has recently re-authenticated for
 * sensitive operations. It validates re-auth tokens and ensures they
 * haven't expired (5-minute window).
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

// =============================================================================
// TYPES
// =============================================================================

interface ReAuthTokenPayload {
  userId: string;
  username: string;
  role: string;
  reAuth: boolean;
  timestamp: number;
}

// =============================================================================
// MIDDLEWARE FUNCTION
// =============================================================================

export function requireReAuth() {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    try {
      // Extract JWT token from Authorization header
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { 
            error: 'Authentication required',
            message: 'Please provide a valid JWT token'
          },
          { status: 401 }
        );
      }

      const token = authHeader.substring(7);
      
      // Verify JWT token
      let decodedToken: any;
      try {
        decodedToken = jwt.verify(token, process.env.JWT_SECRET!) as ReAuthTokenPayload;
      } catch (error) {
        return NextResponse.json(
          { 
            error: 'Invalid or expired token',
            message: 'Please log in again'
          },
          { status: 401 }
        );
      }

      // Check if this is a re-auth token
      if (!decodedToken.reAuth) {
        return NextResponse.json(
          { 
            error: 'Re-authentication required',
            message: 'This operation requires password confirmation',
            reAuthRequired: true
          },
          { status: 403 }
        );
      }

      // Check if re-auth token is still valid (5 minutes)
      const now = Date.now();
      const tokenTimestamp = decodedToken.timestamp || 0;
      const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds

      if (now - tokenTimestamp > fiveMinutes) {
        return NextResponse.json(
          { 
            error: 'Re-authentication expired',
            message: 'Please re-authenticate to continue',
            reAuthRequired: true
          },
          { status: 403 }
        );
      }

      // Re-auth token is valid
      return null;

    } catch (error) {
      console.error('Re-auth middleware error:', error);
      return NextResponse.json(
        { 
          error: 'Authentication error',
          message: 'Failed to verify authentication'
        },
        { status: 500 }
      );
    }
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a user has valid re-authentication
 */
export function hasValidReAuth(token: string): boolean {
  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET!) as ReAuthTokenPayload;
    
    if (!decodedToken.reAuth) {
      return false;
    }

    const now = Date.now();
    const tokenTimestamp = decodedToken.timestamp || 0;
    const fiveMinutes = 5 * 60 * 1000;

    return (now - tokenTimestamp) <= fiveMinutes;
  } catch (error) {
    return false;
  }
}

/**
 * Get remaining time for re-auth token
 */
export function getReAuthTimeRemaining(token: string): number {
  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET!) as ReAuthTokenPayload;
    
    if (!decodedToken.reAuth) {
      return 0;
    }

    const now = Date.now();
    const tokenTimestamp = decodedToken.timestamp || 0;
    const fiveMinutes = 5 * 60 * 1000;
    const elapsed = now - tokenTimestamp;
    const remaining = fiveMinutes - elapsed;

    return Math.max(0, remaining);
  } catch (error) {
    return 0;
  }
}

/**
 * Check if an operation requires re-authentication based on amount
 */
export function requiresReAuthForAmount(amount: number): boolean {
  return amount >= 10000; // $10,000 threshold
}

/**
 * Check if an operation requires re-authentication based on action type
 */
export function requiresReAuthForAction(action: string): boolean {
  const sensitiveActions = [
    'VOID_CHECK',
    'CANCEL_CHECK',
    'CHANGE_BANK_INFO',
    'ADD_USER',
    'REMOVE_USER',
    'CHANGE_USER_ROLE',
    'RESET_PASSWORD',
    'DELETE_BANK',
    'UPDATE_BANK_BALANCE',
  ];

  return sensitiveActions.includes(action.toUpperCase());
}





