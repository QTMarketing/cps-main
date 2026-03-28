import { NextResponse } from 'next/server';

// GET /api/simple-test - Simple test without Prisma
export async function GET() {
  try {
    return NextResponse.json({ 
      success: true, 
      message: 'API endpoint working',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: 'API error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}





