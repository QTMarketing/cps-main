import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json(
    { error: 'Store photo upload via Supabase has been removed. AWS replacement pending.' },
    { status: 501 }
  );
}
