/**
 * Password Verification API Endpoint
 * 
 * This endpoint verifies the current user's password for re-authentication
 * purposes. It's used for sensitive operations that require additional
 * security confirmation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { compare } from 'bcryptjs';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

// =============================================================================
// VALIDATION SCHEMA
// =============================================================================

const verifyPasswordSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

// =============================================================================
// POST /api/auth/verify-password - Verify Current User's Password
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    // Parse and validate request body
    const body = await req.json();
    const validatedData = verifyPasswordSchema.parse(body);

    // Extract JWT token from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    
    // Verify JWT token
    let decodedToken: any;
    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decodedToken.userId },
      select: {
        id: true,
        username: true,
        password_hash: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify password
    const isPasswordValid = await compare(validatedData.password, user.password_hash);

    if (!isPasswordValid) {
      // Log failed password verification attempt
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
      console.warn(`Failed password verification attempt for user ${user.username} from IP: ${ip}`);
      
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 400 }
      );
    }

    // Generate re-authentication token (expires in 5 minutes)
    const reAuthToken = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        reAuth: true,
        timestamp: Date.now(),
      },
      process.env.JWT_SECRET!,
      { expiresIn: '5m' }
    );

    // Log successful re-authentication
    console.log(`Successful re-authentication for user ${user.username}`);

    // Return success response with re-auth token
    return NextResponse.json({
      success: true,
      message: 'Password verified successfully',
      reAuthToken,
      expiresIn: 300, // 5 minutes in seconds
    });

  } catch (error) {
    console.error('Error verifying password:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error', 
          details: error.issues 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to verify password' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET /api/auth/verify-password - Check Re-auth Status
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    // Extract JWT token from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    
    // Verify JWT token
    let decodedToken: any;
    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Check if this is a re-auth token
    if (!decodedToken.reAuth) {
      return NextResponse.json(
        { 
          reAuthRequired: true,
          message: 'Re-authentication required for sensitive operations'
        },
        { status: 200 }
      );
    }

    // Check if re-auth token is still valid
    const now = Date.now();
    const tokenTimestamp = decodedToken.timestamp || 0;
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds

    if (now - tokenTimestamp > fiveMinutes) {
      return NextResponse.json(
        { 
          reAuthRequired: true,
          message: 'Re-authentication session expired'
        },
        { status: 200 }
      );
    }

    // Re-auth token is valid
    return NextResponse.json({
      reAuthRequired: false,
      message: 'Re-authentication valid',
      expiresAt: new Date(tokenTimestamp + fiveMinutes).toISOString(),
    });

  } catch (error) {
    console.error('Error checking re-auth status:', error);
    return NextResponse.json(
      { error: 'Failed to check re-auth status' },
      { status: 500 }
    );
  }
}


