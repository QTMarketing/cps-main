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
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, ArrowLeft, AlertCircle, CheckSquare, Square } from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

export type VendorSummary = {
  id: number;
  vendor_name: string;
  vendor_type: string;
};

type Props = {
  user: { id: string; username: string };
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
// VENDOR ITEM
// =============================================================================

function VendorItem({
  vendor,
  selected,
  onToggle,
}: {
  vendor: VendorSummary;
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
          <span className="font-medium text-sm truncate">{vendor.vendor_name}</span>
          <Badge variant="outline" className="text-xs shrink-0">
            {vendor.vendor_type}
          </Badge>
        </div>
      </div>
    </button>
  );
}

// =============================================================================
// VENDOR LIST PANEL
// =============================================================================

function VendorListPanel({
  title,
  vendors,
  selected,
  search,
  onSearchChange,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: {
  title: string;
  vendors: VendorSummary[];
  selected: Set<number>;
  search: string;
  onSearchChange: (v: string) => void;
  onToggle: (id: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}) {
  const filtered = vendors.filter(
    (v) =>
      v.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
      v.vendor_type.toLowerCase().includes(search.toLowerCase())
  );

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((v) => selected.has(v.id));

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">{vendors.length} vendors</span>
      </div>

      <Input
        placeholder="Search..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="mb-2 h-8 text-sm"
      />

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
            {vendors.length === 0 ? "No vendors" : "No results"}
          </div>
        ) : (
          filtered.map((vendor) => (
            <VendorItem
              key={vendor.id}
              vendor={vendor}
              selected={selected.has(vendor.id)}
              onToggle={() => onToggle(vendor.id)}
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

export function VendorAssignmentDialog({ user, open, onClose, onSaved }: Props) {
  const [unassigned, setUnassigned] = useState<VendorSummary[]>([]);
  const [assigned, setAssigned] = useState<VendorSummary[]>([]);
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

    fetch(`/api/users/${user.id}/vendors`, {
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
        originalAssignedRef.current = new Set((data.assigned ?? []).map((v: VendorSummary) => v.id));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, user.id]);

  const moveToAssigned = () => {
    if (leftSelected.size === 0) return;
    const toMove = unassigned.filter((v) => leftSelected.has(v.id));
    setAssigned((prev) => [...prev, ...toMove].sort((a, b) => a.vendor_name.localeCompare(b.vendor_name)));
    setUnassigned((prev) => prev.filter((v) => !leftSelected.has(v.id)));
    setLeftSelected(new Set());
  };

  const moveToUnassigned = () => {
    if (rightSelected.size === 0) return;
    const toMove = assigned.filter((v) => rightSelected.has(v.id));
    setUnassigned((prev) => [...prev, ...toMove].sort((a, b) => a.vendor_name.localeCompare(b.vendor_name)));
    setAssigned((prev) => prev.filter((v) => !rightSelected.has(v.id)));
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
    (v) =>
      v.vendor_name.toLowerCase().includes(leftSearch.toLowerCase()) ||
      v.vendor_type.toLowerCase().includes(leftSearch.toLowerCase())
  );

  const filteredRight = assigned.filter(
    (v) =>
      v.vendor_name.toLowerCase().includes(rightSearch.toLowerCase()) ||
      v.vendor_type.toLowerCase().includes(rightSearch.toLowerCase())
  );

  const selectAllLeft = () => setLeftSelected(new Set(filteredLeft.map((v) => v.id)));
  const deselectAllLeft = () => setLeftSelected(new Set());
  const selectAllRight = () => setRightSelected(new Set(filteredRight.map((v) => v.id)));
  const deselectAllRight = () => setRightSelected(new Set());

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    try {
      const currentAssignedIds = new Set(assigned.map((v) => v.id));
      const original = originalAssignedRef.current;

      const assignVendorIds = assigned
        .filter((v) => !original.has(v.id))
        .map((v) => v.id);

      const unassignVendorIds = [...original].filter((id) => !currentAssignedIds.has(id));

      if (assignVendorIds.length === 0 && unassignVendorIds.length === 0) {
        onSaved();
        return;
      }

      const res = await fetch(`/api/users/${user.id}/vendors`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ assignVendorIds, unassignVendorIds }),
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
          <DialogTitle>Assign Vendors</DialogTitle>
          <DialogDescription>
            Manage which vendors are available to{" "}
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
            <VendorListPanel
              title="Unassigned Vendors"
              vendors={unassigned}
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
            <VendorListPanel
              title="Assigned Vendors"
              vendors={assigned}
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
