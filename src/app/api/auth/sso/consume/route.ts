import { NextRequest, NextResponse } from "next/server";
import { signJwt } from "@/lib/auth";
import { verifyHubSsoToken } from "@/lib/hub-sso";
import {
  resolveCpsUserFromHubSso,
  SsoAccountNotFoundError,
} from "@/lib/sso-provision";

export const runtime = "nodejs";

const SSO_AUDIENCE = "cps";
const DEFAULT_REDIRECT = "/write-checks";

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

  let user;
  try {
    user = await resolveCpsUserFromHubSso(payload);
  } catch (error) {
    if (error instanceof SsoAccountNotFoundError) {
      console.warn("[SSO_CONSUME] CPS account not linked:", error.message);
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("sso_error", "account_not_found");
      loginUrl.searchParams.set("sso_message", error.message);
      return NextResponse.redirect(loginUrl);
    }

    const message = error instanceof Error ? error.message : "Provisioning failed";
    console.error("[SSO_CONSUME] CPS user resolution failed:", message);
    return NextResponse.json(
      { error: "Failed to resolve user", details: message },
      { status: 500 }
    );
  }

  const sessionToken = signJwt({
    userId: user.id,
    username: user.username,
    role: user.role,
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
