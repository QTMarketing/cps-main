import { NextResponse } from 'next/server';

/**
 * @deprecated Use PUT /api/users/[id]/banks instead.
 * Returns 410 Gone.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Gone: This endpoint is deprecated. Use PUT /api/users/[id]/banks instead.' },
    { status: 410 }
  );
}
