/**
 * Letter-Size Check PDF Generator (8.5" x 11")
 * 
 * Generates a full Letter-size PDF with check at top and stub/remittance at bottom.
 * Used for development and as fallback when Puppeteer is unavailable.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { promises as fs } from 'fs';
import path from 'path';
import type { ChequeData } from './renderData';
import { formatCurrency, formatAmountWords } from './renderData';
import { hasAWSConfig, getBankSignatureBytes } from '@/lib/signatureStorage';

// =============================================================================
// CONSTANTS
// =============================================================================

const LETTER_WIDTH = 612;   // 8.5 inches * 72 points/inch
const LETTER_HEIGHT = 792;  // 11 inches * 72 points/inch
const CHECK_HEIGHT = 252;   // 3.5 inches
const MARGIN = 18;          // 0.25 inch (print-safe margin)
const TRANSIT_SYMBOL = String.fromCharCode(0x2446); // ⑆
const ON_US_SYMBOL = String.fromCharCode(0x2448);   // ⑈
const LIGHT_GRAY = rgb(0.7, 0.7, 0.7);

// =============================================================================
// FORMATTING HELPERS
// =============================================================================

/**
 * Format amount for display with consistent style
 * Returns: "1234.56" (no commas, 2 decimals)
 */
function formatAmountNumeric(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Format amount with check protection formatting
 * Returns: "$8,400.29**" (dollar sign, thousands separators, trailing asterisks)
 */
function formatAmountWithSecurity(amount: number): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(amount);
  return `$${formatted}**`; // Check amount protection format
}

/**
 * Clean and format amount in words for check
 * Removes any existing "DOLLARS" or "**" markers from input
 * Returns clean words only (no DOLLARS suffix)
 */
function cleanAmountWords(words: string): string {
  // Remove any existing DOLLARS suffix (case insensitive)
  let cleaned = words.replace(/\s*DOLLARS\s*ONLY$/i, '').replace(/\s*DOLLARS$/i, '');
  // Remove any ** markers
  cleaned = cleaned.replace(/\*\*/g, '').trim();
  return cleaned;
}

// =============================================================================
// FONT LOADING
// =============================================================================

async function loadMicrFontBytes(): Promise<Buffer | null> {
  const micrPaths = [
    path.join(process.cwd(), 'public', 'fonts', 'micr-encoding.regular.ttf'),
    path.join(process.cwd(), 'public', 'micr-encoding.regular.ttf'),
    path.join(process.cwd(), 'fonts', 'micr-encoding.regular.ttf'),
  ];

  for (const micrPath of micrPaths) {
    try {
      const stats = await fs.stat(micrPath);
      if (stats.isFile()) {
        return await fs.readFile(micrPath);
      }
    } catch {
      // Continue to next path
    }
  }

  console.warn('MICR font not found, using Helvetica as fallback');
  return null;
}

// =============================================================================
// PDF GENERATION
// =============================================================================

/**
 * Generates a Letter-size PDF with check and stub
 */
export async function generateLetterPdf(data: ChequeData): Promise<Buffer> {
  console.log("[PDF GENERATOR HIT] CPS_SIG_DEBUG -", __filename);
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Embed fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Try to load MICR font
  let micrFont = helvetica;
  try {
    const micrFontBytes = await loadMicrFontBytes();
    if (micrFontBytes) {
      micrFont = await pdfDoc.embedFont(micrFontBytes);
    }
  } catch (error) {
    console.warn('Failed to embed MICR font:', error);
  }

  // Create Letter-size page
  const page = pdfDoc.addPage([LETTER_WIDTH, LETTER_HEIGHT]);
  
  // Layout constants (keep columns visually aligned)
  const LEFT_X = MARGIN;
  const RIGHT_COL_W = 120;
  const RIGHT_COL_LEFT_X = LETTER_WIDTH - MARGIN - RIGHT_COL_W;
  const RIGHT_COL_RIGHT_X = LETTER_WIDTH - MARGIN;

  // Helper to draw text
  const drawText = (
    text: string,
    x: number,
    y: number,
    opts: { size?: number; font?: any; color?: ReturnType<typeof rgb> } = {}
  ) => {
    if (!text) return;
    
    // Sanitize text: replace non-ASCII characters to prevent WinAnsi encoding errors
    const safeText = text.replace(/[^\x20-\x7E]/g, '');
    
    page.drawText(safeText, {
      x,
      y,
      font: opts.font || helvetica,
      size: opts.size || 10,
      color: opts.color || rgb(0, 0, 0),
    });
  };

  // Helper to draw right-aligned text using a right edge X.
  const drawTextRight = (
    text: string,
    rightX: number,
    y: number,
    opts: { size?: number; font?: any; color?: ReturnType<typeof rgb> } = {}
  ) => {
    if (!text) return;
    const safeText = text.replace(/[^\x20-\x7E]/g, '');
    const font = opts.font || helvetica;
    const size = opts.size || 10;
    const w = font.widthOfTextAtSize(safeText, size);
    drawText(safeText, rightX - w, y, opts);
  };

  // Helper to draw line
  const drawLine = (x1: number, y1: number, x2: number, y2: number, color = rgb(0, 0, 0)) => {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 1,
      color,
    });
  };

  // ===========================================================================
  // TOP SECTION: CHECK - Match Check 3.pdf layout
  // ===========================================================================

  // Shifts cheque face content upward to clear perforation/tear line
  const CHECK_CONTENT_SHIFT = 18;
  
  // Header-only adjustment to prevent clipping at top
  const HEADER_SHIFT_DOWN = 14;

  const checkStartY = LETTER_HEIGHT - MARGIN - 8 + CHECK_CONTENT_SHIFT;
  let currentY = checkStartY - HEADER_SHIFT_DOWN; // Header starts lower

  // ===== HEADER SECTION =====
  // Top-left: Corporation name (bold)
  if (data.corporationName) {
    drawText(data.corporationName, LEFT_X, currentY, {
      font: helveticaBold,
      size: 11,
    });
    currentY -= 12; // Reduced from 13 for cleaner spacing
  }

  // Store/DBA name (bold, STRONGEST ELEMENT - issuer)
  drawText(data.dbaName, LEFT_X, currentY, {
    font: helveticaBold,
    size: 12, // Increased from 11 to make issuer more prominent
  });
  currentY -= 12; // Reduced from 13 for cleaner spacing

  // Address lines (normal weight)
  drawText(data.address.street, LEFT_X, currentY, { size: 9 });
  currentY -= 10; // Reduced from 11 for cleaner spacing
  drawText(
    `${data.address.city}, ${data.address.state} ${data.address.zip}`,
    LEFT_X,
    currentY,
    { size: 9 }
  );
  
  // Save left column bottom Y for later use
  const leftColBottomY = currentY - 11;

  // Top-right: Check number (large, bold) and date
  const checkNoText = data.chequeNumber;
  const headerRightY = checkStartY - HEADER_SHIFT_DOWN; // Align with header baseline
  drawTextRight(checkNoText, RIGHT_COL_RIGHT_X, headerRightY, {
    font: helveticaBold,
    size: 18,
  });
  drawTextRight(data.date, RIGHT_COL_RIGHT_X, headerRightY - 18, { size: 10 });

  // Center: Bank name (bold, less prominent)
  const bankNameWidth = helveticaBold.widthOfTextAtSize(data.bankName, 10);
  drawText(data.bankName, (LETTER_WIDTH - bankNameWidth) / 2, headerRightY - 8, {
    font: helveticaBold,
    size: 10, // Reduced from 13 to be less dominant
  });

  // Move down to payee section
  currentY = checkStartY - 60;

  // ===== PAYEE AND AMOUNT SECTION =====
  // "PAY TO THE" over "ORDER OF" label
  drawText('PAY TO THE', LEFT_X, currentY, {
    size: 8,
    color: rgb(0, 0, 0),
  });
  currentY -= 10;
  drawText('ORDER OF', LEFT_X, currentY, {
    size: 8,
    color: rgb(0, 0, 0),
  });
  currentY -= 14;

  // Payee name (bold) on line
  const payeeY = currentY;
  drawText(data.payeeName, LEFT_X, payeeY, {
    font: helveticaBold,
    size: 12,
  });
  
  // Amount on right with security fill (****1234.56)
  const amountStr = formatAmountWithSecurity(data.amount);
  const amountBoxX = RIGHT_COL_LEFT_X;
  const amountBoxY = payeeY + 2;
  
  // Draw amount (right-aligned)
  drawTextRight(amountStr, RIGHT_COL_RIGHT_X - 5, amountBoxY, {
    font: helveticaBold,
    size: 13,
  });
  
  // "DOLLARS" label under amount
  const dollarsLabel = 'DOLLARS';
  const dollarsLabelW = helvetica.widthOfTextAtSize(dollarsLabel, 8);
  drawText(dollarsLabel, amountBoxX + (RIGHT_COL_W - dollarsLabelW) / 2, amountBoxY - 12, {
    size: 8,
    color: rgb(0, 0, 0),
  });

  // Line under payee name
  drawLine(LEFT_X, payeeY - 2, amountBoxX - 10, payeeY - 2);
  currentY = payeeY - 18;

  // ===== AMOUNT IN WORDS =====
  // Clean format: "ONE THOUSAND TWO HUNDRED THIRTY-THREE DOLLARS ONLY"
  // (No duplicated DOLLARS, no ** markers)
  const rawAmountWords = formatAmountWords(data.amount); // Already includes "DOLLARS"
  const cleanWords = cleanAmountWords(rawAmountWords); // Remove "DOLLARS" suffix
  
  // Reconstruct with proper format
  const finalAmountWords = `${cleanWords} DOLLARS`;
  
  drawText(finalAmountWords, LEFT_X, currentY, { 
    font: helveticaBold,
    size: 10 
  });
  drawLine(LEFT_X, currentY - 2, LETTER_WIDTH - MARGIN, currentY - 2);
  currentY -= 18;

  // Move down for memo section
  currentY -= 22;

  // ===== MEMO AND SIGNATURE =====
  const memoY = currentY;
  
  // Memo line
  drawText('MEMO:', LEFT_X, memoY, { 
    size: 8,
    color: rgb(0, 0, 0)
  });
  drawText(data.memo || '', LEFT_X + 38, memoY, { size: 10 });
  drawLine(LEFT_X + 38, memoY - 2, LEFT_X + 280, memoY - 2, LIGHT_GRAY);

  // ===== BOTTOM BAND LAYOUT (PROSPERITY STYLE) =====
  // Calculate the cut line Y position first (boundary between check and stub)
  const cutLineY = LETTER_HEIGHT - CHECK_HEIGHT - 36;
  
  // Anchor MICR and signature to the bottom of TOP CHECK region (not page bottom)
  // This ensures they appear in the check area, above the "CUT HERE" line
  const TOP_CHECK_BOTTOM_Y = cutLineY + 10;  // Just above the cut line
  
  // Vertical adjustment to raise the entire bottom band for better spacing
  const BOTTOM_BAND_RAISE = 45;
  
  // Position MICR near the bottom of the top check
  // Calculation: Start from cut line + raise amount, ensuring MICR is clearly above cut line
  const MICR_Y = cutLineY + BOTTOM_BAND_RAISE;
  
  // ===== SIGNATURE SECTION - FRAME-BASED AUTO-SCALING =====
  // Define signature FRAME (bounding box where signature should fit)
  const SIG_FRAME_X = LETTER_WIDTH - MARGIN - 200;  // Left edge of signature field
  const SIG_FRAME_W = 200;                           // Frame width - increased for larger signature
  const SIG_FRAME_H = 70;                            // Frame height - increased for larger signature
  
  // Signature line position: anchored to bottom band (above MICR)
  const SIG_LINE_Y = MICR_Y + 44;  // Signature line sits above MICR in bottom band
  
  // Signature image bottom position: sits above the signature line
  const SIG_IMG_BOTTOM_Y = SIG_LINE_Y + 6;  // 6 points above line (signature floats above)
  
  console.log('[LAYOUT] cutLineY:', cutLineY, 'TOP_CHECK_BOTTOM_Y:', TOP_CHECK_BOTTOM_Y, 'BOTTOM_BAND_RAISE:', BOTTOM_BAND_RAISE, 'MICR_Y:', MICR_Y, 'SIG_LINE_Y:', SIG_LINE_Y);
  console.log('[PDF DEBUG] SIG_FRAME dimensions:', SIG_FRAME_W, 'x', SIG_FRAME_H);
  
  // Draw signature line FIRST (single source of truth for Y coordinate)
  drawLine(SIG_FRAME_X, SIG_LINE_Y, LETTER_WIDTH - MARGIN, SIG_LINE_Y);
  
  // Try to embed signature image if available (PNG/JPG only)
  let signatureEmbedded = false;
  if (data.signatureImageURL && data.signatureImageURL.trim()) {
    try {
      const signatureKey = data.signatureImageURL.trim();
      
      console.log('[PDF GENERATOR] Signature key received:', {
        signatureKey,
        isS3Key: signatureKey.startsWith('signatures/'),
        length: signatureKey.length,
      });
      
      // Skip if empty
      if (!signatureKey) {
        console.log('[PDF] No signature provided, skipping');
        return;
      }

      let imageBuffer: Buffer;

      // Detect if it's an S3 key or legacy path
      if (signatureKey.startsWith('signatures/')) {
        // It's a NEW S3 key - fetch from our AWS bucket
        if (!hasAWSConfig) {
          console.warn('[PDF] AWS S3 not configured, skipping signature');
          return;
        }
        
        try {
          console.log(`[PDF] Fetching signature from S3: ${signatureKey}`);
          const { bytes } = await getBankSignatureBytes(signatureKey);
          imageBuffer = bytes;
          console.log(`[PDF] Signature fetched from S3, size: ${imageBuffer.length} bytes`);
        } catch (err) {
          console.warn(`[PDF] Failed to fetch signature from S3:`, err);
          return; // Skip signature gracefully
        }
      } else {
        // Legacy path (/uploads/..., http://..., etc.) - treat as missing
        console.warn(`[PDF] Legacy signature path detected (ignoring): ${signatureKey}`);
        console.warn('[PDF] Please re-upload signature via UI to store in new S3 bucket.');
        return;
      }
      
      // Detect format from magic bytes (not file extension)
      let embeddedImage;
      const header = imageBuffer.subarray(0, 8);
      
      // PNG: 89 50 4E 47
      if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
        embeddedImage = await pdfDoc.embedPng(imageBuffer);
        console.log('[PDF] Embedded PNG signature');
      }
      // JPEG: FF D8 FF
      else if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
        embeddedImage = await pdfDoc.embedJpg(imageBuffer);
        console.log('[PDF] Embedded JPEG signature');
      }
      // TIFF: 49 49 2A 00 or 4D 4D 00 2A
      else if (
        (header[0] === 0x49 && header[1] === 0x49 && header[2] === 0x2A && header[3] === 0x00) ||
        (header[0] === 0x4D && header[1] === 0x4D && header[2] === 0x00 && header[3] === 0x2A)
      ) {
        console.warn('[PDF] TIFF format detected - not supported by pdf-lib. Please upload PNG or JPEG.');
        return;
      } else {
        console.warn('[PDF] Unknown image format. First bytes:', Array.from(header.subarray(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        return;
      }
      
      // ===== WIDTH-FIRST SCALING WITH HEIGHT CAP (preserve aspect ratio) =====
      const imgDims = embeddedImage.scale(1);
      
      console.log('[PDF DEBUG] Original signature dimensions:', imgDims.width, 'x', imgDims.height);
      
      // Define target dimensions
      const TARGET_SIG_W = 180; // Target signature width (reduced for smaller visual size)
      const MAX_SIG_H = 110;    // Maximum signature height (reduced for smaller visual size)
      
      // Calculate both scale factors
      const scaleW = TARGET_SIG_W / imgDims.width;
      const scaleH = MAX_SIG_H / imgDims.height;
      
      console.log('[PDF DEBUG] Scale factors - scaleW:', scaleW.toFixed(3), 'scaleH:', scaleH.toFixed(3));
      
      // Use width-first scaling if it doesn't exceed height limit
      let scale;
      if (imgDims.height * scaleW <= MAX_SIG_H) {
        scale = scaleW; // Use width-based scaling (signature will fill width)
        console.log('[PDF DEBUG] Using width-based scaling (height check passed)');
      } else {
        scale = scaleH; // Height would exceed limit, use height-based scaling
        console.log('[PDF DEBUG] Using height-based scaling (height limit reached)');
      }
      
      console.log('[PDF DEBUG] Selected scale:', scale.toFixed(3));
      
      const scaledWidth = imgDims.width * scale;
      const scaledHeight = imgDims.height * scale;
      
      console.log('[PDF DEBUG] Scaled signature dimensions:', scaledWidth.toFixed(1), 'x', scaledHeight.toFixed(1));
      
      // Center horizontally inside frame
      const drawX = SIG_FRAME_X + (SIG_FRAME_W - scaledWidth) / 2;
      
      // Position vertically: use pre-calculated position to avoid MICR overlap
      // In pdf-lib, drawImage uses BOTTOM-LEFT corner at (x,y)
      const drawY = SIG_IMG_BOTTOM_Y;
      
      console.log('[PDF SIG DEBUG] using file:', __filename);
      console.log('[PDF SIG DEBUG] SIG_LINE_Y:', SIG_LINE_Y, 'drawY (bottom):', drawY, 'scaledHeight:', scaledHeight);
      console.log('[PDF SIG DEBUG] Signature bottom will be at:', drawY);
      console.log('[PDF SIG DEBUG] Signature top will be at:', drawY + scaledHeight);
      console.log('[PDF DEBUG] drawX (horizontal center):', drawX.toFixed(1));
      
      console.log("[PDF SIGNATURE DRAW] Y-coord calculation: SIG_LINE_Y =", SIG_LINE_Y, ", scaledHeight =", scaledHeight.toFixed(2));
      console.log("[PDF SIGNATURE DRAW] Final drawY (bottom) =", drawY.toFixed(2), ", signature top will be at:", (drawY + scaledHeight).toFixed(2));
      
      // Draw signature image at full opacity
      page.drawImage(embeddedImage, {
        x: drawX,
        y: drawY,
        width: scaledWidth,
        height: scaledHeight,
        opacity: 1.0,
      });
      
      signatureEmbedded = true;
      console.log(`[PDF] Signature embedded successfully at (${drawX.toFixed(1)}, ${drawY.toFixed(1)}), size: ${scaledWidth.toFixed(1)}x${scaledHeight.toFixed(1)}, scale: ${(scale * 100).toFixed(1)}%`);
    } catch (error) {
      // Log error for debugging but continue without signature
      console.error('[PDF] Failed to load signature image:', error);
      console.error('[PDF] Signature URL was:', data.signatureImageURL);
    }
  } else {
    console.log('[PDF] No signature URL provided, skipping signature embedding');
  }
  
  // Signature label (below the line, using SIG_LINE_Y as reference)
  drawText('AUTHORIZED SIGNATURE', SIG_FRAME_X + 10, SIG_LINE_Y - 14, {
    size: 7,
    color: rgb(0, 0, 0),
  });

  // ===== MICR LINE =====
  // Format: C<checkNo>C a<routing>a <account>C
  // Using MICR symbols: C = transit symbol, a = on-us symbol
  const micrCheckNum = data.chequeNumber;
  const micrRouting = data.routingNumber;
  const micrAccount = data.accountNumber;
  
  const micrText = `C${micrCheckNum}C a${micrRouting}a ${micrAccount}C`;
  const micrFontSize = 18; // Increased for better readability
  const micrWidth = micrFont.widthOfTextAtSize(micrText, micrFontSize);
  drawText(micrText, (LETTER_WIDTH - micrWidth) / 2, MICR_Y, {
    font: micrFont,
    size: micrFontSize,
    color: rgb(0, 0, 0), // Pure black for maximum contrast
  });

  // ===========================================================================
  // CUT LINE (Professional, clean dashed line)
  // ===========================================================================

  // cutLineY already calculated above for MICR/signature positioning
  
  // Thin dashed line across page
  const dashLength = 6;
  const gapLength = 4;
  for (let x = MARGIN; x < LETTER_WIDTH - MARGIN; x += dashLength + gapLength) {
    const endX = Math.min(x + dashLength, LETTER_WIDTH - MARGIN);
    drawLine(x, cutLineY, endX, cutLineY, LIGHT_GRAY);
  }
  
  // Centered "CUT HERE" text
  const cutText = 'CUT HERE';
  const cutTextWidth = helvetica.widthOfTextAtSize(cutText, 7);
  const cutTextX = (LETTER_WIDTH - cutTextWidth) / 2;
  
  // White background rectangle behind text for readability
  page.drawRectangle({
    x: cutTextX - 4,
    y: cutLineY - 9,
    width: cutTextWidth + 8,
    height: 12,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  });
  
  drawText(cutText, cutTextX, cutLineY - 3, {
    size: 7,
    color: LIGHT_GRAY,
  });

  // ===========================================================================
  // BOTTOM SECTION: REMITTANCE STUB - Match Check 3.pdf layout
  // ===========================================================================

  const stubStartY = cutLineY - 40;
  let stubY = stubStartY;

  // ===== STUB HEADER =====
  drawText('REMITTANCE COPY - RETAIN FOR YOUR RECORDS', MARGIN, stubY, {
    font: helveticaBold,
    size: 9,
    color: rgb(0.5, 0.5, 0.5), // Medium gray
  });
  stubY -= 24;
  
  // Left: Corporation + Store name (bold)
  if (data.corporationName) {
    drawText(data.corporationName, MARGIN, stubY, {
      font: helveticaBold,
      size: 10,
    });
    stubY -= 12;
  }
  
  // Store/issuer name (slightly larger to match check header)
  drawText(data.dbaName, MARGIN, stubY, {
    font: helveticaBold,
    size: 11, // Increased from 10 to match stronger issuer presence
  });
  
  // Right: Check number (bold) and date
  const stubHeaderY = data.corporationName ? stubStartY - 24 : stubStartY - 24;
  drawTextRight(data.chequeNumber, RIGHT_COL_RIGHT_X, stubHeaderY, {
    font: helveticaBold,
    size: 11,
  });
  drawTextRight(data.date, RIGHT_COL_RIGHT_X, stubHeaderY - 14, { size: 9 }); // Increased spacing from -12 to -14
  
  stubY -= 24; // Increased spacing from 20 to 24 for better separation

  // ===== PAID TO SECTION =====
  // Left: "PAID TO" label and payee (bold)
  drawText('PAID TO', MARGIN, stubY, {
    size: 8,
    color: LIGHT_GRAY,
  });
  
  // Right: Amount with security fill (consistent with check)
  const stubAmountStr = formatAmountWithSecurity(data.amount);
  const stubAmountWidth = helveticaBold.widthOfTextAtSize(stubAmountStr, 11);
  const stubAmountX = LETTER_WIDTH - MARGIN - 10; // Pin amount to right edge
  drawText(stubAmountStr, stubAmountX - stubAmountWidth, stubY, {
    font: helveticaBold,
    size: 11,
  });
  
  stubY -= 14;
  
  // Payee name (bold)
  drawText(data.payeeName, MARGIN, stubY, {
    font: helveticaBold,
    size: 10,
  });
  stubY -= 18; // Increased spacing from 16 to 18 for better separation

  // ===== MEMO LINE =====
  if (data.memo) {
    drawText('MEMO:', MARGIN, stubY, {
      size: 8,
      color: LIGHT_GRAY,
    });
    drawText(data.memo, MARGIN + 35, stubY, { size: 9 });
    stubY -= 18; // Increased spacing from 16 to 18 for better separation
  }

  // ===== BANK AND ACCOUNT INFO =====
  // Bottom-right: "Bank: <bankName>  Account# : <accountNumber>"
  const bankInfoY = stubY - 12; // Increased spacing from -10 to -12
  const bankInfoText = `Bank: ${data.bankName}  Account# : ${data.accountNumber}`;
  const bankInfoWidth = helvetica.widthOfTextAtSize(bankInfoText, 7);
  drawText(bankInfoText, LETTER_WIDTH - MARGIN - bankInfoWidth, bankInfoY, {
    size: 7,
    color: rgb(0.6, 0.6, 0.6), // Lighter gray for bank info
  });

  // ===== IDENTIFIER =====
  // Lower center-right: "<storeName>_<checkNo>"
  const identifierText = `${data.dbaName}_${data.chequeNumber}`;
  const identifierWidth = helvetica.widthOfTextAtSize(identifierText, 7);
  drawText(identifierText, LETTER_WIDTH - MARGIN - identifierWidth - 10, bankInfoY - 12, {
    size: 7,
    color: rgb(0.6, 0.6, 0.6),
  });

  // TEMPORARY DEBUG MARKER - REMOVE AFTER VERIFICATION
  page.drawText("SIG_DEBUG_V1", {
    x: 10,
    y: 10,
    size: 6,
    color: rgb(0.5, 0.5, 0.5),
    font: helvetica,
  });

  // Save and return
  const pdfBytes = await pdfDoc.save();
  
  // Proof log for Vercel deployment verification
  console.log("[PDF SETTINGS PROOF]", {
    micrFontSize: 16,
    sigMaxH: 110,
    sigTargetW: 180,
    ts: new Date().toISOString(),
  });
  
  return Buffer.from(pdfBytes);
}
