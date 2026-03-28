import { NextResponse } from 'next/server';

/**
 * @deprecated Use GET /api/users/[id]/banks instead.
 * Returns 410 Gone.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Gone: This endpoint is deprecated. Use GET /api/users/[id]/banks instead.' },
    { status: 410 }
  );
}
