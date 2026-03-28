import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// GET /api/db-test - Test database connection with explicit Prisma client
export async function GET() {
  let prisma: PrismaClient | null = null;
  
  try {
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
    
    // Create a new Prisma client instance
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
    
    // Test connection
    await prisma.$connect();
    
    // Try a simple query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database connection successful',
      test: result,
      databaseUrl: process.env.DATABASE_URL
    });
  } catch (error) {
    console.error('Database connection error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Database connection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      databaseUrl: process.env.DATABASE_URL
    }, { status: 500 });
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}





