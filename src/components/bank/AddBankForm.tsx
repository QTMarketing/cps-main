"use client";

import { useMemo, useState } from "react";
import NewCorporationModal from "@/components/bank/NewCorporationModal";
import { toast } from "sonner";

type Corporation = { id: number; name: string };

type Props = {
  corporations?: Corporation[];
  onCreated?: (newId: string) => void;
};

export default function AddBankForm({ corporations = [], onCreated }: Props) {
  // Left column fields
  const [bankName, setBankName] = useState("");
  const [dba, setDba] = useState("");
  const [accountName, setAccountName] = useState("");
  const [routing, setRouting] = useState("");
  const [account, setAccount] = useState("");
  const [signatureId, setSignatureId] = useState("");

  // Right column fields
  const [corporationId, setCorporationId] = useState<string>("");
  const [addr1, setAddr1] = useState("");
  const [addr2, setAddr2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCorpModal, setShowCorpModal] = useState(false);
  const [corpList, setCorpList] = useState<Corporation[]>(corporations);

  const token = useMemo(() => {
    if (typeof document === "undefined") return undefined;
    return document.cookie.split("; ").find((r) => r.startsWith("auth-token="))?.split("=")[1];
  }, []);

  const inputClass =
    "w-full bg-gray-800/70 border border-gray-700 rounded-md px-3 py-2 text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-600";
  const labelClass = "text-sm text-gray-300";

  const validate = () => {
    const errs: string[] = [];
    if (!bankName.trim()) errs.push("Bank Name is required");
    if (!accountName.trim()) errs.push("Account Name is required");
    if (!routing.trim()) errs.push("Routing is required");
    if (!account.trim()) errs.push("Account is required");
    if (!signatureId.trim()) errs.push("Signature ID is required");
    if (!addr1.trim()) errs.push("Address 1 is required");
    if (!city.trim()) errs.push("City is required");
    if (!state.trim()) errs.push("State is required");
    if (!zip.trim()) errs.push("Zip is required");
    return errs;
  };

  const handleSubmit = async () => {
    setError(null);
    const errs = validate();
    if (errs.length) {
      setError(errs.join("\n"));
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        bankName,
        dba,
        accountName,
        routingNumber: routing,
        accountNumber: account,
        signatureId,
        corporationId: corporationId || null,
        returnAddress: {
          address1: addr1,
          address2: addr2 || null,
          city,
          state,
          zip,
        },
      } as any;

      const res = await fetch("/api/banks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      } as RequestInit);

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || `Failed to add bank`);
      }

      const json = await res.json().catch(() => ({}));
      onCreated?.(json?.id || "");

      // Reset
      setBankName("");
      setDba("");
      setAccountName("");
      setRouting("");
      setAccount("");
      setSignatureId("");
      setCorporationId("");
      setAddr1("");
      setAddr2("");
      setCity("");
      setState("");
      setZip("");

      toast.success("Bank added successfully");
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Bank Account Information</h2>
        <h3 className="text-sm font-medium text-gray-300">Corporation</h3>
      </div>

      {error && (
        <div className="whitespace-pre-line rounded-md border border-red-500/30 bg-red-500/10 text-red-300 p-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-4">
          <div className="space-y-1">
            <label className={labelClass}>Bank Name *</label>
            <input className={inputClass} value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank of America" />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Dba</label>
            <input className={inputClass} value={dba} onChange={(e) => setDba(e.target.value)} placeholder="Doing Business As" />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Account Name *</label>
            <input className={inputClass} value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Operating Account" />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Routing *</label>
            <input className={inputClass} value={routing} onChange={(e) => setRouting(e.target.value)} placeholder="XXXXXXXXX" />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Account *</label>
            <input className={inputClass} value={account} onChange={(e) => setAccount(e.target.value)} placeholder="XXXXXXXXXXXX" />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Signature ID *</label>
            <input className={inputClass} value={signatureId} onChange={(e) => setSignatureId(e.target.value)} placeholder="e.g., signer-123" />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Corporation select + Add New */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className={labelClass}>Corporation</label>
              <button
                type="button"
                onClick={() => setShowCorpModal(true)}
                className="inline-flex items-center rounded-md bg-gray-700 hover:bg-gray-600 text-gray-100 px-3 py-1.5 text-sm border border-gray-600"
              >
                Add New
              </button>
            </div>
            <select
              className={inputClass}
              value={corporationId}
              onChange={(e) => setCorporationId(e.target.value)}
            >
              <option value="">Select corporation</option>
              {corpList.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Return Address */}
          <div className="pt-2">
            <div className="text-sm font-medium text-gray-300 mb-2">Return Address</div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className={labelClass}>Address 1 *</label>
                <input className={inputClass} value={addr1} onChange={(e) => setAddr1(e.target.value)} placeholder="123 Main St" />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Address 2</label>
                <input className={inputClass} value={addr2} onChange={(e) => setAddr2(e.target.value)} placeholder="Suite / Unit" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className={labelClass}>City *</label>
                  <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>State *</label>
                  <input className={inputClass} value={state} onChange={(e) => setState(e.target.value)} placeholder="State" />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Zip *</label>
                  <input className={inputClass} value={zip} onChange={(e) => setZip(e.target.value)} placeholder="Zip" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer buttons */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setBankName(""); setDba(""); setAccountName(""); setRouting(""); setAccount(""); setSignatureId(""); setCorporationId(""); setAddr1(""); setAddr2(""); setCity(""); setState(""); setZip(""); setError(null);
          }}
          className="inline-flex items-center rounded-md bg-gray-700 hover:bg-gray-600 text-gray-100 px-4 py-2 text-sm border border-gray-600"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex items-center rounded-md bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-sm disabled:opacity-60"
        >
          {submitting ? "Adding..." : "Add Bank"}
        </button>
      </div>

      <NewCorporationModal
        open={showCorpModal}
        onClose={() => setShowCorpModal(false)}
        onCreated={(corp) => {
          setCorpList((prev) => {
            // Avoid duplicates by name/id
            if (prev.some((c) => c.id === corp.id)) return prev;
            return [...prev, corp];
          });
          setCorporationId(String(corp.id));
        }}
      />
    </div>
  );
}


