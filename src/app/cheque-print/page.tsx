"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const samplePayload = {
  bankName: "Commercial Bank of Texas",
  dbaName: "LP Food Mart",
  address: {
    street: "609 Bellaire Dr",
    city: "Hurst",
    state: "TX",
    zip: "76053",
  },
  chequeNumber: "51682",
  routingNumber: "051682031",
  accountNumber: "1143102741",
  merchantNumber: "123456",
  payeeName: "Jit Bahadur Tamang",
  amount: 100.0,
  memo: "PAINTING",
  date: "2025-10-29",
  signatureImageURL: "/uploads/signatures/pasang_lama.png",
};

export default function ChequePrintPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePrint = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/cheque/print", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(samplePayload),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson?.error || "Failed to generate cheque PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cheque_${samplePayload.chequeNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || "Failed to print cheque");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Cheque Print</h1>
        <p className="text-muted-foreground">
          Click the button below to generate a cheque PDF using the sample payload.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 text-red-300 p-3">
          {error}
        </div>
      )}

      <Button onClick={handlePrint} disabled={loading}>
        {loading ? "Generating..." : "Print Cheque"}
      </Button>
    </div>
  );
}

