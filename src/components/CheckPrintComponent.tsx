"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Printer, Eye, Download } from "lucide-react";
import ChequePreview from "@/components/cheques/ChequePreview";
import { ChequeViewModel } from "@/lib/cheques/types";

interface CheckSummary {
  id: string;
  referenceNumber?: string | number | null;
  checkNumber?: string | number | null;
}

interface CheckPrintProps {
  check: CheckSummary;
  onPrint?: () => void;
}

export default function CheckPrint({ check, onPrint }: CheckPrintProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [detail, setDetail] = useState<ChequeViewModel | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Refs to track current print iframe and blob URL for cleanup
  const printIframeRef = useRef<HTMLIFrameElement | null>(null);
  const printBlobUrlRef = useRef<string | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      setIsDetailLoading(true);
      setDetailError(null);
      const res = await fetch(`/api/checks/${check.id}`, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Unable to load cheque details");
      }
      const data = await res.json();
      setDetail(data);
    } catch (err) {
      console.error(err);
      setDetailError(err instanceof Error ? err.message : "Failed to load cheque");
    } finally {
      setIsDetailLoading(false);
    }
  }, [check.id]);

  // Cleanup function for previous print iframe and blob URL
  const cleanupPrintResources = useCallback(() => {
    if (printIframeRef.current) {
      try {
        document.body.removeChild(printIframeRef.current);
      } catch (e) {
        // Iframe may have already been removed
      }
      printIframeRef.current = null;
    }
    if (printBlobUrlRef.current) {
      URL.revokeObjectURL(printBlobUrlRef.current);
      printBlobUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isPreviewOpen) {
      fetchDetail();
    }
  }, [isPreviewOpen, fetchDetail]);

  useEffect(() => {
    setDetail(null);
    setDetailError(null);
  }, [check.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupPrintResources();
    };
  }, [cleanupPrintResources]);

  const downloadPdf = () => {
    console.log("[DOWNLOAD] Initiating download:", `/api/checks/${check.id}/pdf?download=1`);
    
    // Create a temporary link and click it
    const link = document.createElement("a");
    link.href = `/api/checks/${check.id}/pdf?download=1`;
    link.download = ""; // Let server set filename via Content-Disposition
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    onPrint?.();
  };

  const printCheck = async () => {
    console.log("[PRINT] click", check.id);
    
    try {
      // Cleanup any previous print iframe/blob before starting new print
      cleanupPrintResources();
      
      // Fetch PDF blob with credentials
      console.log(`[PRINT] Fetching PDF from /api/checks/${check.id}/pdf`);
      const res = await fetch(`/api/checks/${check.id}/pdf`, {
        credentials: "include",
        cache: "no-store",
      });
      
      const contentType = res.headers.get("content-type") || "unknown";
      console.log(`[PRINT] PDF fetch status: ${res.status}, content-type: ${contentType}`);
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error');
        console.error(`[PRINT] PDF fetch failed (${res.status}):`, errorText);
        
        // User-visible error messages for specific status codes
        if (res.status === 401 || res.status === 403) {
          alert(`Authentication issue: ${errorText}\n\nPlease log in again.`);
        } else if (res.status === 404) {
          alert(`PDF endpoint not found (404): ${errorText}\n\nThe route may be missing on the server.`);
        } else if (res.status === 500) {
          alert(`Server error (500): ${errorText}\n\nPlease try again or contact support.`);
        } else {
          alert(`Failed to generate PDF (${res.status}): ${errorText}`);
        }
        return;
      }
      
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      printBlobUrlRef.current = blobUrl;
      
      console.log("[PRINT] Creating hidden iframe for printing");
      
      // Create hidden iframe for printing
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      printIframeRef.current = iframe;
      
      let iframeLoaded = false;
      let fallbackTriggered = false;
      
      // Fallback function to open PDF in new tab
      const triggerFallback = () => {
        if (fallbackTriggered) return;
        fallbackTriggered = true;
        
        console.log("[PRINT] Iframe print blocked or failed, using fallback");
        window.open(`/api/checks/${check.id}/pdf`, "_blank", "noopener,noreferrer");
        alert("Auto-print was blocked. The PDF opened in a new tab — press Ctrl+P to print.");
      };
      
      // Set up timeout to detect if iframe doesn't load
      const loadTimeout = setTimeout(() => {
        if (!iframeLoaded) {
          console.log("[PRINT] Iframe onload timeout (2000ms)");
          triggerFallback();
        }
      }, 2000);
      
      // Wait for PDF to fully load before printing
      iframe.onload = () => {
        iframeLoaded = true;
        clearTimeout(loadTimeout);
        
        console.log("[PRINT] Iframe loaded, attempting to print");
        
        setTimeout(() => {
          try {
            if (!iframe.contentWindow) {
              throw new Error("contentWindow is null");
            }
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            console.log("[PRINT] Print dialog triggered successfully");
          } catch (printError) {
            console.error('[PRINT] print() threw error:', printError);
            triggerFallback();
          }
        }, 500); // Brief delay to ensure rendering
      };
      
      // Set src AFTER setting onload handler
      iframe.src = blobUrl;
      
      // Do NOT auto-cleanup with setTimeout
      // Cleanup only happens on:
      // 1. Next print (cleanupPrintResources called above)
      // 2. Component unmount (useEffect cleanup)
      
      onPrint?.();
    } catch (error) {
      console.error('[PRINT] Unexpected error:', error);
      alert(`Unable to print cheque: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try downloading the PDF instead.`);
    }
  };

  const chequeLabel = detail?.number || check.referenceNumber || check.checkNumber || "N/A";

  return (
    <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="mr-2 h-4 w-4" />
          Preview
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Cheque Preview #{chequeLabel}</DialogTitle>
          <DialogDescription>
            Review the cheque layout. Use the actions below to print or download a PDF copy.
          </DialogDescription>
        </DialogHeader>

        <ChequePreview cheque={detail} isLoading={isDetailLoading} error={detailError} />

        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
            Close Preview
          </Button>
          <Button type="button" onClick={() => downloadPdf()}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
          <Button type="button" onClick={() => printCheck()}>
            <Printer className="mr-2 h-4 w-4" />
            Print Check
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

