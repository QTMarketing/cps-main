import jwt, { SignOptions } from "jsonwebtoken";
import { prisma } from "./prisma";
import { Role } from "./roles";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    "FATAL: JWT_SECRET environment variable is not set. " +
    "The application cannot start without a secure secret. " +
    "Set JWT_SECRET in your .env or .env.local file."
  );
}
const DEFAULT_EXPIRES_IN = "24h";

export interface JwtPayload {
  userId: number;
  username: string;
  role: Role;
  storeId: number | null;
  iat?: number;
  exp?: number;
}

export interface SignJwtInput {
  userId: number;
  username: string;
  role: Role;
}

export function signJwt(
  payload: SignJwtInput,
  options: SignOptions = {}
): string {
  const finalOptions: SignOptions = {
    expiresIn: DEFAULT_EXPIRES_IN,
    ...options,
  };

  return jwt.sign(payload, JWT_SECRET!, finalOptions);
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as JwtPayload;

    if (!decoded?.userId || !decoded?.username) {
      throw new Error("Invalid token payload");
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        username: true,
        role: true,
        store_id: true,
        token_revoked_at: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Check if token has been revoked (e.g. after logout or password change)
    if (user.token_revoked_at && decoded.iat !== undefined) {
      const revokedAtSeconds = Math.floor(user.token_revoked_at.getTime() / 1000);
      if (decoded.iat <= revokedAtSeconds) {
        throw new Error("Token has been revoked");
      }
    }

    return {
      userId: decoded.userId,
      username: user.username || decoded.username,
      role: user.role ?? decoded.role ?? Role.USER,
      storeId: user.store_id ?? null,
      iat: decoded.iat,
      exp: decoded.exp,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Invalid authentication token"
    );
  }
}

export async function revokeUserTokens(userId: number): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { token_revoked_at: new Date() },
  });
}

