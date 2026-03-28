import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import path from 'path';
import fs from 'fs';
import { toWords } from 'number-to-words';

export type ChequePayload = {
  corporationName?: string | null;
  bankName: string;
  dbaName: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  chequeNumber: string;
  routingNumber: string;
  accountNumber: string;
  merchantNumber?: string | null;
  payeeName: string;
  amount: number;
  memo: string;
  date: string;
  signatureImageURL: string;
};

const CHEQUE_WIDTH = 612; // 8.5in * 72
const CHEQUE_HEIGHT = 252; // 3.5in * 72
const MARGIN = 24;
const TRANSIT_SYMBOL = String.fromCharCode(0x2446);
const ON_US_SYMBOL = String.fromCharCode(0x2448);

function loadMicrFontBytes(): Buffer {
  const micrPath = path.join(process.cwd(), 'public', 'micr-encoding.regular.ttf');
  if (!fs.existsSync(micrPath)) {
    throw new Error(
      `MICR font not found at ${micrPath}. Please place micr-encoding.regular.ttf in /public`
    );
  }
  return fs.readFileSync(micrPath);
}

async function loadSignatureBytes(signaturePath: string): Promise<Uint8Array | null> {
  if (!signaturePath) return null;
  try {
    if (signaturePath.startsWith('http://') || signaturePath.startsWith('https://')) {
      const res = await fetch(signaturePath);
      if (!res.ok) return null;
      const arrBuf = await res.arrayBuffer();
      return new Uint8Array(arrBuf);
    }

    const normalized = signaturePath.startsWith('/')
      ? signaturePath.slice(1)
      : signaturePath;
    const absPath = path.join(process.cwd(), 'public', normalized);
    if (!fs.existsSync(absPath)) {
      console.warn(`Signature image not found at ${absPath}`);
      return null;
    }
    return fs.readFileSync(absPath);
  } catch (error) {
    console.error('Unable to load signature image', error);
    return null;
  }
}

function formatCurrency(amount: number): string {
  return amount.toFixed(2);
}

function formatAmountWords(amount: number): string {
  if (Number.isNaN(amount)) return '';
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100);
  const words = toWords(whole).toUpperCase();
  return cents > 0 ? `${words} AND ${cents.toString().padStart(2, '0')}/100` : `${words} ONLY`;
}

export async function generateChequePdf(payload: ChequePayload): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const micrFont = await pdfDoc.embedFont(loadMicrFontBytes());

  const page = pdfDoc.addPage([CHEQUE_WIDTH, CHEQUE_HEIGHT]);
  const { height, width } = page.getSize();
  const startY = height - MARGIN;

  const drawText = (
    text: string,
    x: number,
    y: number,
    opts: { size?: number; font?: any; color?: any } = {}
  ) => {
    if (!text) return;
    page.drawText(text, {
      x,
      y,
      font: helvetica,
      size: 10,
      color: rgb(0, 0, 0),
      ...opts,
    });
  };

  // Top-left DBA + address block
  let dbaY = startY;
  if (payload.corporationName) {
    drawText(payload.corporationName, MARGIN, dbaY, { font: helveticaBold, size: 13 });
    dbaY -= 14;
  }
  drawText(payload.dbaName, MARGIN, dbaY, { font: helveticaBold, size: 12 });
  dbaY -= 14;
  drawText(payload.address.street, MARGIN, dbaY, { size: 10 });
  dbaY -= 12;
  drawText(`${payload.address.city}, ${payload.address.state} ${payload.address.zip}`, MARGIN, dbaY, {
    size: 10,
  });
  if (payload.merchantNumber) {
    dbaY -= 12;
    drawText(`Merchant #: ${payload.merchantNumber}`, MARGIN, dbaY, { size: 9 });
  }

  // Top-right cheque number + date box
  const chequeNumberX = width - MARGIN - 120;
  drawText(`Cheque No. ${payload.chequeNumber}`, chequeNumberX, startY, {
    font: helveticaBold,
    size: 11,
  });
  drawText(`Date: ${payload.date}`, chequeNumberX, startY - 14, { size: 10 });

  // Center-top bank name
  drawText(payload.bankName, width / 2 - 100, startY - 30, {
    font: helveticaBold,
    size: 12,
  });

  // Payee line
  const payeeLineY = startY - 60;
  drawText('Pay to the Order of', MARGIN, payeeLineY, { size: 10 });
  drawText(payload.payeeName, MARGIN + 120, payeeLineY, { font: helveticaBold, size: 13 });
  page.drawRectangle({
    x: width - MARGIN - 110,
    y: payeeLineY - 4,
    width: 110,
    height: 18,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });
  drawText(formatCurrency(payload.amount), width - MARGIN - 100, payeeLineY, {
    font: helveticaBold,
    size: 11,
  });

  // Amount in words
  const wordsY = payeeLineY - 24;
  page.drawLine({
    start: { x: MARGIN, y: wordsY - 4 },
    end: { x: width - MARGIN, y: wordsY - 4 },
    color: rgb(0, 0, 0),
    thickness: 1,
  });
  drawText(formatAmountWords(payload.amount), MARGIN, wordsY, { size: 11 });

  // Memo
  const memoY = 70;
  drawText(`Memo: ${payload.memo}`, MARGIN, memoY, { size: 10 });

  // Signature image
  const signatureBytes = await loadSignatureBytes(payload.signatureImageURL);
  if (signatureBytes) {
    try {
      let signatureImage;
      try {
        signatureImage = await pdfDoc.embedPng(signatureBytes);
      } catch {
        signatureImage = await pdfDoc.embedJpg(signatureBytes);
      }

      const sigDims = signatureImage.scale(0.25);
      const sigX = width - MARGIN - 180;
      const sigY = memoY + 10;
      page.drawImage(signatureImage, {
        x: sigX,
        y: sigY,
        width: sigDims.width,
        height: sigDims.height,
      });
      drawText('Authorized Signature', sigX, sigY - 12, { size: 9 });
    } catch (error) {
      console.warn('Failed to embed signature image', error);
    }
  }

  // MICR line near bottom
  const micrLineY = 30;
  const micrText = `${TRANSIT_SYMBOL}${payload.routingNumber}${TRANSIT_SYMBOL} ${payload.accountNumber} ${ON_US_SYMBOL}${payload.chequeNumber}${ON_US_SYMBOL}`;
  drawText(micrText, MARGIN, micrLineY, { font: micrFont, size: 14 });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

