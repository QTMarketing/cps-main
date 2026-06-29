import { NextRequest, NextResponse } from "next/server";
import {
  readAssistantBody,
  verifyInternalAssistantRequest,
} from "@/lib/internal-assistant-auth";
import {
  getChequeTotalsSummary,
  type ChequeTotalsScope,
} from "@/lib/assistant-queries";

export const runtime = "nodejs";

function parseScope(value: unknown): ChequeTotalsScope {
  return value === "pending" ? "pending" : "all";
}

export async function POST(req: NextRequest) {
  const authError = verifyInternalAssistantRequest(req);
  if (authError) return authError;

  const body = await readAssistantBody(req);
  const scope = parseScope(body.scope);

  const data = await getChequeTotalsSummary(body.hubUserEmail, scope);

  return NextResponse.json(data);
}
