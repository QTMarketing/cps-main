"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Building2, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import BankSignatureUpload from "@/components/bank/BankSignatureUpload";

// =============================================================================
// Types
// =============================================================================

type BankFormState = {
  bank_name: string;
  account_name: string;
  dba: string;
  account_number: string;
  routing_number: string;
  signature_name: string;
  account_type: string;
  return_address: string;
  return_city: string;
  return_state: string;
  return_zip: string;
  storeId: string;
};

type Store = { id: number; code: string; name: string };

const EMPTY_FORM: BankFormState = {
  bank_name: "",
  account_name: "",
  dba: "",
  account_number: "",
  routing_number: "",
  signature_name: "",
  account_type: "CHECKING",
  return_address: "",
  return_city: "",
  return_state: "",
  return_zip: "",
  storeId: "",
};

const TEXT_FIELDS: Array<{ key: keyof BankFormState; label: string; placeholder?: string; required?: boolean }> = [
  { key: "bank_name", label: "Bank Name", required: true },
  { key: "account_name", label: "Account Name", placeholder: "Primary account holder name" },
  { key: "dba", label: "Doing Business As", placeholder: "Optional DBA" },
  { key: "account_number", label: "Account Number", required: true },
  { key: "routing_number", label: "Routing Number", required: true },
  { key: "signature_name", label: "Signature Line", placeholder: "Displayed beneath the signature" },
  { key: "return_address", label: "Return Address" },
  { key: "return_city", label: "City" },
  { key: "return_state", label: "State" },
  { key: "return_zip", label: "ZIP Code" },
];

// =============================================================================
// Component
// =============================================================================

export default function EditBankPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const bankId = Number(params.id);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [form, setForm] = useState<BankFormState>(EMPTY_FORM);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const getToken = () =>
    document.cookie
      .split("; ")
      .find((r) => r.startsWith("auth-token="))
      ?.split("=")[1];

  // Load bank + stores on mount
  useEffect(() => {
    if (!bankId || isNaN(bankId)) return;

    const load = async () => {
      setLoading(true);
      const t = getToken();
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      };

      try {
        const [bankRes, storesRes] = await Promise.all([
          fetch(`/api/banks/${bankId}`, { headers, credentials: "include" }),
          isSuperAdmin
            ? fetch("/api/stores", { headers, credentials: "include" })
            : Promise.resolve(null),
        ]);

        if (!bankRes.ok) {
          showAlert("error", bankRes.status === 404 ? "Bank not found." : "Failed to load bank.");
          return;
        }

        const bank = await bankRes.json();
        setForm({
          bank_name: bank.bank_name ?? "",
          account_name: bank.account_name ?? "",
          dba: bank.dba ?? "",
          account_number: bank.account_number?.toString() ?? "",
          routing_number: bank.routing_number?.toString() ?? "",
          signature_name: bank.signature_name ?? "",
          account_type: bank.account_type ?? "CHECKING",
          return_address: bank.return_address ?? "",
          return_city: bank.return_city ?? "",
          return_state: bank.return_state ?? "",
          return_zip: bank.return_zip?.toString() ?? "",
          storeId: bank.store_id?.toString() ?? "",
        });
        setSignatureUrl(bank.signature_url ?? null);

        if (storesRes?.ok) {
          const storesData = await storesRes.json();
          setStores(storesData?.stores ?? storesData ?? []);
        }
      } catch {
        showAlert("error", "Failed to load bank details.");
      } finally {
        setLoading(false);
      }
    };

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankId]);

  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ type, message });
    if (type === "success") setTimeout(() => setAlert(null), 5000);
  };

  const handleChange = (key: keyof BankFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;

    if (!form.bank_name.trim()) {
      showAlert("error", "Bank name is required.");
      return;
    }
    if (!form.account_number.trim() || !form.routing_number.trim()) {
      showAlert("error", "Account number and routing number are required.");
      return;
    }

    setSaving(true);
    setAlert(null);

    try {
      const t = getToken();
      const body: Record<string, unknown> = {
        bank_name: form.bank_name.trim(),
        account_name: form.account_name.trim() || null,
        dba: form.dba.trim() || null,
        account_number: form.account_number.trim(),
        routing_number: form.routing_number.trim(),
        signature_name: form.signature_name.trim() || null,
        account_type: form.account_type,
        return_address: form.return_address.trim() || null,
        return_city: form.return_city.trim() || null,
        return_state: form.return_state.trim() || null,
        return_zip: form.return_zip.trim() || null,
      };

      if (form.storeId) {
        body.storeId = parseInt(form.storeId, 10);
      } else if (form.storeId === "") {
        body.storeId = null;
      }

      const res = await fetch(`/api/banks/${bankId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(t ? { Authorization: `Bearer ${t}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showAlert("error", err.error || "Failed to save changes.");
        return;
      }

      showAlert("success", "Bank updated successfully.");
    } catch {
      showAlert("error", "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  // =============================================================================
  // Render
  // =============================================================================

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <RefreshCw className="h-5 w-5 animate-spin" />
          Loading bank...
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/banks/manage")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Banks
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Building2 className="h-7 w-7 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold">Edit Bank</h1>
          <p className="text-sm text-muted-foreground">
            {isSuperAdmin ? "Update bank details and signature." : "View-only — SUPER_ADMIN access required to edit."}
          </p>
        </div>
      </div>

      {/* Alert */}
      {alert && (
        <Alert className={alert.type === "success" ? "border-green-500 bg-green-500/10" : "border-red-500 bg-red-500/10"}>
          {alert.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-500" />
          )}
          <AlertDescription className={alert.type === "success" ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}>
            {alert.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Bank Details Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bank Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Text fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {TEXT_FIELDS.map(({ key, label, placeholder, required }) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={key}>
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <Input
                    id={key}
                    value={form[key]}
                    onChange={(e) => handleChange(key, e.target.value)}
                    placeholder={placeholder}
                    disabled={!isSuperAdmin}
                  />
                </div>
              ))}
            </div>

            {/* Account Type select */}
            <div className="space-y-1.5">
              <Label htmlFor="account_type">Account Type</Label>
              <Select
                value={form.account_type}
                onValueChange={(v) => handleChange("account_type", v)}
                disabled={!isSuperAdmin}
              >
                <SelectTrigger id="account_type" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHECKING">CHECKING</SelectItem>
                  <SelectItem value="SAVINGS">SAVINGS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Store select — SUPER_ADMIN only */}
            {isSuperAdmin && stores.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="storeId">Store Assignment</Label>
                <Select
                  value={form.storeId || "none"}
                  onValueChange={(v) => handleChange("storeId", v === "none" ? "" : v)}
                >
                  <SelectTrigger id="storeId" className="w-64">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Unassigned —</SelectItem>
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.code ? `${s.code} – ${s.name}` : s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isSuperAdmin && (
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  {saving ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Signature Section */}
      <BankSignatureUpload
        bankId={bankId}
        bankName={form.dba || form.bank_name || `Bank #${bankId}`}
        currentSignatureUrl={signatureUrl}
        onSignatureUpdated={(url) => setSignatureUrl(url)}
      />
    </div>
  );
}
