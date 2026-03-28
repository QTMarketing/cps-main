"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onClose: () => void;
  invoiceUrl: string;
  checkNumber?: string | null;
};

export default function InvoicePreviewModal({ open, onClose, invoiceUrl, checkNumber }: Props) {
  const [isPdf, setIsPdf] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceUrl) return;
    setIsPdf(/\.pdf($|\?)/i.test(invoiceUrl) || invoiceUrl.toLowerCase().includes('application/pdf'));
    setLoading(true);
    setError(null);
  }, [invoiceUrl]);

  return (
    <Dialog open={open} onOpenChange={(o)=>{ if(!o) onClose(); }}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Invoice {checkNumber ? `for #${checkNumber}` : ''}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden p-6 pt-0">
          {loading && !error && (
            <div className="text-sm text-muted-foreground mb-2">Loading preview...</div>
          )}
          {error && (
            <div className="text-sm text-destructive mb-2">{error}</div>
          )}
          <div className="w-full h-full border rounded overflow-hidden bg-background">
            {!invoiceUrl ? (
              <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                No invoice to preview
              </div>
            ) : isPdf ? (
              <iframe
                src={invoiceUrl}
                className="w-full h-full"
                onLoad={() => setLoading(false)}
                onError={()=>{ setError('Failed to load PDF'); setLoading(false); }}
              />
            ) : (
              <img
                src={invoiceUrl || undefined}
                alt="Invoice"
                className="object-contain w-full h-full bg-black/5"
                onLoad={() => setLoading(false)}
                onError={()=>{ setError('Failed to load image'); setLoading(false); }}
              />
            )}
          </div>
          <div className="pt-4 flex justify-end">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


