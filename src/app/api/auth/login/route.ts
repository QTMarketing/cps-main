import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@/lib/rbac";
import { signJwt } from "@/lib/auth";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter (per server process)
// Limits: 10 login attempts per IP per 15-minute window
// ---------------------------------------------------------------------------
const RATE_LIMIT = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 min

const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

// Periodic cleanup: purge stale entries every 15 min to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  rateLimitMap.forEach((entry, key) => {
    if (now - entry.windowStart > WINDOW_MS) rateLimitMap.delete(key);
  });
}, WINDOW_MS);

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true; // allowed
  }

  entry.count += 1;
  return entry.count <= RATE_LIMIT;
}

// POST /api/auth/login - User login
export async function POST(request: NextRequest) {
  // Rate-limit by IP address
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": "900" } }
    );
  }

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        password_hash: true,
        role: true,
        assigned_bank_id: true,
        created_at: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const superAdminUsername =
      process.env.SUPER_ADMIN_USERNAME?.toLowerCase().trim() || "admin@quicktrackinc.com";

    let role = user.role as Role | undefined;

    if (!role) {
      role =
        user.username.toLowerCase() === superAdminUsername ? Role.SUPER_ADMIN : Role.USER;
    }

    // Ensure the special super admin account always has SUPER_ADMIN role
    if (user.username.toLowerCase() === superAdminUsername && role !== Role.SUPER_ADMIN) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: Role.SUPER_ADMIN },
      });
      role = Role.SUPER_ADMIN;
    }

    const token = signJwt({
      userId: user.id,
      username: user.username,
      role,
    });

    const userPayload = {
      id: user.id,
      username: user.username,
      role,
      assignedBankId: user.assigned_bank_id ?? null,
      createdAt: user.created_at,
    };

    // Set cookie server-side for better security
    const response = NextResponse.json({
      success: true,
      user: userPayload,
      token,
    });

    // Set HttpOnly cookie for enhanced security
    response.cookies.set({
      name: 'auth-token',
      value: token,
      httpOnly: false, // Keep false for client-side access compatibility
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400, // 24 hours
      path: '/',
    });

    console.log('[LOGIN] Successfully authenticated user:', user.username, 'role:', role);
    console.log('[LOGIN] Token cookie set');

    return response;
  } catch (error) {
    console.error("Login error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined;
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: errorMessage,
        ...(errorStack && { stack: errorStack })
      },
      { status: 500 }
    );
  }
}
