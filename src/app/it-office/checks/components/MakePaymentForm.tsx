"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listVendors, listBanks, createCheck, getNextCheckNumber, updateCheckInvoiceUrl, type BankOption } from "../lib/client-data";
import { listStoresClient, type Store } from "../lib/client-fetch";
import { uploadInvoice } from "../lib/upload";
import type { PaymentMethod } from "../lib/types";
import { useDropzone } from "react-dropzone";
import { FileText, Loader2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Props = { 
  onCreated?: (newId: string) => void;
  onBankChange?: (bankId: string) => void;
  onStoreChange?: (storeId: string) => void;
  userRole?: string;
};

type Option = { id: string; name: string };

const allowedMime = ["application/pdf", "image/png", "image/jpeg"]; // pdf, png, jpg
const maxBytes = 10 * 1024 * 1024; // 10 MB

// superseded by Supabase storage upload in ../lib/upload

export default function MakePaymentForm({ onCreated, onBankChange, onStoreChange, userRole }: Props) {
  // Get user context for auto-populating store for non-SUPER_ADMIN users
  const { user } = useAuth();
  
  // form state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CHECK");
  const [bankId, setBankId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [checkNumber, setCheckNumber] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loadingCheckNumber, setLoadingCheckNumber] = useState(false);

  // options
  const [vendors, setVendors] = useState<Option[]>([]);
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  // ui state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  const isOfficeAdmin = userRole === 'OFFICE_ADMIN';
  const isStoreScopedRole = userRole === 'STORE_USER' || userRole === 'USER';
  const isAdminLikeRole =
    userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || userRole === 'OFFICE_ADMIN';
  const shouldLockBankSelection = isAdminLikeRole && !!storeId;

  // Auto-populate storeId for non-SUPER_ADMIN users from their assigned store
  useEffect(() => {
    if (!isSuperAdmin && user?.storeId && !storeId) {
      const userStoreIdString = String(user.storeId);
      setStoreId(userStoreIdString);
      onStoreChange?.(userStoreIdString);
      console.log('[MakePaymentForm] Auto-populated storeId for user:', userStoreIdString);
    }
  }, [user, isSuperAdmin, storeId, onStoreChange]);

  // load stores for SUPER_ADMIN / OFFICE_ADMIN on mount
  useEffect(() => {
    if (isSuperAdmin || isOfficeAdmin) {
      (async () => {
        setLoadingOptions(true);
        try {
          const s = await listStoresClient();
          setStores(s);
          console.log('[MakePaymentForm] Loaded stores:', s.length, 'stores');
          if (s.length === 1 && !storeId) {
            setStoreId(s[0].id);
            onStoreChange?.(s[0].id);
          }
        } catch (error) {
          console.error("Failed to load stores:", error);
          setOptionsError('Failed to load stores. Please reload.');
        } finally {
          setLoadingOptions(false);
        }
      })();
    }
  }, [isSuperAdmin, isOfficeAdmin]);

  // load banks when storeId changes (or initially)
  useEffect(() => {
    // For non-super admins, storeId is usually fixed
    // For super admins, it's whatever they select
    (async () => {
      setLoadingOptions(true);
      setOptionsError(null);
      try {
        const b = await listBanks(storeId || undefined);
        setBanks(b);
        console.log('[MakePaymentForm] Loaded banks for store:', storeId || 'all', b.length, 'found');

        // Auto-pick only when there is exactly one option (or no current selection).
        if (b.length === 1 && (!bankId || bankId !== b[0].id)) {
          const preferredId = b[0].id;
          setBankId(preferredId);
          onBankChange?.(preferredId);
        } else if (b.length === 0) {
          setBankId("");
          onBankChange?.("");
        }
      } catch (error) {
        console.error("Failed to load banks:", error);
        setOptionsError('Failed to load banks. Please reload.');
      } finally {
        setLoadingOptions(false);
      }
    })();
  }, [storeId, bankId, onBankChange]);

  // Reload vendors when selected bank changes
  useEffect(() => {
    if (!bankId) {
      setVendors([]);
      setVendorId("");
      return;
    }
    let cancelled = false;
    (async () => {
      const v = await listVendors(bankId);
      if (!cancelled) setVendors(v);
    })();
    return () => { cancelled = true; };
  }, [bankId]);

  // Maintain bank on non-CASH; clear bank on CASH
  useEffect(() => {
    if (paymentMethod === 'CASH') {
      setBankId("");
    }
  }, [paymentMethod]);

  // Auto-fetch check number: requires storeId
  useEffect(() => {
    const fetchNext = async () => {
      // For non-cash, require storeId
      if (paymentMethod !== 'CASH' && !storeId) {
        setCheckNumber("");
        return;
      }
      setLoadingCheckNumber(true);
      try {
        const num = await getNextCheckNumber(paymentMethod === 'CASH' ? undefined : storeId);
        setCheckNumber(String(num));
      } catch {
        setCheckNumber("");
      } finally {
        setLoadingCheckNumber(false);
      }
    };
    fetchNext();
  }, [paymentMethod, storeId]);

  // file dropzone
  const onDrop = useCallback((accepted: File[]) => {
    if (!accepted?.length) return;
    const f = accepted[0];
    setFile(f);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { "application/pdf": [".pdf"], "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"] },
    maxSize: maxBytes,
  });

  // validation helpers
  const validate = (): string[] => {
    const errs: string[] = [];
    if (!paymentMethod) errs.push("Payment method is required");
    if (isSuperAdmin && !storeId) errs.push("Store is required for SUPER_ADMIN");
    if (paymentMethod !== 'CASH' && !bankId) errs.push("Bank is required");
    if (paymentMethod === 'CHECK' && !checkNumber) errs.push("Check Number is required");
    if (!vendorId) errs.push("Vendor is required");
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) errs.push("Amount must be a number > 0");
    // 2 decimal places
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) errs.push("Amount must have at most 2 decimals");
    // Role-based amount limit for CHECK
    if (paymentMethod === 'CHECK') {
      const amtNum = Number(amount);
      if (userRole === 'USER' && amtNum > 2000) {
        errs.push("Amount exceeds your limit of $2,000.00 per check.");
      } else if (userRole === 'ADMIN' && amtNum > 5000) {
        errs.push("Amount exceeds your limit of $5,000.00 per check.");
      }
    }
    if (!file) errs.push("Invoice file is required");
    if (file) {
      if (!allowedMime.includes(file.type)) errs.push("File must be PDF, JPG, or PNG");
      if (file.size > maxBytes) errs.push("File size must be <= 10 MB");
    }
    if (memo && memo.length > 256) errs.push("Memo max 256 characters");
    return errs;
  };

  const onSubmit = async () => {
    setError(null);
    const errs = validate();
    if (errs.length) { setError(errs.join("\n")); return; }

    try {
      setSubmitting(true);
      
      // For CASH payments, use first available bank as placeholder (bankId is required in schema)
      // UI hides bank field for CASH, but we need a valid bankId for the database
      const effectiveBankId = paymentMethod === 'CASH' 
        ? (banks.length > 0 ? banks[0].id : bankId)
        : bankId;
      
      if (!effectiveBankId) {
        throw new Error("Bank is required. Please add a bank first.");
      }

      // Create check first
      const selectedVendor = vendors.find(v => v.id === vendorId);

      const res = await createCheck({
        paymentMethod,
        bankId: effectiveBankId,
        vendorId,
        payeeName: selectedVendor?.name,
        amount: amount, // Send as string, API converts to cents to avoid floating-point errors
        memo: memo || undefined,
        storeId: storeId || undefined,
      });
      if (!res.ok || !res.id) {
        throw new Error(res.error || "Failed to create check");
      }

      // Upload file after check creation (use referenceNumber or checkNumber from response)
      if (!file) {
        throw new Error("Invoice file is required");
      }
      
      // Use referenceNumber from API response or fallback to checkNumber
      const checkNum = (res as any).referenceNumber || String(res.checkNumber || checkNumber || 'unknown');
      const invoiceUrl = await uploadInvoice(file, { checkNumber: checkNum });
      
      // Update check with invoice URL
      const updateRes = await updateCheckInvoiceUrl(res.id!, invoiceUrl);
      if (!updateRes.ok) {
        console.warn("Failed to update invoice URL:", updateRes.error);
        // Don't fail the whole operation, just warn
      }

      // Show the ACTUAL check number that was created (from DB response)
      const actualCheckNumber = res.checkNumber;
      if (actualCheckNumber) {
        setCheckNumber(String(actualCheckNumber));
      }

      // Success message
      const paymentLabel = paymentMethod === 'EDI' ? 'EDI payment'
        : paymentMethod === 'CASH' ? 'Cash payment'
        : paymentMethod === 'MO' ? 'Money order'
        : `Check #${actualCheckNumber || checkNum}`;
      toast.success(`${paymentLabel} created successfully`);
      
      // Signal RecentChecks to refresh
      setTimeout(() => {
        try { window.dispatchEvent(new CustomEvent('checks:refresh')); } catch {}
      }, 500);
      onCreated?.(res.id);

      // Re-fetch next check number for this store (CHECK only)
      if (paymentMethod === 'CHECK' && storeId) {
        try {
          const nextNum = await getNextCheckNumber(storeId);
          setCheckNumber(String(nextNum));
        } catch (err) {
          console.error("Failed to fetch next check number:", err);
        }
      } else {
        setCheckNumber("");
      }

      // Reset other fields (but keep bankId and paymentMethod for convenience)
      setVendorId("");
      setAmount("");
      setMemo("");
      setFile(null);
    } catch (e: any) {
      console.error("Check creation error:", e);
      const message = e?.message || String(e) || "Failed to create check. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // currency mask on blur - format to 2 decimals without float conversion
  const formatAmount = () => {
    if (!amount) return;
    // Parse string directly to avoid floating-point precision issues
    const trimmed = amount.trim();
    if (!trimmed) return;
    
    // Validate it's a valid number format
    if (!/^\d+\.?\d*$/.test(trimmed)) return;
    
    // Add .00 if no decimal, or pad to 2 decimal places
    if (!trimmed.includes('.')) {
      setAmount(trimmed + '.00');
    } else {
      const parts = trimmed.split('.');
      const decimals = parts[1] || '';
      if (decimals.length === 0) {
        setAmount(trimmed + '00');
      } else if (decimals.length === 1) {
        setAmount(trimmed + '0');
      } else if (decimals.length > 2) {
        // Truncate to 2 decimals (don't round, just cut off)
        setAmount(parts[0] + '.' + decimals.substring(0, 2));
      }
      // If already 2 decimals, leave as is
    }
  };

  const paymentOptions: { label: string; value: PaymentMethod }[] = useMemo(() => ([
    { label: "Check", value: "CHECK" },
    { label: "EDI", value: "EDI" },
    { label: "MO", value: "MO" },
    { label: "Cash", value: "CASH" },
  ]), []);

  return (
    <Card className="bg-background">
      <CardHeader>
        <CardTitle>Make a Payment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {(error || optionsError) && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 text-red-300 p-3 whitespace-pre-line">
            {error || optionsError}
          </div>
        )}

        {/* Store dropdown (SUPER_ADMIN always; OFFICE_ADMIN if multiple stores) */}
        {(isSuperAdmin || (isOfficeAdmin && stores.length > 1)) && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Store *</label>
            <Select 
              value={storeId} 
              onValueChange={(value) => {
                setStoreId(value);
                onStoreChange?.(value);
              }} 
              disabled={loadingOptions}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingOptions ? "Loading stores..." : (stores.length ? "Select a store" : "No stores available")} />
              </SelectTrigger>
              <SelectContent>
                {stores.length === 0 && !loadingOptions ? (
                  <SelectItem value="no-stores" disabled>No stores available</SelectItem>
                ) : (
                  stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                )}
              </SelectContent>
            </Select>
            {stores.length === 0 && !loadingOptions && (
              <p className="text-xs text-muted-foreground">No stores found. Contact administrator.</p>
            )}
          </div>
        )}

        {/* Payment method (radio) */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Payment Method</label>
          <div className="grid grid-cols-4 gap-2">
            {paymentOptions.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPaymentMethod(opt.value)}
                className={`px-3 py-2 rounded-md border text-sm ${paymentMethod === opt.value ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground border-border'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bank (hidden for CASH) */}
        {paymentMethod !== 'CASH' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Bank *</label>
            <Select
              value={bankId}
              onValueChange={(value) => {
                setBankId(value);
                onBankChange?.(value);
              }}
              disabled={loadingOptions || shouldLockBankSelection}
            >
              {/* Trigger: show condensed summary of the selected bank */}
              <SelectTrigger className="h-auto min-h-10 py-2">
                {bankId ? (
                  (() => {
                    const sel = banks.find(b => b.id === bankId);
                    return sel ? (
                      <div className="flex items-center justify-between w-full pr-1 gap-2">
                        <span className="text-sm font-medium truncate">
                          {sel.storeName || 'Unassigned Store'} — {sel.name}
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {sel.accountType || 'CHECKING'} ···{sel.last4 || '····'}
                        </span>
                      </div>
                    ) : (
                      <SelectValue placeholder="Select a bank" />
                    );
                  })()
                ) : (
                  <SelectValue placeholder={loadingOptions ? "Loading banks..." : (banks.length ? "Select a bank" : "No banks available")} />
                )}
              </SelectTrigger>

              {/* Dropdown: rich two-line items */}
              <SelectContent>
                {banks.length === 0 && !loadingOptions ? (
                  <SelectItem value="no-banks" disabled>No banks available</SelectItem>
                ) : (
                  banks.map(b => (
                    <SelectItem
                      key={b.id}
                      value={b.id}
                      // textValue used for keyboard typeahead (single string)
                      textValue={`${b.storeName || 'Unknown Store'} ${b.name} ${b.accountType} ${b.last4}`}
                      className="py-2"
                    >
                      <div className="flex flex-col gap-0.5 w-full">
                        {/* Row 1: store name (left) + account type + last4 (right) */}
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-medium text-sm leading-tight">
                            {b.storeName || 'Unassigned Store'}
                          </span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {b.accountType || 'CHECKING'} ···{b.last4 || '····'}
                          </span>
                        </div>
                        {/* Row 2: bank name */}
                        <span className="text-xs text-muted-foreground leading-tight">
                          {b.name}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {banks.length === 0 && !loadingOptions && (
              <p className="text-xs text-muted-foreground">Please add banks in the Add Bank section first.</p>
            )}
          </div>
        )}

        {/* Check Number (auto-assigned, read-only). Only shown for CHECK payments. */}
        {paymentMethod === 'CHECK' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Check Number</label>
            <Input 
              placeholder={loadingCheckNumber ? "Loading..." : "Auto-assigned"} 
              value={checkNumber} 
              readOnly 
              disabled={loadingCheckNumber || !bankId}
              className="bg-muted"
            />
            {bankId && !loadingCheckNumber && checkNumber && (
              <p className="text-xs text-muted-foreground">Next check number for selected bank</p>
            )}
          </div>
        )}

        {/* Vendor */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Vendor</label>
          <Select
            value={vendorId}
            onValueChange={setVendorId}
            disabled={!bankId}
          >
            <SelectTrigger>
              <SelectValue placeholder={bankId ? "Select a vendor" : "Select a bank first"} />
            </SelectTrigger>
            <SelectContent>
              {vendors.length === 0 && bankId && (
                <div className="px-2 py-3 text-sm text-muted-foreground text-center">No vendors assigned to this bank</div>
              )}
              {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>


        {/* Amount */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Amount</label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={formatAmount}
          />
        </div>

        {/* Memo */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Memo (optional)</label>
          <Textarea rows={3} placeholder="Optional memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>

        {/* File drag-drop */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Invoice File * (PDF/JPG/PNG, max 10MB)</label>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-md p-4 text-center cursor-pointer ${isDragActive ? 'border-primary' : 'border-border'}`}
          >
            <input {...getInputProps()} />
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <FileText className="h-4 w-4" />
              {isDragActive ? 'Drop the file here...' : 'Drag & drop file here, or click to select'}
            </div>
          </div>
          {file && (
            <div className="inline-flex items-center gap-2 mt-2 px-2 py-1 rounded-full bg-muted text-foreground text-sm">
              <span className="truncate max-w-[220px]">{file.name}</span>
              <button type="button" className="hover:text-red-500" onClick={() => setFile(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={onSubmit} disabled={submitting || (!bankId && paymentMethod !== 'CASH' && banks.length === 0) || (!checkNumber && paymentMethod === 'CHECK') || !vendorId || !amount || !file}>
            {submitting
              ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>)
              : paymentMethod === 'EDI' ? 'Send EDI'
              : paymentMethod === 'CASH' ? 'Record Cash'
              : paymentMethod === 'MO' ? 'Submit MO'
              : 'Create Check'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


