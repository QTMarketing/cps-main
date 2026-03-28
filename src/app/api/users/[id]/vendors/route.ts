import { NextRequest, NextResponse } from 'next/server';

const GONE_MESSAGE = 'Gone: This endpoint is deprecated. Use /api/banks/[id]/vendors instead.';

export async function GET(
  _req: NextRequest,
  _context: { params: Promise<{ id: string }> }
) {
  return NextResponse.json({ error: GONE_MESSAGE }, { status: 410 });
}

export async function PUT(
  _req: NextRequest,
  _context: { params: Promise<{ id: string }> }
) {
  return NextResponse.json({ error: GONE_MESSAGE }, { status: 410 });
}
