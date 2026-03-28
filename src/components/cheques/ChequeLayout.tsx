"use client";

import { cn } from "@/lib/utils";
import { ChequeViewModel } from "@/lib/cheques/types";
import { useEffect, useState } from "react";

interface Props {
  cheque: ChequeViewModel;
  className?: string;
}

// Helper function to check if signature format is supported
function isSignatureSupported(url: string | null | undefined): boolean {
  if (!url) return false;
  
  const lowerUrl = url.toLowerCase();
  // TIFF/TIF is not supported in browsers or most PDF renderers
  if (lowerUrl.endsWith('.tif') || lowerUrl.endsWith('.tiff')) {
    return false;
  }
  
  return true;
}

// Helper function to normalize signature URL
function normalizeSignatureUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  // Check if format is supported first
  if (!isSignatureSupported(url)) {
    return null;
  }
  
  // Remove localhost references in production
  if (url.startsWith("http://localhost:") || url.startsWith("https://localhost:")) {
    url = url.replace(/^https?:\/\/localhost:\d+/, "");
  }
  
  // If already an absolute URL (starts with http:// or https://), return as is
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  
  // Ensure leading slash for relative paths
  if (!url.startsWith("/")) {
    url = "/" + url;
  }
  
  // If it's a relative URL starting with /, convert to absolute using current origin
  if (url.startsWith("/")) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}${url}`;
    }
    // Server-side: use environment variable or default
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return `${baseUrl}${url}`;
  }
  
  return url;
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const formatDate = (input: string) =>
  new Date(input).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const normalizeDigits = (value: string, length: number) =>
  value.replace(/\D/g, "").padStart(length, "0");

export const buildMicrFromCheque = (cheque: ChequeViewModel) => {
  const number = normalizeDigits(cheque.number, 6);
  const routing = normalizeDigits(cheque.bank.routingNumber, 9);
  const account = normalizeDigits(cheque.bank.accountNumber, 9);
  return `⛓ ${number}     ${routing}     ${account}`;
};

export function ChequeLayout({ cheque, className }: Props) {
  const [signatureError, setSignatureError] = useState(false);
  const [presignedUrl, setPresignedUrl] = useState<string | null>(null);
  const corporation = cheque.bank.corporation;
  
  // Fetch presigned URL for S3 signatures
  useEffect(() => {
    // Reset state
    setPresignedUrl(null);
    setSignatureError(false);
    
    console.log('[ChequeLayout DEBUG] Bank ID:', cheque.bank.id);
    console.log('[ChequeLayout DEBUG] Raw signatureUrl:', cheque.bank.signatureUrl);
    
    // If no signature URL, nothing to fetch
    if (!cheque.bank.signatureUrl) {
      console.log('[ChequeLayout DEBUG] No signatureUrl provided');
      return;
    }
    
    // If not an S3 key, try to use it directly (legacy support)
    if (!cheque.bank.signatureUrl.startsWith('signatures/')) {
      console.log('[ChequeLayout DEBUG] Not an S3 key, using direct URL');
      const normalized = normalizeSignatureUrl(cheque.bank.signatureUrl);
      console.log('[ChequeLayout DEBUG] Normalized URL:', normalized);
      setPresignedUrl(normalized);
      return;
    }
    
    console.log('[ChequeLayout DEBUG] S3 key detected, fetching presigned URL from API');
    // It's an S3 key - fetch presigned URL from API
    fetch(`/api/banks/${cheque.bank.id}/signature-url`, { 
      credentials: 'include' 
    })
      .then(r => {
        console.log('[ChequeLayout DEBUG] API response status:', r.status);
        if (!r.ok) throw new Error('Failed to fetch signature URL');
        return r.json();
      })
      .then(data => {
        console.log('[ChequeLayout DEBUG] API response data:', data);
        if (data.url) {
          console.log('[ChequeLayout DEBUG] Setting presignedUrl:', data.url);
          setPresignedUrl(data.url);
        } else {
          console.log('[ChequeLayout DEBUG] No URL in API response');
        }
      })
      .catch(err => {
        console.warn('[ChequeLayout] Failed to load signature URL:', err);
        setSignatureError(true);
      });
  }, [cheque.bank.id, cheque.bank.signatureUrl]);
  
  // Check if original signature was TIFF (for silent warning)
  useEffect(() => {
    if (cheque.bank.signatureUrl && !isSignatureSupported(cheque.bank.signatureUrl)) {
      console.warn(
        `Signature format not supported for display: ${cheque.bank.signatureUrl}. ` +
        `Supported formats: PNG, JPG, GIF, WEBP. Cheque will print without signature image.`
      );
    }
  }, [cheque.bank.signatureUrl]);
  
  return (
    <div className={cn("cheque-container", className)}>
      <span className="cheque-status">ISSUED</span>

      <div className="cheque-section items-start">
        <div className="bank-block space-y-1">
          {corporation ? (
            <>
              <p className="bank-account-line bank-account-name">{corporation.name}</p>
              {corporation.owner && (
                <p className="bank-account-line">Owner: {corporation.owner}</p>
              )}
              {corporation.ein && (
                <p className="bank-account-line">EIN: {corporation.ein}</p>
              )}
            </>
          ) : (
            <>
              {cheque.bank.accountName && (
                <p className="bank-account-line bank-account-name">{cheque.bank.accountName}</p>
              )}
              {cheque.bank.dba && <p className="bank-account-line bank-dba">{cheque.bank.dba}</p>}
            </>
          )}
          {cheque.bank.addressLine1 && (
            <p className="bank-account-line">{cheque.bank.addressLine1}</p>
          )}
          {cheque.bank.cityStateZip && (
            <p className="bank-account-line">{cheque.bank.cityStateZip}</p>
          )}
        </div>
        <div className="flex-1 text-center">
          <h3 className="bank-center-name">{cheque.bank.name}</h3>
        </div>
        <div className="cheque-meta text-right">
          <div>Cheque #{cheque.number || "N/A"}</div>
          <div>{formatDate(cheque.createdAt)}</div>
        </div>
      </div>

      <div className="cheque-section">
        <div className="payee-line">
          <label className="payee-label">Pay to the Order of</label>
          <div className="payee-name">{cheque.payee.name}</div>
          <div className="payee-rule" />
        </div>
        <div className="amount-box">{currency.format(cheque.amount)}</div>
      </div>

      <div className="amount-words">{cheque.amountWords}</div>

      <div className="cheque-footer">
        <div className="cheque-memo">
          Memo:
          <span>{cheque.memo || "\u00A0"}</span>
        </div>
        <div className="signature-container">
          {presignedUrl && !signatureError ? (
            <img 
              src={presignedUrl} 
              alt="Authorized signature"
              onError={(e) => {
                // Silently handle error - don't block printing
                console.error('[ChequeLayout DEBUG] Image failed to load:', presignedUrl);
                console.error('[ChequeLayout DEBUG] Image error event:', e);
                setSignatureError(true);
              }}
              onLoad={(e) => {
                console.log('[ChequeLayout DEBUG] Image loaded successfully:', presignedUrl);
                const img = e.target as HTMLImageElement;
                console.log('[ChequeLayout DEBUG] Image natural dimensions:', img.naturalWidth, 'x', img.naturalHeight);
                console.log('[ChequeLayout DEBUG] Image display dimensions:', img.width, 'x', img.height);
                setSignatureError(false);
              }}
              style={{ maxWidth: "100%", height: "auto", maxHeight: "60px" }}
            />
          ) : (
            console.log('[ChequeLayout DEBUG] Not rendering img: presignedUrl=', presignedUrl, 'signatureError=', signatureError),
            null
          )}
          <div className="signature-line" />
          <div className="signature-label">Authorized Signature</div>
        </div>
      </div>

      <div className="micr-line">{buildMicrFromCheque(cheque)}</div>
    </div>
  );
}

