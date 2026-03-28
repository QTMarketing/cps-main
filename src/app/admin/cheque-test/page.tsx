"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

const SAMPLE_PAYLOAD = {
  bankName: "First National Bank",
  dbaName: "QT Office DBA",
  corporationName: "QuickTrack Inc.",
  address: {
    street: "123 Main Street",
    city: "Los Angeles",
    state: "CA",
    zip: "90001",
  },
  chequeNumber: "1050",
  routingNumber: "123456789",
  accountNumber: "987654321",
  merchantNumber: "M-55421",
  payeeName: "John Doe",
  amount: 1523.75,
  memo: "Invoice #4471",
  date: new Date().toLocaleDateString(),
  signatureImageURL: "/uploads/signatures/6a2f3b5b-38a8-4651-9a94-0989fac78805.jpg",
};

export default function ChequeTestPage() {
  const [jsonInput, setJsonInput] = useState(JSON.stringify(SAMPLE_PAYLOAD, null, 2));
  const [isGenerating, setIsGenerating] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleGenerate = async () => {
    setAlert(null);
    setIsGenerating(true);

    try {
      const payload = JSON.parse(jsonInput);
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("auth-token="))
        ?.split("=")[1];

      if (!token) {
        throw new Error("Authentication token not found. Please log in again.");
      }

      const res = await fetch("/api/cheque/print", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to generate cheque PDF");
      }

      const blob = await res.blob();
      const filename = payload.chequeNumber ? `cheque_${payload.chequeNumber}.pdf` : "cheque.pdf";
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setAlert({ type: "success", message: "Cheque PDF generated successfully." });
    } catch (error: any) {
      console.error("Cheque generation failed:", error);
      setAlert({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to generate cheque PDF.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cheque PDF Test</CardTitle>
          <CardDescription>
            Use this tool to validate cheque payloads and download the generated PDF. This page is
            only available to SUPER_ADMIN users.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="payload">Cheque Payload (JSON)</Label>
            <Textarea
              id="payload"
              className="font-mono text-sm min-h-[320px]"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => setJsonInput(JSON.stringify(SAMPLE_PAYLOAD, null, 2))}>
              Reset Sample
            </Button>
            <Button type="button" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Generate PDF
                </>
              )}
            </Button>
          </div>

          {alert && (
            <Alert variant={alert.type === "error" ? "destructive" : "default"}>
              {alert.type === "error" ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <AlertTitle>{alert.type === "error" ? "Error" : "Success"}</AlertTitle>
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          )}

          <div className="rounded-md bg-muted p-4 space-y-2 text-sm text-muted-foreground">
            <p className="font-semibold">Tips</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Routing numbers must be 9 digits. Account numbers must be numeric.</li>
              <li>Upload signature images via the Signatures uploader and reference the public URL.</li>
              <li>Ensure the MICR font file <code>micr-encoding.regular.ttf</code> exists in <code>/public/fonts</code> for accurate encoding.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

