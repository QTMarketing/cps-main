import { NextRequest, NextResponse } from 'next/server';
import { generatePdf } from '@/lib/cheque/generatePdf';
import { validateChequeData } from '@/lib/cheque/renderData';
import { requireAuth } from '@/lib/guards';

export async function POST(req: NextRequest) {
  try {
    // Require authentication
    await requireAuth(req);

    const body = await req.json();
    
    // Validate cheque data
    const payload = validateChequeData(body);

    // Generate PDF
    const pdfBuffer = await generatePdf(payload);
    const filename = `cheque_${payload.chequeNumber}.pdf`;

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    // Handle validation errors
    if (error.name === 'ZodError' || error.issues) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.issues?.map((issue: any) => ({
            field: issue.path?.join('.') || 'root',
            message: issue.message,
          })) || [{ message: error.message }],
        },
        { status: 400 }
      );
    }

    console.error('Failed to generate cheque PDF:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate cheque PDF',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

