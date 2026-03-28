"use client";

import { useState } from "react";

export interface NewCorporationModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (corp: { id: number; name: string }) => void;
}

export default function NewCorporationModal({ open, onClose, onCreated }: NewCorporationModalProps) {
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [ein, setEin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const inputClass =
    "w-full bg-gray-800/70 border border-gray-700 rounded-md px-3 py-2 text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-600";
  const labelClass = "text-sm text-gray-300";

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) { setError("Corporation name is required"); return; }
    try {
      setSubmitting(true);
      const res = await fetch("/api/corporations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, owner: owner || null, ein: ein || null }),
      } as RequestInit);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || "Failed to create corporation");
      }
      const created = await res.json();
      const corp = { id: Number(created?.id ?? created?.corp?.id ?? 0), name: created?.name ?? created?.corp?.name ?? name };
      onCreated(corp);
      onClose();
      setName(""); setOwner(""); setEin("");
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-800 p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">New Corporation</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-white">✕</button>
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 text-red-300 p-2 text-sm">{error}</div>
        )}

        <div className="space-y-3">
          <div className="space-y-1">
            <label className={labelClass}>Corporation name *</label>
            <input className={inputClass} value={name} onChange={(e)=>setName(e.target.value)} placeholder="Company LLC" />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Owner</label>
            <input className={inputClass} value={owner} onChange={(e)=>setOwner(e.target.value)} placeholder="Owner Name" />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Ein</label>
            <input className={inputClass} value={ein} onChange={(e)=>setEin(e.target.value)} placeholder="12-3456789" />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md bg-gray-700 hover:bg-gray-600 text-gray-100 px-3 py-1.5 text-sm border border-gray-600">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className="rounded-md bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-sm disabled:opacity-60">
            {submitting ? 'Adding...' : 'Add Company'}
          </button>
        </div>
      </div>
    </div>
  );
}



