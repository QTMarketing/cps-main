"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BankSignatureUpload from "@/components/bank/BankSignatureUpload";

type Bank = {
  id: number;
  bank_name: string;
  dba: string | null;
  signature_url: string | null;
  account_type: string;
};

export default function BankSettingsPage() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBanks = async () => {
      try {
        const response = await fetch("/api/banks", {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to load banks");
        }

        const data = await response.json();
        // Handle both array and {banks: [...]} formats
        if (Array.isArray(data)) {
          setBanks(data);
        } else if (data.banks && Array.isArray(data.banks)) {
          setBanks(data.banks);
        } else {
          setBanks([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load banks");
      } finally {
        setLoading(false);
      }
    };

    loadBanks();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-bold mb-8">Bank Settings</h1>
          <div className="text-center text-slate-400 py-12">Loading banks...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-bold mb-8">Bank Settings</h1>
          <Card className="border border-red-500/40 bg-red-500/10">
            <CardContent className="pt-6">
              <p className="text-red-200">{error}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (banks.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-bold mb-8">Bank Settings</h1>
          <Card className="border border-slate-800 bg-slate-950/80">
            <CardContent className="pt-6">
              <p className="text-slate-400 text-center">No banks found. Please add a bank first.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Bank Settings</h1>
          <p className="text-slate-400">
            Manage authorized signatures for your banks. Each signature will be used on all checks drawn from that bank.
          </p>
        </div>

        <div className="space-y-6">
          {banks.map((bank) => (
            <div key={bank.id}>
              <BankSignatureUpload
                bankId={bank.id}
                bankName={bank.dba || bank.bank_name}
                currentSignatureUrl={bank.signature_url}
                onSignatureUpdated={(url) => {
                  // Update local state
                  setBanks((prev) =>
                    prev.map((b) =>
                      b.id === bank.id ? { ...b, signature_url: url } : b
                    )
                  );
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
