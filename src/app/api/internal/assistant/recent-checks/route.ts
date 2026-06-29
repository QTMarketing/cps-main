import { NextRequest, NextResponse } from "next/server";
import {
  readAssistantBody,
  verifyInternalAssistantRequest,
} from "@/lib/internal-assistant-auth";
import { getRecentChecksSummary } from "@/lib/assistant-queries";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const authError = verifyInternalAssistantRequest(req);
  if (authError) return authError;

  const body = await readAssistantBody(req);
  const limit = Math.min(Math.max(body.limit ?? 5, 1), 10);
  const data = await getRecentChecksSummary(body.hubUserEmail, limit);

  return NextResponse.json(data);
}
