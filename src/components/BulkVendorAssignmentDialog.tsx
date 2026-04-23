"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Loader2, AlertCircle, CheckSquare, Square } from "lucide-react";

type VendorRow = {
  id: string;
  vendorName?: string;
  vendorType?: string;
  vendor_name?: string;
  vendor_type?: string;
};

type VendorSummary = {
  id: number;
  vendor_name: string;
  vendor_type: string;
};

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

function normalizeVendor(v: VendorRow): VendorSummary {
  return {
    id: Number(v.id),
    vendor_name: v.vendor_name ?? v.vendorName ?? "",
    vendor_type: v.vendor_type ?? v.vendorType ?? "",
  };
}

export function BulkVendorAssignmentDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (assignedLinks: number) => void;
}) {
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSelected(new Set());
    setSearch("");
    setLoading(true);

    fetch(`/api/vendors`, { headers: authHeaders(), cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        const list = Array.isArray(data?.vendors) ? data.vendors : [];
        const normalized = list.map(normalizeVendor).filter((v) => Number.isFinite(v.id));
        normalized.sort((a, b) => a.vendor_name.localeCompare(b.vendor_name));
        setVendors(normalized);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter(
      (v) =>
        v.vendor_name.toLowerCase().includes(q) ||
        v.vendor_type.toLowerCase().includes(q)
    );
  }, [vendors, search]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((v) => selected.has(v.id));

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => setSelected(new Set(filtered.map((v) => v.id)));
  const deselectAll = () => setSelected(new Set());

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const assignVendorIds = [...selected];
      const res = await fetch(`/api/users/vendors/bulk`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ assignVendorIds }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      onSaved(Number(body.assignedLinks || 0));
    } catch (e: any) {
      setError(e.message ?? "Failed to bulk-assign vendors");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl w-full">
        <DialogHeader>
          <DialogTitle>Assign Vendors to All Users</DialogTitle>
          <DialogDescription>
            Select vendors to assign to <span className="font-medium">every existing user</span>.
            Existing assignments are kept; this only adds missing links.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert className="border-red-500 bg-red-500/10">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-600">{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2">
          <Input
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
          <Button
            type="button"
            variant="outline"
            onClick={allFilteredSelected ? deselectAll : selectAllFiltered}
            disabled={loading || filtered.length === 0}
          >
            {allFilteredSelected ? "Deselect" : "Select"} filtered ({filtered.length})
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="border border-border rounded-md overflow-y-auto max-h-[420px] p-2 space-y-1 bg-muted/20">
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No vendors found
              </div>
            ) : (
              filtered.map((v) => {
                const isSelected = selected.has(v.id);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => toggle(v.id)}
                    className={`w-full text-left px-3 py-2 rounded-md border transition-colors flex items-start gap-2 ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <span className="mt-0.5 shrink-0 text-muted-foreground">
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {v.vendor_name}
                        </span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {v.vendor_type}
                        </Badge>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || selected.size === 0}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              `Assign to all users (${selected.size})`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

