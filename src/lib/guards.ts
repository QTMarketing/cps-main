import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "./auth";
import { Role } from "./roles";

export type GuardContext = {
  userId: number;
  username: string;
  role: Role;
  storeId: number | null;
};

function extractToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return req.cookies.get("auth-token")?.value ?? null;
}

async function getGuardContext(req: NextRequest): Promise<GuardContext> {
  const token = extractToken(req);
  if (!token) {
    throw { status: 401, message: "Unauthorized", details: "Missing token" };
  }
  try {
    // verifyJwt performs a single DB lookup and returns storeId already resolved
    const decoded = await verifyJwt(token);
    return {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
      storeId: decoded.storeId,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid authentication token";
    throw { status: 401, message: "Unauthorized", details: message };
  }
}

export async function requireAuth(
  req: NextRequest
): Promise<GuardContext> {
  return await getGuardContext(req);
}

export async function requireRole(
  req: NextRequest,
  allowed: Role | Role[]
): Promise<GuardContext> {
  const ctx = await getGuardContext(req);
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  if (!roles.includes(ctx.role)) {
    throw { status: 403, message: "Forbidden" };
  }
  return ctx;
}

export async function requireMinimumRole(
  req: NextRequest,
  minimumRole: Role
): Promise<GuardContext> {
  const hierarchy: Role[] = [Role.USER, Role.ADMIN, Role.SUPER_ADMIN];
  const ctx = await getGuardContext(req);
  if (hierarchy.indexOf(ctx.role) < hierarchy.indexOf(minimumRole)) {
    throw { status: 403, message: "Forbidden" };
  }
  return ctx;
}

export function jsonGuardError(error: any) {
  const status = typeof error?.status === "number" ? error.status : 500;
  const message =
    typeof error?.message === "string"
      ? error.message
      : status === 401
      ? "Unauthorized"
      : "Forbidden";
  const details = error?.details;
  return NextResponse.json(
    details ? { error: message, details } : { error: message },
    { status }
  );
}

