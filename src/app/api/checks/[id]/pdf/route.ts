import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonGuardError, requireAuth } from "@/lib/guards";
import { chequeSelect, mapChequeRecord } from "@/lib/cheques/transformers";
import { generateLetterPdf } from "@/lib/cheque/generateLetterPdf";
import type { ChequeData } from "@/lib/cheque/renderData";
import type { ChequeViewModel } from "@/lib/cheques/types";

// Force dynamic rendering - never cache check PDFs
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

// Helper to convert ChequeViewModel to ChequeData (for pdf-lib generator)
function convertChequeToPayload(cheque: ChequeViewModel): ChequeData {
  const corporation = cheque.bank.corporation;
  
  // ISSUER BLOCK: Use Store information (not Bank.dba)
  // Store is the issuer (the company writing the check)
  const issuerName = cheque.store?.name || "(Unknown Store)";
  const issuerAddress = cheque.store?.address || "";
  
  // Parse store address (assumed format: "street, city, state zip" or similar)
  // If store address is a single string, try to parse it
  let street = issuerAddress;
  let city = "";
  let state = "";
  let zip = "";
  
  // Try to parse address if it contains commas (common format)
  if (issuerAddress.includes(',')) {
    const parts = issuerAddress.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      street = parts[0];
      // Last part might be "City ST ZIP"
      const lastPart = parts[parts.length - 1];
      const cityStateZipMatch = lastPart.match(/^(.+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
      if (cityStateZipMatch) {
        city = cityStateZipMatch[1].trim();
        state = cityStateZipMatch[2];
        zip = cityStateZipMatch[3];
      } else {
        // Fallback: just use the last part as city
        city = lastPart;
      }
    }
  }
  
  // If parsing failed, use sensible defaults
  if (!city) city = "N/A";
  if (!state) state = "N/A";
  if (!zip) zip = "00000";
  
  return {
    // ISSUER INFORMATION (Store = issuer)
    dbaName: issuerName, // Store name (e.g., "LP Food Mart" or "QT 126")
    corporationName: corporation?.name || null, // Corporation if available
    address: {
      street: street || "N/A",
      city,
      state,
      zip,
    },
    
    // BANK INFORMATION (separate from issuer)
    bankName: cheque.bank.name, // e.g., "Commercial Bank of Texas"
    routingNumber: cheque.bank.routingNumber,
    accountNumber: cheque.bank.accountNumber,
    merchantNumber: null,
    
    // Check Information
    chequeNumber: cheque.number,
    date: new Date(cheque.createdAt).toLocaleDateString("en-US"),
    payeeName: cheque.payee.name,
    amount: cheque.amount,
    memo: cheque.memo || "",
    
    // Signature (pdf-lib handles missing signatures gracefully)
    signatureImageURL: cheque.bank.signatureUrl || "",
  };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    console.log("[ROUTE ENTRY] /api/checks/[id]/pdf - raw params:", context.params);
    console.log("[PDF ROUTE HIT] CPS_SIG_DEBUG - checks/[id]/pdf/route.ts");
    
    const ctx = await requireAuth(req);
    const { id } = await context.params;
    const idParam = id;
    const checkId = parseInt(idParam, 10);
    
    if (Number.isNaN(checkId)) {
      return NextResponse.json({ error: "Invalid cheque id" }, { status: 400 });
    }

    const check = await prisma.check.findUnique({
      where: { id: checkId },
      select: { ...chequeSelect, store_id: true },
    });

    if (!check) {
      return NextResponse.json({ error: "Cheque not found" }, { status: 404 });
    }

    // Store scoping: store users may only generate PDFs for their store
    const isStoreRestrictedUser = ctx.role === 'USER' || ctx.role === 'STORE_USER';
    if (isStoreRestrictedUser) {
      if (ctx.storeId == null) {
        return NextResponse.json({ error: 'Forbidden', message: 'No store assigned to user' }, { status: 403 });
      }
      if (check.store_id !== ctx.storeId) {
        return NextResponse.json({ error: 'Forbidden', message: 'You do not have access to this cheque' }, { status: 403 });
      }
    }

    const cheque = mapChequeRecord(check as any);
    
    console.log('[PDF ROUTE] Bank signature from DB:', {
      checkId,
      bankId: cheque.bank.id,
      signatureUrl: cheque.bank.signatureUrl,
      isS3Key: cheque.bank.signatureUrl?.startsWith('signatures/'),
      timestamp: new Date().toISOString(),
    });
    
    // Generate PDF using pdf-lib Letter generator (includes check + remittance stub)
    // This is the primary generator for downloads; always uses the same code path
    console.log("[PDF] Using pdf-lib Letter generator");
    const payload = convertChequeToPayload(cheque);
    const pdfBytes = await generateLetterPdf(payload);

    // Check if download is requested via query parameter
    const url = new URL(req.url);
    const isDownload = url.searchParams.get('download') === '1';
    const disposition = isDownload 
      ? `attachment; filename="cheque-${cheque.number || checkId}.pdf"`
      : `inline; filename="cheque-${cheque.number || checkId}.pdf"`;

    return new NextResponse(pdfBytes as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    if (typeof (error as any)?.status === "number") {
      return jsonGuardError(error);
    }
    console.error("Failed to render cheque PDF:", error);
    return NextResponse.json(
      { error: "Failed to render cheque PDF" },
      { status: 500 }
    );
  }
}

