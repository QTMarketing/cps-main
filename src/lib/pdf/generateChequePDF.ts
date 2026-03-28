import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { ChequeViewModel } from "@/lib/cheques/types";
import path from "path";
import { promises as fs } from "fs";
import { Buffer } from "buffer";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const buildMicr = (cheque: ChequeViewModel) => {
  const normalize = (value: string, length: number) =>
    value.replace(/\D/g, "").padStart(length, "0");
  const number = normalize(cheque.number, 6);
  const routing = normalize(cheque.bank.routingNumber, 9);
  const account = normalize(cheque.bank.accountNumber, 9);
  return `⛓ ${number}     ${routing}     ${account}`;
};

let cachedMicrFontDataUrl: string | null = null;

async function getMicrFontDataUrl(): Promise<string> {
  if (cachedMicrFontDataUrl !== null) {
    return cachedMicrFontDataUrl;
  }
  try {
    const fontPath = path.join(process.cwd(), "public", "micr-encoding.regular.ttf");
    const bytes = await fs.readFile(fontPath);
    cachedMicrFontDataUrl = `data:font/ttf;base64,${bytes.toString("base64")}`;
  } catch (error) {
    console.warn("Unable to load MICR font, falling back to system font:", error);
    cachedMicrFontDataUrl = "";
  }
  return cachedMicrFontDataUrl;
}

// Helper to check if signature format is supported
function isSignatureSupported(url: string | null | undefined): boolean {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  // TIFF/TIF is not supported in browsers
  return !lowerUrl.endsWith('.tif') && !lowerUrl.endsWith('.tiff');
}

// Helper to normalize signature URL
function normalizeSignatureUrl(url: string | null | undefined): string | null {
  if (!url || !isSignatureSupported(url)) return null;
  
  // Remove localhost references
  if (url.startsWith("http://localhost:") || url.startsWith("https://localhost:")) {
    url = url.replace(/^https?:\/\/localhost:\d+/, "");
  }
  
  // Ensure leading slash for relative paths
  if (!url.startsWith("/") && !url.startsWith("http")) {
    url = "/" + url;
  }
  
  return url;
}

const renderChequeHtml = (cheque: ChequeViewModel, micrFontDataUrl: string) => {
  const amount = currency.format(cheque.amount);
  const micr = buildMicr(cheque);
  
  // Normalize and validate signature URL
  const normalizedSignatureUrl = normalizeSignatureUrl(cheque.bank.signatureUrl);
  const signature = normalizedSignatureUrl
    ? `<img src="${normalizedSignatureUrl}" alt="Signature" onerror="this.style.display='none'" />`
    : "";
  
  const micrFontFace = micrFontDataUrl
    ? `@font-face { font-family: "MICR"; src: url('${micrFontDataUrl}') format("truetype"); font-weight: normal; font-style: normal; }`
    : "";

  const corporationBlock = cheque.bank.corporation
    ? `
        <p class="bank-account-line bank-account-name">${cheque.bank.corporation.name}</p>
        ${
          cheque.bank.corporation.owner
            ? `<p class="bank-account-line">Owner: ${cheque.bank.corporation.owner}</p>`
            : ""
        }
        ${
          cheque.bank.corporation.ein
            ? `<p class="bank-account-line">EIN: ${cheque.bank.corporation.ein}</p>`
            : ""
        }
      `
    : `
        ${
          cheque.bank.accountName
            ? `<p class="bank-account-line bank-account-name">${cheque.bank.accountName}</p>`
            : ""
        }
        ${
          cheque.bank.dba
            ? `<p class="bank-account-line bank-dba">${cheque.bank.dba}</p>`
            : ""
        }
      `;

  const addressBlock = `
    ${
      cheque.bank.addressLine1
        ? `<p class="bank-account-line">${cheque.bank.addressLine1}</p>`
        : ""
    }
    ${
      cheque.bank.cityStateZip
        ? `<p class="bank-account-line">${cheque.bank.cityStateZip}</p>`
        : ""
    }
  `;

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        ${micrFontFace}
        @page {
          size: Letter;
          margin: 0;
        }
        * {
          box-sizing: border-box;
        }
        body {
          font-family: "Helvetica Neue", Arial, sans-serif;
          margin: 0;
          padding: 0;
          background: white;
        }
        .sheet {
          width: 8.5in;
          height: 11in;
          position: relative;
          background: white;
        }
        .cheque {
          position: absolute;
          top: 0.25in;
          left: 0.25in;
          width: 8in;
          height: 3in;
          background: #fff;
          border: 1px solid #333;
          padding: 0.25in;
          display: flex;
          flex-direction: column;
          gap: 0.15in;
        }
        .status {
          position: absolute;
          top: 0.08in;
          left: 50%;
          transform: translateX(-50%);
          padding: 2px 12px;
          border: 1px solid #666;
          background: #f0f0f0;
          font-size: 9px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #333;
        }
        .row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.2in;
        }
        .bank-account-line {
          margin: 1px 0;
          font-size: 10px;
          color: #333;
          line-height: 1.3;
        }
        .bank-account-name,
        .bank-dba {
          font-weight: 700;
        }
        .bank-center h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #000;
          font-family: "Helvetica Neue", Arial, sans-serif;
        }
        .meta {
          text-align: right;
          font-size: 10px;
          color: #333;
          font-family: "Helvetica Neue", Arial, sans-serif;
          line-height: 1.4;
        }
        .payee-label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: #666;
          font-weight: 700;
          font-family: "Helvetica Neue", Arial, sans-serif;
        }
        .payee-name {
          font-size: 18px;
          font-weight: 600;
          color: #000;
          margin: 4px 0;
        }
        .payee-rule {
          height: 1px;
          background: #333;
          margin-top: 2px;
        }
        .amount-box {
          border: 2px solid #333;
          padding: 8px 12px;
          font-size: 18px;
          font-weight: 700;
          min-width: 1.4in;
          text-align: right;
          color: #000;
          font-family: "Helvetica Neue", Arial, sans-serif;
        }
        .amount-words {
          font-size: 12px;
          font-weight: 500;
          color: #000;
          border-bottom: 1px solid #333;
          padding-bottom: 6px;
          font-family: "Helvetica Neue", Arial, sans-serif;
        }
        .footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 0.1in;
        }
        .memo {
          font-size: 10px;
          color: #333;
          font-family: "Helvetica Neue", Arial, sans-serif;
        }
        .memo span {
          display: inline-block;
          min-width: 1.5in;
          border-bottom: 1px solid #333;
          margin-left: 6px;
        }
        .signature {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }
        .signature img {
          max-height: 0.6in;
          object-fit: contain;
        }
        .signature-line {
          width: 2.5in;
          border-bottom: 1px solid #333;
        }
        .signature-label {
          font-size: 8px;
          letter-spacing: 0.2em;
          color: #666;
          text-transform: uppercase;
          font-family: "Helvetica Neue", Arial, sans-serif;
        }
        .meta-bar {
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: #555;
          margin-top: 0.05in;
        }
        .micr-text {
          font-family: "MICR", "Courier New", monospace;
          letter-spacing: 0.15em;
        }
        .micr {
          font-family: "MICR", "Courier New", monospace;
          font-size: 14px;
          letter-spacing: 0.18em;
          color: #000;
          text-align: center;
          border-top: 1px solid #333;
          padding-top: 8px;
          margin-top: 0.05in;
        }
        .stub {
          position: absolute;
          top: 3.75in;
          left: 0.25in;
          width: 8in;
          padding: 0.15in;
          border-top: 1px dashed #999;
          font-size: 9px;
          color: #555;
        }
        .stub-label {
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 0.1in;
        }
      </style>
    </head>
    <body>
      <div class="sheet">
        <div class="cheque">
          <div class="status">ISSUED</div>
          <div class="row">
            <div class="bank-block">
              ${corporationBlock}
              ${addressBlock}
            </div>
            <div class="bank-center">
              <h3>${cheque.bank.name}</h3>
            </div>
            <div class="meta">
              <div>Cheque #${cheque.number || "N/A"}</div>
              <div>${new Date(cheque.createdAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}</div>
            </div>
          </div>

          <div class="row">
            <div class="payee-line">
              <label class="payee-label">Pay to the Order of</label>
              <div class="payee-name">${cheque.payee.name}</div>
              <div class="payee-rule"></div>
            </div>
            <div class="amount-box">${amount}</div>
          </div>

          <div class="amount-words">${cheque.amountWords}</div>

          <div class="footer">
            <div class="memo">
              Memo:<span>${cheque.memo || "&nbsp;"}</span>
            </div>
            <div class="signature">
              ${signature}
              <div class="signature-line"></div>
              <label class="signature-label">Signature</label>
            </div>
          </div>

          <div class="meta-bar">
            <span>Issued by: ${cheque.issuedBy}</span>
            <span>Payee Type: ${cheque.payee.type}</span>
          </div>

          <div class="micr">${micr}</div>
        </div>

        <!-- Optional stub/remittance section -->
        <div class="stub">
          <div class="stub-label">Remittance Copy - Retain for Your Records</div>
          <div>Check #${cheque.number || "N/A"} | Date: ${new Date(cheque.createdAt).toLocaleDateString("en-US")} | Amount: ${amount}</div>
          <div>Pay to: ${cheque.payee.name} | Memo: ${cheque.memo || "N/A"}</div>
        </div>
      </div>
    </body>
  </html>`;
};

export async function generateChequePDF(cheque: ChequeViewModel): Promise<Buffer> {
  const executablePath = await chromium.executablePath();
  const micrFont = await getMicrFontDataUrl();
  const html = renderChequeHtml(cheque, micrFont);

  const chromiumAny = chromium as any;
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromiumAny.defaultViewport ?? null,
    executablePath: executablePath || undefined,
    headless: chromiumAny.headless ?? true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: "networkidle0",
    });

    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      scale: 1,
      margin: {
        top: "0",
        bottom: "0",
        left: "0",
        right: "0",
      },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

