/**
 * Cheque PDF Generator
 * 
 * This module generates PDF cheques using pdf-lib with embedded MICR font
 * for bank routing and account numbers. Supports signature images and
 * proper cheque formatting.
 */

import { PDFDocument, StandardFonts, rgb, PDFImage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { promises as fs } from 'fs';
import path from 'path';
import type { ChequeData } from './renderData';
import { formatCurrency, formatAmountWords } from './renderData';

// =============================================================================
// CONSTANTS
// =============================================================================

const CHEQUE_WIDTH = 612; // 8.5 inches * 72 points per inch
const CHEQUE_HEIGHT = 252; // 3.5 inches * 72 points per inch
const MARGIN = 24; // 1/3 inch margin
const TRANSIT_SYMBOL = String.fromCharCode(0x2446); // ⑆ (transit symbol)
const ON_US_SYMBOL = String.fromCharCode(0x2448); // ⑈ (on-us symbol)

// =============================================================================
// FONT LOADING
// =============================================================================

/**
 * Loads MICR font bytes from file system
 * Falls back to Helvetica if MICR font is not available
 * 
 * MICR font files can be placed in:
 * - public/fonts/micr-encoding.regular.ttf (recommended)
 * - public/micr-encoding.regular.ttf
 * - fonts/micr-encoding.regular.ttf
 * 
 * Note: MICR fonts are specialized fonts for bank routing numbers.
 * If not available, the system will use Helvetica as a fallback.
 */
async function loadMicrFontBytes(): Promise<Buffer | null> {
  const micrPaths = [
    path.join(process.cwd(), 'public', 'fonts', 'micr-encoding.regular.ttf'),
    path.join(process.cwd(), 'public', 'micr-encoding.regular.ttf'),
    path.join(process.cwd(), 'fonts', 'micr-encoding.regular.ttf'),
  ];

  for (const micrPath of micrPaths) {
    try {
      if (await fs.access(micrPath).then(() => true).catch(() => false)) {
        const fontBytes = await fs.readFile(micrPath);
        console.log(`MICR font loaded from: ${micrPath}`);
        return fontBytes;
      }
    } catch (error) {
      // Continue to next path
    }
  }

  console.warn('MICR font not found. Using Helvetica as fallback. For proper MICR encoding, place micr-encoding.regular.ttf in public/fonts/');
  return null;
}

// =============================================================================
// IMAGE LOADING
// =============================================================================

/**
 * Loads signature image from URL or file path
 */
async function loadSignatureBytes(signaturePath: string): Promise<Uint8Array | null> {
  if (!signaturePath) return null;

  try {
    // Handle HTTP/HTTPS URLs
    if (signaturePath.startsWith('http://') || signaturePath.startsWith('https://')) {
      const res = await fetch(signaturePath);
      if (!res.ok) {
        console.warn(`Failed to fetch signature from URL: ${signaturePath}`);
        return null;
      }
      const arrBuf = await res.arrayBuffer();
      return new Uint8Array(arrBuf);
    }

    // Handle local file paths
    const normalized = signaturePath.startsWith('/')
      ? signaturePath.slice(1)
      : signaturePath;
    
    const absPaths = [
      path.join(process.cwd(), 'public', normalized),
      path.join(process.cwd(), normalized),
      normalized,
    ];

    for (const absPath of absPaths) {
      try {
        if (await fs.access(absPath).then(() => true).catch(() => false)) {
          return await fs.readFile(absPath);
        }
      } catch {
        // Continue to next path
      }
    }

    console.warn(`Signature image not found at: ${signaturePath}`);
    return null;
  } catch (error) {
    console.error('Error loading signature image:', error);
    return null;
  }
}

// =============================================================================
// PDF GENERATION
// =============================================================================

/**
 * Generates a PDF cheque from cheque data
 * 
 * @param data - Cheque data including bank info, payee, amount, etc.
 * @returns PDF buffer ready to be sent as response
 */
export async function generatePdf(data: ChequeData): Promise<Buffer> {
  // Create PDF document
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Embed fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Try to load MICR font, fallback to Helvetica if not available
  let micrFont = helvetica;
  try {
    const micrFontBytes = await loadMicrFontBytes();
    if (micrFontBytes) {
      micrFont = await pdfDoc.embedFont(micrFontBytes);
    }
  } catch (error) {
    console.warn('Failed to embed MICR font, using Helvetica:', error);
  }

  // Create page with cheque dimensions
  const page = pdfDoc.addPage([CHEQUE_WIDTH, CHEQUE_HEIGHT]);
  const { height, width } = page.getSize();
  const startY = height - MARGIN;

  // Helper function to draw text
const drawText = (
    text: string,
    x: number,
    y: number,
    opts: {
      size?: number;
      font?: any;
    color?: ReturnType<typeof rgb>;
    } = {}
  ) => {
    if (!text) return;

    page.drawText(text, {
      x,
      y,
      font: opts.font || helvetica,
      size: opts.size || 10,
      color: opts.color || rgb(0, 0, 0),
    });
  };

  // ===========================================================================
  // TOP SECTION: Bank Information and Cheque Number
  // ===========================================================================

  // Top-left: Corporation name (if provided)
  let currentY = startY;
  if (data.corporationName) {
    drawText(data.corporationName, MARGIN, currentY, {
      font: helveticaBold,
      size: 13,
    });
    currentY -= 14;
  }

  // Top-left: DBA name
  drawText(data.dbaName, MARGIN, currentY, {
    font: helveticaBold,
    size: 12,
  });
  currentY -= 14;

  // Top-left: Address
  drawText(data.address.street, MARGIN, currentY, { size: 10 });
  currentY -= 12;
  drawText(
    `${data.address.city}, ${data.address.state} ${data.address.zip}`,
    MARGIN,
    currentY,
    { size: 10 }
  );
  currentY -= 12;

  // Merchant number (if provided)
  if (data.merchantNumber) {
    drawText(`Merchant #: ${data.merchantNumber}`, MARGIN, currentY, { size: 9 });
    currentY -= 12;
  }

  // Top-right: Cheque number and date
  const chequeNumberX = width - MARGIN - 120;
  drawText(`Cheque No. ${data.chequeNumber}`, chequeNumberX, startY, {
    font: helveticaBold,
    size: 11,
  });
  drawText(`Date: ${data.date}`, chequeNumberX, startY - 14, { size: 10 });

  // Center-top: Bank name
  const bankNameX = width / 2 - 100;
  drawText(data.bankName, bankNameX, startY - 30, {
    font: helveticaBold,
    size: 12,
  });

  // ===========================================================================
  // MIDDLE SECTION: Payee and Amount
  // ===========================================================================

  const payeeLineY = startY - 60;

  // "Pay to the Order of" label
  drawText('Pay to the Order of', MARGIN, payeeLineY, { size: 10 });

  // Payee name
  drawText(data.payeeName, MARGIN + 120, payeeLineY, {
    font: helveticaBold,
    size: 13,
  });

  // Amount box (right side)
  const amountBoxX = width - MARGIN - 110;
  const amountBoxY = payeeLineY - 4;
  page.drawRectangle({
    x: amountBoxX,
    y: amountBoxY,
    width: 110,
    height: 18,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });

  // Amount in numbers
  const amountText = `$${formatCurrency(data.amount)}`;
  drawText(amountText, amountBoxX + 5, payeeLineY, {
    font: helveticaBold,
    size: 11,
  });

  // ===========================================================================
  // AMOUNT IN WORDS
  // ===========================================================================

  const wordsY = payeeLineY - 24;
  
  // Line above amount in words
  page.drawLine({
    start: { x: MARGIN, y: wordsY - 4 },
    end: { x: width - MARGIN, y: wordsY - 4 },
    color: rgb(0, 0, 0),
    thickness: 1,
  });

  // Amount in words
  const amountWords = formatAmountWords(data.amount);
  drawText(amountWords, MARGIN, wordsY, { size: 11 });

  // ===========================================================================
  // BOTTOM SECTION: Memo and Signature
  // ===========================================================================

  const memoY = 70;

  // Memo
  drawText(`Memo: ${data.memo}`, MARGIN, memoY, { size: 10 });

  // Signature image
  const signatureBytes = await loadSignatureBytes(data.signatureImageURL);
  if (signatureBytes) {
    try {
      let signatureImage: PDFImage;
      
      // Try PNG first, then JPG
      try {
        signatureImage = await pdfDoc.embedPng(signatureBytes);
      } catch {
        signatureImage = await pdfDoc.embedJpg(signatureBytes);
      }

      // Scale signature to appropriate size
      const sigDims = signatureImage.scale(0.25);
      const sigX = width - MARGIN - 180;
      const sigY = memoY + 10;

      page.drawImage(signatureImage, {
        x: sigX,
        y: sigY,
        width: sigDims.width,
        height: sigDims.height,
      });

      // "Authorized Signature" label
      drawText('Authorized Signature', sigX, sigY - 12, { size: 9 });
    } catch (error) {
      console.warn('Failed to embed signature image:', error);
    }
  }

  // ===========================================================================
  // MICR LINE (Bottom)
  // ===========================================================================

  const micrLineY = 30;
  
  // Format MICR line: ⑆routing⑆ account ⑈cheque⑈
  const micrText = `${TRANSIT_SYMBOL}${data.routingNumber}${TRANSIT_SYMBOL} ${data.accountNumber} ${ON_US_SYMBOL}${data.chequeNumber}${ON_US_SYMBOL}`;
  
  // Draw MICR line using MICR font (or Helvetica fallback)
  drawText(micrText, MARGIN, micrLineY, {
    font: micrFont,
    size: 14,
  });

  // ===========================================================================
  // FINALIZE PDF
  // ===========================================================================

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

