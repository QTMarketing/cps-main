import { NextRequest, NextResponse } from "next/server";
import {
  readAssistantBody,
  verifyInternalAssistantRequest,
} from "@/lib/internal-assistant-auth";
import { getPendingChecksSummary } from "@/lib/assistant-queries";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const authError = verifyInternalAssistantRequest(req);
  if (authError) return authError;

  const body = await readAssistantBody(req);
  const data = await getPendingChecksSummary(body.hubUserEmail);

  return NextResponse.json(data);
}
