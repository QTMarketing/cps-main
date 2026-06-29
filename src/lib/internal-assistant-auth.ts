import { NextRequest, NextResponse } from "next/server";

export function verifyInternalAssistantRequest(
  req: NextRequest,
): NextResponse | null {
  const key = req.headers.get("x-internal-api-key")?.trim();
  const expected = process.env.INTERNAL_ASSISTANT_API_KEY?.trim();

  if (!expected) {
    return NextResponse.json(
      { error: "INTERNAL_ASSISTANT_API_KEY is not configured" },
      { status: 503 },
    );
  }

  if (!key || key !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (req.headers.get("x-request-source") !== "quicktrack-hub") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

export interface AssistantRequestBody {
  hubUserEmail?: string | null;
  hubUserRole?: string | null;
  limit?: number;
  scope?: string;
}

export async function readAssistantBody(
  req: NextRequest,
): Promise<AssistantRequestBody> {
  try {
    return (await req.json()) as AssistantRequestBody;
  } catch {
    return {};
  }
}
