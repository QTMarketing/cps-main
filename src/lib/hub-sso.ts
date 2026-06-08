import { createHmac, timingSafeEqual } from "crypto";

export interface HubSsoPayload {
  iss: "quicktrack-hub";
  aud: string;
  sub: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "STAFF";
  iat: number;
  exp: number;
}

function base64UrlDecode(value: string): Buffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

export function verifyHubSsoToken(
  token: string,
  secret: string,
  expectedAudience: string
): HubSsoPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSig = createHmac("sha256", secret)
    .update(signingInput)
    .digest();
  const actualSig = base64UrlDecode(encodedSignature);

  if (
    expectedSig.length !== actualSig.length ||
    !timingSafeEqual(expectedSig, actualSig)
  ) {
    throw new Error("Invalid token signature");
  }

  const payload = JSON.parse(
    base64UrlDecode(encodedPayload).toString("utf8")
  ) as HubSsoPayload;

  if (payload.iss !== "quicktrack-hub") {
    throw new Error("Invalid token issuer");
  }

  if (payload.aud !== expectedAudience) {
    throw new Error("Invalid token audience");
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) {
    throw new Error("Token expired");
  }

  if (!payload.email) {
    throw new Error("Invalid token payload");
  }

  return payload;
}
