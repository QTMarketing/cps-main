"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchInput } from "@/components/common/SearchInput";
import { Checkbox } from "@/components/common/Checkbox";
import { Button } from "@/components/ui/button";

export type Account = {
  id: string;
  name: string;
  type: string;
  bank: string;
};

type AccountAssignmentProps = {
  unassigned: Account[];
  assigned: Account[];
  onAssign: (accountIds: string[]) => void;
  onUnassign: (accountIds: string[]) => void;
  loading?: boolean;
};

export function AccountAssignment({
  unassigned,
  assigned,
  onAssign,
  onUnassign,
  loading,
}: AccountAssignmentProps) {
  const [searchUnassigned, setSearchUnassigned] = useState("");
  const [searchAssigned, setSearchAssigned] = useState("");
  const [selectedUnassigned, setSelectedUnassigned] = useState<Record<string, boolean>>({});
  const [selectedAssigned, setSelectedAssigned] = useState<Record<string, boolean>>({});

  const filteredUnassigned = useMemo(() => {
    if (!searchUnassigned.trim()) return unassigned;
    const q = searchUnassigned.toLowerCase();
    return unassigned.filter(
      (acct) =>
        acct.name.toLowerCase().includes(q) ||
        acct.bank.toLowerCase().includes(q) ||
        acct.type.toLowerCase().includes(q)
    );
  }, [unassigned, searchUnassigned]);

  const filteredAssigned = useMemo(() => {
    if (!searchAssigned.trim()) return assigned;
  useEffect(() => {
    setSelectedUnassigned((prev) => {
      const next: Record<string, boolean> = {};
      unassigned.forEach((acct) => {
        if (prev[acct.id]) next[acct.id] = true;
      });
      return next;
    });
  }, [unassigned]);

  useEffect(() => {
    setSelectedAssigned((prev) => {
      const next: Record<string, boolean> = {};
      assigned.forEach((acct) => {
        if (prev[acct.id]) next[acct.id] = true;
      });
      return next;
    });
  }, [assigned]);
    const q = searchAssigned.toLowerCase();
    return assigned.filter(
      (acct) =>
        acct.name.toLowerCase().includes(q) ||
        acct.bank.toLowerCase().includes(q) ||
        acct.type.toLowerCase().includes(q)
    );
  }, [assigned, searchAssigned]);

  const handleToggle = (
    id: string,
    prev: Record<string, boolean>,
    setter: (value: Record<string, boolean>) => void
  ) => {
    setter({ ...prev, [id]: !prev[id] });
  };

  const handleSelectAll = (
    checked: boolean,
    list: Account[],
    setter: (value: Record<string, boolean>) => void
  ) => {
    if (!checked) {
      setter({});
      return;
    }
    const next: Record<string, boolean> = {};
    list.forEach((acct) => {
      next[acct.id] = true;
    });
    setter(next);
  };

  const selectedUnassignedIds = Object.entries(selectedUnassigned)
    .filter(([, value]) => value)
    .map(([key]) => key);

  const selectedAssignedIds = Object.entries(selectedAssigned)
    .filter(([, value]) => value)
    .map(([key]) => key);

  const listHeightClass = "max-h-[540px] overflow-y-auto space-y-2";

  return (
    <div className="rounded-xl border border-border bg-card/70 p-6 space-y-4">
      <div className="text-lg font-semibold text-foreground">Account Assignment</div>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Unassigned */}
        <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
          <div className="text-sm font-semibold text-foreground">Unassigned Accounts</div>
          <SearchInput
            value={searchUnassigned}
            onChange={setSearchUnassigned}
            placeholder="Search accounts"
          />
          <Checkbox
            checked={
              filteredUnassigned.length > 0 &&
              filteredUnassigned.every((acct) => selectedUnassigned[acct.id])
            }
            onChange={(checked) => handleSelectAll(checked, filteredUnassigned, setSelectedUnassigned)}
            label="Select All"
            className="text-foreground"
          />
          <div className={listHeightClass}>
            {filteredUnassigned.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-8">
                No data to display
              </div>
            ) : (
              filteredUnassigned.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-3 py-3 hover:bg-background/80 transition"
                >
                  <div className="space-y-0.5">
                    <div className="text-sm font-semibold text-foreground">{account.name}</div>
                    <div className="text-xs text-muted-foreground">{account.type}</div>
                    <div className="text-xs text-muted-foreground">{account.bank}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={!!selectedUnassigned[account.id]}
                      onChange={() => handleToggle(account.id, selectedUnassigned, setSelectedUnassigned)}
                    />
                    <button
                      className="text-emerald-400 text-sm font-semibold"
                      disabled={loading}
                      onClick={() => onAssign([account.id])}
                    >
                      &raquo;&raquo;
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <Button
            variant="outline"
            className="w-full text-xs"
            disabled={selectedUnassignedIds.length === 0 || loading}
            onClick={() => onAssign(selectedUnassignedIds)}
          >
            Assign Selected
          </Button>
        </div>

        {/* Assigned */}
        <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
          <div className="text-sm font-semibold text-foreground">Assigned Accounts</div>
          <SearchInput
            value={searchAssigned}
            onChange={setSearchAssigned}
            placeholder="Search accounts"
          />
          <Checkbox
            checked={
              filteredAssigned.length > 0 &&
              filteredAssigned.every((acct) => selectedAssigned[acct.id])
            }
            onChange={(checked) => handleSelectAll(checked, filteredAssigned, setSelectedAssigned)}
            label="Select All"
            className="text-foreground"
          />
          <div className={listHeightClass}>
            {filteredAssigned.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-8">
                No data to display
              </div>
            ) : (
              filteredAssigned.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-3 py-3 hover:bg-background/80 transition"
                >
                  <div className="space-y-0.5">
                    <div className="text-sm font-semibold text-foreground">{account.name}</div>
                    <div className="text-xs text-muted-foreground">{account.type}</div>
                    <div className="text-xs text-muted-foreground">{account.bank}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={!!selectedAssigned[account.id]}
                      onChange={() => handleToggle(account.id, selectedAssigned, setSelectedAssigned)}
                    />
                    <button
                      className="text-emerald-400 text-sm font-semibold"
                      disabled={loading}
                      onClick={() => onUnassign([account.id])}
                    >
                      &laquo;&laquo;
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <Button
            variant="outline"
            className="w-full text-xs"
            disabled={selectedAssignedIds.length === 0 || loading}
            onClick={() => onUnassign(selectedAssignedIds)}
          >
            Unassign Selected
          </Button>
        </div>
      </div>
    </div>
  );
}

