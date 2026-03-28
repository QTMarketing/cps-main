"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Upload } from "lucide-react";
import { Role } from "@/lib/roles";
import NewCorporationModal from "@/components/bank/NewCorporationModal";

type BankFormState = {
  bank_name: string;
  account_number: string;
  routing_number: string;
  return_address: string;
  return_city: string;
  return_state: string;
  return_zip: string;
  account_name: string;
  dba: string;
  signature_name: string;
  account_type: string;
};

type ToastState =
  | {
      variant: "success" | "error";
      message: string;
    }
  | null;

type SignerState = {
  id: string;
  full_name: string;
  is_default: boolean;
  file: File | null;
  previewUrl?: string;
};

const initialForm: BankFormState = {
  bank_name: "",
  account_number: "",
  routing_number: "",
  return_address: "",
  return_city: "",
  return_state: "",
  return_zip: "",
  account_name: "",
  dba: "",
  signature_name: "",
  account_type: "CHECKING",
};

const fieldConfig: Array<{
  key: keyof BankFormState;
  label: string;
  autoComplete?: string;
  placeholder?: string;
}> = [
  { key: "bank_name", label: "Bank Name", autoComplete: "organization" },
  { key: "account_name", label: "Account Name", placeholder: "Primary account holder name" },
  { key: "dba", label: "Doing Business As", placeholder: "Optional DBA" },
  { key: "account_number", label: "Account Number" },
  { key: "routing_number", label: "Routing Number" },
  { key: "signature_name", label: "Signature Line", placeholder: "Displayed beneath the default signature" },
  { key: "return_address", label: "Return Address", autoComplete: "street-address" },
  { key: "return_city", label: "City", autoComplete: "address-level2" },
  { key: "return_state", label: "State", autoComplete: "address-level1" },
  { key: "return_zip", label: "ZIP Code", autoComplete: "postal-code" },
];

const allowedSignatureMime = ["image/png", "image/jpeg"];

function createSigner(id: string, defaultSigner = false): SignerState {
  return { id, full_name: "", is_default: defaultSigner, file: null };
}

type AddBankFormProps = {
  userRole: Role;
};

type Corporation = {
  id: number;
  name: string;
  owner?: string | null;
  ein?: string | null;
};

type Store = {
  id: number;
  name: string;
  code?: string;
};

export default function AddBankForm({ userRole }: AddBankFormProps) {
  const [form, setForm] = useState<BankFormState>(initialForm);
  const [signers, setSigners] = useState<SignerState[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [mounted, setMounted] = useState(false);
  const [corporations, setCorporations] = useState<Corporation[]>([]);
  const [selectedCorporationId, setSelectedCorporationId] = useState<string>("");
  const [corporationsLoading, setCorporationsLoading] = useState(false);
  const [corporationError, setCorporationError] = useState<string | null>(null);
  const [isCorpModalOpen, setIsCorpModalOpen] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [storesLoading, setStoresLoading] = useState(false);
  
  const isSuperAdmin = userRole === Role.SUPER_ADMIN;

  // Initialize signers only on client to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    if (signers.length === 0) {
      const initialId = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `signer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setSigners([createSigner(initialId, true)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadCorporations = async () => {
      try {
        setCorporationsLoading(true);
        const response = await fetch("/api/corporations", { credentials: "include" });
        if (!response.ok) {
          throw new Error("Failed to load corporations");
        }
        const data = await response.json().catch(() => ({}));
        setCorporations(data?.corporations ?? []);
        setCorporationError(null);
      } catch (error) {
        console.error(error);
        setCorporationError("Unable to load corporations. You can still create one below.");
      } finally {
        setCorporationsLoading(false);
      }
    };

    loadCorporations();
  }, []);

  // Load stores for SUPER_ADMIN
  useEffect(() => {
    if (!isSuperAdmin) return;
    
    const loadStores = async () => {
      try {
        setStoresLoading(true);
        const response = await fetch("/api/stores", { credentials: "include" });
        if (response.ok) {
          const data = await response.json();
          setStores(data?.stores ?? data ?? []);
        }
      } catch (error) {
        console.error("Failed to load stores:", error);
      } finally {
        setStoresLoading(false);
      }
    };
    
    loadStores();
  }, [isSuperAdmin]);

  const numericFields = useMemo(
    () => new Set<keyof BankFormState>(["account_number", "routing_number", "return_zip"]),
    [],
  );

  const dismissToast = useCallback(() => setToast(null), []);

  const handleBankFieldChange = useCallback((key: keyof BankFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateSignatureNameFromDefault = useCallback((nextSigners: SignerState[]) => {
    const defaultSigner = nextSigners.find((signer) => signer.is_default);
    if (defaultSigner && defaultSigner.full_name.trim()) {
      setForm((prev) => ({
        ...prev,
        signature_name: prev.signature_name.trim()
          ? prev.signature_name
          : defaultSigner.full_name.trim(),
      }));
    }
  }, []);

  const handleSignerNameChange = useCallback(
    (id: string, value: string) => {
      setSigners((prev) => {
        const next = prev.map((signer) =>
          signer.id === id ? { ...signer, full_name: value } : signer,
        );
        updateSignatureNameFromDefault(next);
        return next;
      });
    },
    [updateSignatureNameFromDefault],
  );

  const handleSignerFileChange = useCallback((id: string, file: File | null) => {
    setSigners((prev) =>
      prev.map((signer) => {
        if (signer.id !== id) return signer;
        if (signer.previewUrl) {
          URL.revokeObjectURL(signer.previewUrl);
        }
        const previewUrl = file ? URL.createObjectURL(file) : undefined;
        return { ...signer, file, previewUrl };
      }),
    );
  }, []);

  const handleToggleDefault = useCallback(
    (id: string) => {
      setSigners((prev) => {
        const next = prev.map((signer) => ({
          ...signer,
          is_default: signer.id === id,
        }));
        updateSignatureNameFromDefault(next);
        return next;
      });
    },
    [updateSignatureNameFromDefault],
  );

  const handleAddSigner = useCallback(() => {
    const newId = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `signer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setSigners((prev) => [...prev, createSigner(newId, false)]);
  }, []);

  const handleRemoveSigner = useCallback((id: string) => {
    setSigners((prev) => {
      if (prev.length === 1) return prev;
      const signerToRemove = prev.find((signer) => signer.id === id);
      if (signerToRemove?.previewUrl) {
        URL.revokeObjectURL(signerToRemove.previewUrl);
      }
      const filtered = prev.filter((signer) => signer.id !== id);
      if (!filtered.some((signer) => signer.is_default) && filtered.length > 0) {
        filtered[0].is_default = true;
      }
      updateSignatureNameFromDefault(filtered);
      return [...filtered];
    });
  }, [updateSignatureNameFromDefault]);

  const resetForm = useCallback(() => {
    setForm(initialForm);
    setSigners((prev) => {
      prev.forEach((signer) => {
        if (signer.previewUrl) {
          URL.revokeObjectURL(signer.previewUrl);
        }
      });
      const newId = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `signer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      return [createSigner(newId, true)];
    });
    setSelectedCorporationId("");
  }, []);

  const validate = useCallback((): string[] => {
    const errors: string[] = [];

    fieldConfig.forEach(({ key, label }) => {
      const value = form[key];
      if (!value || !value.trim()) {
        errors.push(`${label} is required.`);
      } else if (numericFields.has(key) && !/^\d+$/.test(value.trim())) {
        errors.push(`${label} must be numeric.`);
      }
    });

    // SUPER_ADMIN must select a store
    if (isSuperAdmin && !selectedStoreId) {
      errors.push("Store selection is required.");
    }

    if (!signers.length) {
      errors.push("At least one signatory is required.");
    }

    let defaultCount = 0;
    signers.forEach((signer, index) => {
      if (!signer.full_name.trim()) {
        errors.push(`Signatory #${index + 1} requires a full name.`);
      }
      if (!signer.file) {
        errors.push(`Signatory #${index + 1} requires a signature image.`);
      } else if (!allowedSignatureMime.includes(signer.file.type)) {
        errors.push(
          `Signatory #${index + 1} signature must be a PNG or JPEG file.`,
        );
      }
      if (signer.is_default) {
        defaultCount += 1;
      }
    });

    if (defaultCount !== 1) {
      errors.push("Exactly one signatory must be marked as default.");
    }

    return errors;
  }, [form, numericFields, signers, isSuperAdmin, selectedStoreId]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setToast(null);

      const errors = validate();
      if (errors.length) {
        setToast({ variant: "error", message: errors.join(" ") });
        return;
      }

      const formData = new FormData();
      formData.append(
        "bank",
        JSON.stringify({
          ...form,
          corporation_id: selectedCorporationId ? Number(selectedCorporationId) : null,
          storeId: selectedStoreId ? Number(selectedStoreId) : null,
        }),
      );

      const signersMeta = signers.map((signer, index) => ({
        full_name: signer.full_name.trim(),
        is_default: signer.is_default,
        file_field: `signature_${index}`,
      }));

      formData.append("signers", JSON.stringify(signersMeta));

      signers.forEach((signer, index) => {
        if (signer.file) {
          formData.append(`signature_${index}`, signer.file);
        }
      });

      setIsSubmitting(true);

      try {
        const response = await fetch("/api/banks", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({ error: "Unable to create bank." }));
          throw new Error(data?.error || "Unable to create bank.");
        }

        setToast({ variant: "success", message: "Bank created successfully." });
        resetForm();
        setSelectedCorporationId("");
      } catch (error) {
        setToast({
          variant: "error",
          message: error instanceof Error ? error.message : "Failed to create bank.",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, resetForm, signers, validate],
  );

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`rounded-md border px-4 py-3 text-sm shadow-sm transition ${
            toast.variant === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/40 bg-red-500/10 text-red-200"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <span>{toast.message}</span>
            <button
              onClick={dismissToast}
              className="text-xs font-medium uppercase tracking-wide text-slate-400 hover:text-slate-200"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <Card className="border border-slate-800 bg-slate-950/80 text-slate-100 shadow-xl backdrop-blur">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold text-slate-100">
              Bank Details
            </CardTitle>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              isSuperAdmin 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
            }`}>
              {isSuperAdmin ? 'Super Admin' : 'Admin'}
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Provide the legal and mailing information for the bank account.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {fieldConfig.map(({ key, label, autoComplete, placeholder }) => (
                <div key={key} className="flex flex-col space-y-2">
                  <Label htmlFor={key} className="text-sm font-medium text-slate-300">
                    {label}
                  </Label>
                  <Input
                    id={key}
                    autoComplete={autoComplete}
                    placeholder={placeholder}
                    inputMode={numericFields.has(key) ? "numeric" : "text"}
                    value={form[key]}
                    onChange={(event) => handleBankFieldChange(key, event.target.value)}
                    className="border-slate-800 bg-slate-900/80 text-slate-50 placeholder:text-slate-500 focus-visible:ring-slate-500"
                    required
                  />
                </div>
              ))}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="account_type" className="text-sm font-medium text-slate-300">
                  Account Type *
                </Label>
                <Select
                  value={form.account_type}
                  onValueChange={(value) => handleBankFieldChange("account_type", value)}
                  required
                >
                  <SelectTrigger className="border-slate-800 bg-slate-900/80 text-slate-50 focus:ring-slate-500">
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="CHECKING" className="text-slate-100">CHECKING</SelectItem>
                    <SelectItem value="SAVINGS" className="text-slate-100">SAVINGS</SelectItem>
                    <SelectItem value="BUSINESS" className="text-slate-100">BUSINESS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">Corporation</h3>
                  <p className="text-sm text-slate-400">
                    Link this bank to a corporation record or create a new corporation.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCorpModalOpen(true)}
                  className="border-slate-700 bg-slate-900/70 text-slate-100 hover:bg-slate-800"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Corporation
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-300">Select Corporation</Label>
                <Select
                  value={selectedCorporationId}
                  onValueChange={(value) => setSelectedCorporationId(value === "none" ? "" : value)}
                  disabled={corporationsLoading}
                >
                  <SelectTrigger className="border-slate-800 bg-slate-900/80 text-slate-50 focus:ring-slate-500">
                    <SelectValue placeholder={corporationsLoading ? "Loading..." : "Choose corporation"} />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-50">
                    {corporations.length === 0 && !corporationsLoading ? (
                      <SelectItem value="none" disabled>
                        No corporations available
                      </SelectItem>
                    ) : (
                      corporations.map((corp) => (
                        <SelectItem key={corp.id} value={String(corp.id)}>
                          {corp.name}
                          {corp.owner ? ` — ${corp.owner}` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {corporationError && (
                  <p className="text-xs text-amber-400">{corporationError}</p>
                )}
              </div>
            </div>

            {isSuperAdmin && (
              <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">Store Assignment</h3>
                  <p className="text-sm text-slate-400">
                    Assign this bank to a specific store location.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-300">Select Store *</Label>
                  <Select
                    value={selectedStoreId}
                    onValueChange={(value) => setSelectedStoreId(value)}
                    disabled={storesLoading}
                  >
                    <SelectTrigger className="border-slate-800 bg-slate-900/80 text-slate-50 focus:ring-slate-500">
                      <SelectValue placeholder={storesLoading ? "Loading stores..." : "Choose store"} />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-50">
                      {stores.length === 0 && !storesLoading ? (
                        <SelectItem value="none" disabled>
                          No stores available
                        </SelectItem>
                      ) : (
                        stores.map((store) => (
                          <SelectItem key={store.id} value={String(store.id)}>
                            {store.code ? `${store.code} - ${store.name}` : store.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">Authorized Signatories</h3>
                  <p className="text-sm text-slate-400">
                    Upload each signer's digital signature. Exactly one signer must be set as default.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddSigner}
                  className="border-slate-700 bg-slate-900/70 text-slate-100 hover:bg-slate-800"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Signer
                </Button>
              </div>

              {!mounted ? (
                <div className="text-center text-slate-400 py-8">Loading form...</div>
              ) : (
                <div className="space-y-4">
                  {signers.map((signer, index) => (
                  <div
                    key={signer.id}
                    className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 shadow-inner"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-4">
                        <div>
                          <Label
                            htmlFor={`signer-name-${signer.id}`}
                            className="text-xs font-semibold uppercase tracking-wide text-slate-400"
                          >
                            Signatory Name
                          </Label>
                          <Input
                            id={`signer-name-${signer.id}`}
                            value={signer.full_name}
                            onChange={(event) => handleSignerNameChange(signer.id, event.target.value)}
                            placeholder={`Signer #${index + 1}`}
                            className="mt-1 border-slate-800 bg-slate-950/80 text-slate-50 placeholder:text-slate-500 focus-visible:ring-slate-500"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <label
                            htmlFor={`signer-file-${signer.id}`}
                            className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-slate-700 bg-slate-950/50 px-4 py-6 text-center text-sm text-slate-400 hover:border-slate-500 hover:text-slate-200"
                          >
                            <Upload className="mb-2 h-5 w-5" />
                            <span>
                              {signer.file ? signer.file.name : "Upload signature (PNG or JPEG)"}
                            </span>
                            <Input
                              id={`signer-file-${signer.id}`}
                              name={`signature_${index}`}
                              type="file"
                              accept="image/png,image/jpeg"
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0] ?? null;
                                handleSignerFileChange(signer.id, file);
                              }}
                            />
                          </label>

                          <div className="flex items-center space-x-3 rounded-md border border-slate-800 bg-slate-950/60 px-4 py-3">
                            <input
                              id={`signer-default-${signer.id}`}
                              type="checkbox"
                              checked={signer.is_default}
                              onChange={() => handleToggleDefault(signer.id)}
                              className="h-4 w-4 accent-slate-400"
                            />
                            <Label
                              htmlFor={`signer-default-${signer.id}`}
                              className="text-sm text-slate-200"
                            >
                              Default Signatory
                            </Label>
                          </div>
                        </div>

                        {signer.previewUrl && (
                          <div className="rounded-md border border-slate-800 bg-slate-950/70 p-3">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Preview</p>
                            <img
                              src={signer.previewUrl}
                              alt={`${signer.full_name} signature preview`}
                              className="mt-2 h-24 max-w-xs rounded bg-white object-contain p-2"
                            />
                          </div>
                        )}
                      </div>

                      {signers.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleRemoveSigner(signer.id)}
                          className="text-slate-400 hover:bg-slate-800 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                className="border-slate-700 bg-slate-900/70 text-slate-100 hover:bg-slate-800"
                disabled={isSubmitting}
              >
                Reset
              </Button>
              <Button
                type="submit"
                className="bg-slate-700 text-slate-100 hover:bg-slate-600"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Create Bank"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <NewCorporationModal
        open={isCorpModalOpen}
        onClose={() => setIsCorpModalOpen(false)}
        onCreated={(corp) => {
          setCorporations((prev) => {
            if (prev.some((existing) => existing.id === corp.id)) {
              return prev;
            }
            return [...prev, corp];
          });
          setSelectedCorporationId(String(corp.id));
        }}
      />
    </div>
  );
}
