"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowRight, ArrowLeft, AlertCircle, CheckSquare, Square } from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

export type BankSummary = {
  id: number;
  bank_name: string;
  account_type: string;
  last4: string;
  store_id: number | null;
  storeName: string;
};

type Props = {
  user: { id: string; username: string; storeId?: string | null };
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  callerRole: string;
};

// =============================================================================
// HELPERS
// =============================================================================

function getToken(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((r) => r.startsWith("auth-token="))
    ?.split("=")[1];
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// =============================================================================
// BANK ITEM — renders one row in either list
// =============================================================================

function BankItem({
  bank,
  selected,
  onToggle,
}: {
  bank: BankSummary;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full text-left px-3 py-2 rounded-md border transition-colors flex items-start gap-2 ${
        selected
          ? "border-primary bg-primary/10"
          : "border-border hover:border-primary/50 hover:bg-muted/50"
      }`}
    >
      <span className="mt-0.5 shrink-0 text-muted-foreground">
        {selected ? (
          <CheckSquare className="h-4 w-4 text-primary" />
        ) : (
          <Square className="h-4 w-4" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm truncate">{bank.storeName}</span>
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            {bank.account_type} ····{bank.last4}
          </span>
        </div>
        <div className="text-xs text-muted-foreground truncate">{bank.bank_name}</div>
      </div>
    </button>
  );
}

// =============================================================================
// BANK LIST PANEL
// =============================================================================

function BankListPanel({
  title,
  banks,
  selected,
  search,
  onSearchChange,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: {
  title: string;
  banks: BankSummary[];
  selected: Set<number>;
  search: string;
  onSearchChange: (v: string) => void;
  onToggle: (id: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}) {
  const filtered = banks.filter(
    (b) =>
      b.bank_name.toLowerCase().includes(search.toLowerCase()) ||
      b.storeName.toLowerCase().includes(search.toLowerCase()) ||
      b.account_type.toLowerCase().includes(search.toLowerCase()) ||
      b.last4.includes(search)
  );

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((b) => selected.has(b.id));

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">{banks.length} accounts</span>
      </div>

      <Input
        placeholder="Search..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="mb-2 h-8 text-sm"
      />

      {/* Select all toggle */}
      <button
        type="button"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-1 px-1"
        onClick={allFilteredSelected ? onDeselectAll : onSelectAll}
        disabled={filtered.length === 0}
      >
        {allFilteredSelected ? (
          <CheckSquare className="h-3.5 w-3.5 text-primary" />
        ) : (
          <Square className="h-3.5 w-3.5" />
        )}
        Select all ({filtered.length})
      </button>

      <div className="border border-border rounded-md flex-1 overflow-y-auto min-h-[200px] max-h-[320px] p-1 space-y-1 bg-muted/20">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full py-8 text-sm text-muted-foreground">
            {banks.length === 0 ? "No accounts" : "No results"}
          </div>
        ) : (
          filtered.map((bank) => (
            <BankItem
              key={bank.id}
              bank={bank}
              selected={selected.has(bank.id)}
              onToggle={() => onToggle(bank.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN DIALOG
// =============================================================================

export function BankAssignmentDialog({ user, open, onClose, onSaved }: Props) {
  const [unassigned, setUnassigned] = useState<BankSummary[]>([]);
  const [assigned, setAssigned] = useState<BankSummary[]>([]);
  // Track original assigned IDs to compute delta on save
  const originalAssignedRef = useRef<Set<number>>(new Set());

  const [leftSelected, setLeftSelected] = useState<Set<number>>(new Set());
  const [rightSelected, setRightSelected] = useState<Set<number>>(new Set());
  const [leftSearch, setLeftSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load data whenever dialog opens
  useEffect(() => {
    if (!open) return;
    setError(null);
    setLeftSelected(new Set());
    setRightSelected(new Set());
    setLeftSearch("");
    setRightSearch("");
    setLoading(true);

    fetch(`/api/users/${user.id}/banks`, {
      headers: authHeaders(),
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setUnassigned(data.unassigned ?? []);
        setAssigned(data.assigned ?? []);
        originalAssignedRef.current = new Set((data.assigned ?? []).map((b: BankSummary) => b.id));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, user.id]);

  // Move left → right
  const moveToAssigned = () => {
    if (leftSelected.size === 0) return;
    const toMove = unassigned.filter((b) => leftSelected.has(b.id));
    setAssigned((prev) => [...prev, ...toMove].sort((a, b) => a.bank_name.localeCompare(b.bank_name)));
    setUnassigned((prev) => prev.filter((b) => !leftSelected.has(b.id)));
    setLeftSelected(new Set());
  };

  // Move right → left
  const moveToUnassigned = () => {
    if (rightSelected.size === 0) return;
    const toMove = assigned.filter((b) => rightSelected.has(b.id));
    setUnassigned((prev) => [...prev, ...toMove].sort((a, b) => a.bank_name.localeCompare(b.bank_name)));
    setAssigned((prev) => prev.filter((b) => !rightSelected.has(b.id)));
    setRightSelected(new Set());
  };

  const toggleLeft = (id: number) => {
    setLeftSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleRight = (id: number) => {
    setRightSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredLeft = unassigned.filter(
    (b) =>
      b.bank_name.toLowerCase().includes(leftSearch.toLowerCase()) ||
      b.storeName.toLowerCase().includes(leftSearch.toLowerCase()) ||
      b.account_type.toLowerCase().includes(leftSearch.toLowerCase()) ||
      b.last4.includes(leftSearch)
  );

  const filteredRight = assigned.filter(
    (b) =>
      b.bank_name.toLowerCase().includes(rightSearch.toLowerCase()) ||
      b.storeName.toLowerCase().includes(rightSearch.toLowerCase()) ||
      b.account_type.toLowerCase().includes(rightSearch.toLowerCase()) ||
      b.last4.includes(rightSearch)
  );

  const selectAllLeft = () => setLeftSelected(new Set(filteredLeft.map((b) => b.id)));
  const deselectAllLeft = () => setLeftSelected(new Set());
  const selectAllRight = () => setRightSelected(new Set(filteredRight.map((b) => b.id)));
  const deselectAllRight = () => setRightSelected(new Set());

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    try {
      const currentAssignedIds = new Set(assigned.map((b) => b.id));
      const original = originalAssignedRef.current;

      // Banks newly added to assigned (not in original)
      const assignBankIds = assigned
        .filter((b) => !original.has(b.id))
        .map((b) => b.id);

      // Banks removed from assigned (were in original but not in current)
      const unassignBankIds = [...original].filter((id) => !currentAssignedIds.has(id));

      if (assignBankIds.length === 0 && unassignBankIds.length === 0) {
        onSaved();
        return;
      }

      const res = await fetch(`/api/users/${user.id}/banks`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ assignBankIds, unassignBankIds }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      onSaved();
    } catch (e: any) {
      setError(e.message ?? "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl w-full">
        <DialogHeader>
          <DialogTitle>Assign Bank Accounts</DialogTitle>
          <DialogDescription>
            Manage which bank accounts are available to{" "}
            <span className="font-medium text-foreground">{user.username}</span> in Write
            Checks.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert className="border-red-500 bg-red-500/10">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-600">{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex gap-3 items-center mt-2">
            {/* Left: Unassigned */}
            <BankListPanel
              title="Unassigned Accounts"
              banks={unassigned}
              selected={leftSelected}
              search={leftSearch}
              onSearchChange={setLeftSearch}
              onToggle={toggleLeft}
              onSelectAll={selectAllLeft}
              onDeselectAll={deselectAllLeft}
            />

            {/* Arrow buttons */}
            <div className="flex flex-col gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={moveToAssigned}
                disabled={leftSelected.size === 0}
                title="Assign selected"
                className="px-2"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={moveToUnassigned}
                disabled={rightSelected.size === 0}
                title="Remove selected"
                className="px-2"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>

            {/* Right: Assigned */}
            <BankListPanel
              title="Assigned Accounts"
              banks={assigned}
              selected={rightSelected}
              search={rightSearch}
              onSearchChange={setRightSearch}
              onToggle={toggleRight}
              onSelectAll={selectAllRight}
              onDeselectAll={deselectAllRight}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={loading || saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
