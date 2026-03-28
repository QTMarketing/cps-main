import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export const runtime = 'nodejs';

const START_NUMBER = 1000;

async function computeGlobalNextNumber(): Promise<number> {
  const maxCheck = await prisma.check.findFirst({
    orderBy: { check_number: 'desc' },
    select: { check_number: true },
  });

  return maxCheck ? Number(maxCheck.check_number) + 1 : START_NUMBER;
}

export async function GET(_req: NextRequest) {
  try {
    const nextNumber = await computeGlobalNextNumber();

    return NextResponse.json({ next: String(nextNumber) });
  } catch (e: any) {
    console.error('Error computing next check number:', e);
    return NextResponse.json({ 
      error: 'Failed to compute next number', 
      details: e?.message || 'Unknown error'
    }, { status: 500 });
  }
}


