import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function parseStoreDigits(code: string): number {
  const match = code.match(/\d+/);
  if (!match) throw new Error(`Invalid store code: ${code}`);
  return parseInt(match[0], 10);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const storeId = parseInt(id, 10);
    
    if (isNaN(storeId)) {
      return NextResponse.json({ error: 'Invalid storeId' }, { status: 400 });
    }

    // Load store and sequence
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { 
        code: true,
        sequence: {
          select: { nextNumber: true }
        }
      },
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const storeDigits = parseStoreDigits(store.code);
    const nextNumber = store.sequence?.nextNumber ?? 1;
    const previewCheckNumber = storeDigits * 10000 + nextNumber;

    return NextResponse.json({ next: String(previewCheckNumber) });
  } catch (error) {
    console.error('Error computing next check number:', error);
    return NextResponse.json({ 
      error: 'Failed to compute next check number',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
