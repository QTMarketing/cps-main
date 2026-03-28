// DEPRECATED: Check numbers are now store-based, not bank-based.
// Use GET /api/stores/:id/next-check-number instead.
// This endpoint is kept for backward compatibility only.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const START_NUMBER = 1000;

async function computeNextNumberForBank(bankId: number): Promise<number> {
  const maxCheck = await prisma.check.findFirst({
    where: { bank_id: bankId },
    orderBy: { check_number: 'desc' },
    select: { check_number: true },
  });

  return maxCheck ? Number(maxCheck.check_number) + 1 : START_NUMBER;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bankId = searchParams.get('bankId') || '';
    if (!bankId) {
      return NextResponse.json({ error: 'bankId is required' }, { status: 400 });
    }

    const bankIdNum = parseInt(bankId, 10);
    if (isNaN(bankIdNum)) {
      return NextResponse.json({ error: 'Invalid bankId' }, { status: 400 });
    }

    const nextNumber = await computeNextNumberForBank(bankIdNum);

    return NextResponse.json({ next: String(nextNumber) });
  } catch (error) {
    console.error('Error computing next check number:', error);
    return NextResponse.json({ 
      error: 'Failed to compute next check number',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}


