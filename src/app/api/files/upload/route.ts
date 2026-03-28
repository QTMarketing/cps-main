import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MSG = 'File storage via Supabase removed. AWS replacement pending.';

export async function POST() {
  return NextResponse.json({ error: MSG }, { status: 501 });
}

export async function GET() {
  return NextResponse.json({ error: MSG }, { status: 501 });
}
