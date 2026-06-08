import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signJwt } from "@/lib/auth";
import { Role } from "@/lib/roles";
import { verifyHubSsoToken } from "@/lib/hub-sso";

export const runtime = "nodejs";

const SSO_AUDIENCE = "cps";
const DEFAULT_REDIRECT = "/write-checks";

function mapHubRoleToCps(hubRole: "ADMIN" | "STAFF", email: string): Role {
  const superAdminUsername =
    process.env.SUPER_ADMIN_USERNAME?.toLowerCase().trim() ||
    "admin@quicktrackinc.com";

  if (email.toLowerCase() === superAdminUsername) {
    return Role.SUPER_ADMIN;
  }

  if (hubRole === "ADMIN") {
    return Role.OFFICE_ADMIN;
  }

  return Role.USER;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const secret = process.env.SSO_SHARED_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "SSO is not configured" }, { status: 500 });
  }

  let payload;
  try {
    payload = verifyHubSsoToken(token, secret, SSO_AUDIENCE);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid token";
    return NextResponse.json({ error: "Unauthorized", details: message }, { status: 401 });
  }

  const username = payload.email.trim().toLowerCase();
  const cpsRole = mapHubRoleToCps(payload.role, username);

  let user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      role: true,
    },
  });

  if (!user) {
    const passwordHash = await bcrypt.hash(
      `sso-provisioned-${payload.sub}`,
      12
    );
    user = await prisma.user.create({
      data: {
        username,
        password_hash: passwordHash,
        role: cpsRole,
      },
      select: {
        id: true,
        username: true,
        role: true,
      },
    });
  } else if (user.role !== cpsRole && cpsRole === Role.SUPER_ADMIN) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { role: cpsRole },
      select: {
        id: true,
        username: true,
        role: true,
      },
    });
  }

  const sessionToken = signJwt({
    userId: user.id,
    username: user.username,
    role: (user.role as Role) ?? cpsRole,
  });

  const redirectPath =
    req.nextUrl.searchParams.get("redirect")?.trim() || DEFAULT_REDIRECT;
  const response = NextResponse.redirect(new URL(redirectPath, req.url));

  response.cookies.set({
    name: "auth-token",
    value: sessionToken,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 86400,
    path: "/",
  });

  return response;
}
