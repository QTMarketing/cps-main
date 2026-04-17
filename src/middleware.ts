import { NextRequest, NextResponse } from "next/server";

type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "OFFICE_ADMIN"
  | "BACK_OFFICE"
  | "STORE_USER"
  | "USER";

const PUBLIC_PATHS = [
  "/login",
  "/unauthorized",
  "/",
  "/health",
  "/favicon.ico",
];

const PUBLIC_PREFIXES = ["/_next", "/api/auth", "/api/public", "/public", "/uploads"];

const ROLE_ALLOWLIST: Record<Role, string[]> = {
  USER: ["/write-checks"],
  STORE_USER: ["/write-checks", "/reports"],
  BACK_OFFICE: ["/reports"],
  // NOTE: ADMIN is treated like OFFICE_ADMIN for now (backward compatible).
  ADMIN: [
    "/write-checks",
    "/reports",
    "/add-vendor",
    "/add-vendors",
    "/vendors",
  ],
  OFFICE_ADMIN: [
    "/write-checks",
    "/reports",
    "/add-vendor",
    "/add-vendors",
    "/vendors",
  ],
  SUPER_ADMIN: ["*"],
};

interface SecurityConfig {
  forceHttps: boolean;
  hstsMaxAge: number;
  includeSubDomains: boolean;
  preload: boolean;
}

function getSecurityConfig(): SecurityConfig {
  const isProduction = process.env.NODE_ENV === "production";
  const forceHttps = process.env.FORCE_HTTPS === "true" || isProduction;
  
  return {
    forceHttps,
    hstsMaxAge: parseInt(process.env.HSTS_MAX_AGE || "31536000", 10),
    includeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS !== "false",
    preload: process.env.HSTS_PRELOAD !== "false",
  };
}

function isSecureRequest(request: NextRequest): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedSsl = request.headers.get("x-forwarded-ssl");
  
  return (
    forwardedProto === "https" ||
    forwardedSsl === "on" ||
    request.nextUrl.protocol === "https:"
  );
}

function createHttpsUrl(request: NextRequest): string {
  const host = request.headers.get("host") || "localhost";
  const url = request.nextUrl.clone();
  
  url.protocol = "https:";
  url.host = host;
  
  return url.toString();
}

function addSecurityHeaders(response: NextResponse, config: SecurityConfig): NextResponse {
  if (config.forceHttps) {
    let hstsValue = `max-age=${config.hstsMaxAge}`;
    
    if (config.includeSubDomains) {
      hstsValue += "; includeSubDomains";
    }
    
    if (config.preload) {
      hstsValue += "; preload";
    }
    
    response.headers.set("Strict-Transport-Security", hstsValue);
  }
  
  const csp = [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "connect-src 'self' https:",
    "frame-src 'none'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
  
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.delete("X-Powered-By");
  
  const permissionsPolicy = [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "interest-cohort=()",
  ].join(", ");
  
  response.headers.set("Permissions-Policy", permissionsPolicy);
  
  return response;
}

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return request.cookies.get("auth-token")?.value ?? null;
}

function decodeRole(token: string | null): Role | null {
  if (!token) return null;
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    // JWT payload is base64url encoded, not plain base64.
    // Convert to base64 (+/) and restore padding before decoding.
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const decoded =
      typeof atob !== "undefined"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");
    const json = JSON.parse(decoded);
    if (
      json?.role === "SUPER_ADMIN" ||
      json?.role === "ADMIN" ||
      json?.role === "OFFICE_ADMIN" ||
      json?.role === "BACK_OFFICE" ||
      json?.role === "STORE_USER" ||
      json?.role === "USER"
    ) {
      return json.role;
    }
    return null;
  } catch {
    return null;
  }
}

function hasAccess(role: Role, pathname: string): boolean {
  if (role === "SUPER_ADMIN") return true;
  const allowlist = ROLE_ALLOWLIST[role] || [];
  return allowlist.some(
    (allowed) =>
      pathname === allowed || pathname.startsWith(`${allowed}/`)
  );
}

function respondUnauthorized(request: NextRequest, status: 401 | 403) {
  const isApiRoute = request.nextUrl.pathname.startsWith("/api");
  if (isApiRoute) {
    return NextResponse.json(
      {
        error: status === 401 ? "Unauthorized" : "Forbidden",
        message:
          status === 401
            ? "Authentication required"
            : "Insufficient permissions",
      },
      { status }
    );
  }
  const redirectPath = status === 401 ? "/login" : "/unauthorized";
  return NextResponse.redirect(new URL(redirectPath, request.url));
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith("/api");

  // Debug logging for checks, banks, and reports routes
  if (pathname.includes('/checks/') || pathname.includes('/banks/') || pathname.startsWith('/reports')) {
    const token = getTokenFromRequest(request);
    console.log("[MIDDLEWARE DEBUG]", {
      pathname,
      isPublic: isPublicPath(pathname),
      hasToken: !!token,
      decodedRole: decodeRole(token),
    });
  }

  if (!isPublicPath(pathname)) {
    const token = getTokenFromRequest(request);
    if (!token) {
      return respondUnauthorized(request, 401);
    }

    if (!isApiRoute) {
      const role = decodeRole(token) ?? "USER";
      if (!hasAccess(role, pathname)) {
        return respondUnauthorized(request, 403);
      }
    }
  }

  const config = getSecurityConfig();

  if (!config.forceHttps) {
    return NextResponse.next();
  }

  if (
    request.nextUrl.hostname === "localhost" ||
    request.nextUrl.hostname === "127.0.0.1"
  ) {
    return NextResponse.next();
  }

  if (isSecureRequest(request)) {
    const response = NextResponse.next();
    return addSecurityHeaders(response, config);
  }

  const httpsUrl = createHttpsUrl(request);
  const response = NextResponse.redirect(httpsUrl, 301);
  return addSecurityHeaders(response, config);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};