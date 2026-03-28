"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { VendorForm } from "@/components/vendor/VendorForm";
import { AccountAssignment, Account } from "@/components/vendor/AccountAssignment";

type BankApiResponse =
  | {
      success: true;
      banks: Array<{
        id: number | string;
        dbaName?: string | null;
        accountType?: string | null;
        bankName?: string | null;
      }>;
    }
  | {
      success?: false;
      error?: string;
      message?: string;
    };

export default function VendorAddPage() {
  const [vendorName, setVendorName] = useState("");
  const [vendorType, setVendorType] = useState("MERCHANDISE");
  const [description, setDescription] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [unassignedAccounts, setUnassignedAccounts] = useState<Account[]>([]);
  const [assignedAccounts, setAssignedAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  const authHeader = useMemo(() => {
    if (typeof document === "undefined") return {};
    const token = document.cookie
      .split("; ")
      .find((r) => r.startsWith("auth-token="))
      ?.split("=")[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const loadUnassignedAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountsError(null);
    try {
      const res = await fetch("/api/banks/unassigned", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || `Failed to load accounts (${res.status})`);
      }

      let data: BankApiResponse;
      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error("Unable to parse accounts response");
      }

      if (!("success" in data) || !data.success || !Array.isArray(data.banks)) {
        const fallbackError =
          (data as { error?: string; message?: string })?.error ||
          (data as { error?: string; message?: string })?.message ||
          "Invalid accounts payload";
        throw new Error(fallbackError);
      }

      const mapped: Account[] = data.banks.map((bank) => ({
        id: String(bank.id),
        name: bank.dbaName || bank.bankName || `Bank #${bank.id}`,
        type: bank.accountType || "N/A",
        bank: bank.bankName || "N/A",
      }));
      setUnassignedAccounts(mapped);
      // ensure assigned list references actual accounts
      setAssignedAccounts((prev) =>
        prev.filter((acct) => mapped.find((m) => m.id === acct.id))
      );
    } catch (error: any) {
      console.error("Failed to load unassigned accounts:", error);
      setAccountsError(error?.message || "Failed to load accounts");
      setUnassignedAccounts([]);
      setAssignedAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  }, [authHeader]);

  useEffect(() => {
    loadUnassignedAccounts();
  }, [loadUnassignedAccounts]);

  const handleAssign = (accountIds: string[]) => {
    setUnassignedAccounts((prev) => prev.filter((acct) => !accountIds.includes(acct.id)));
    setAssignedAccounts((prev) => [
      ...prev,
      ...unassignedAccounts.filter((acct) => accountIds.includes(acct.id)),
    ]);
  };

  const handleUnassign = (accountIds: string[]) => {
    setAssignedAccounts((prev) => prev.filter((acct) => !accountIds.includes(acct.id)));
    setUnassignedAccounts((prev) => [
      ...prev,
      ...assignedAccounts.filter((acct) => accountIds.includes(acct.id)),
    ]);
  };

  const resetForm = () => {
    setVendorName("");
    setVendorType("MERCHANDISE");
    setDescription("");
    setContactPerson("");
    setEmail("");
    setPhone("");
    setAddress("");
    setAssignedAccounts([]);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        vendorName,
        vendorType,
        description,
        contactPerson,
        email,
        phone,
        address,
        assignedAccountIds: assignedAccounts.map((acct) => acct.id),
      };

      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to create vendor");
      }

      resetForm();
      await loadUnassignedAccounts();
      alert("Vendor created successfully");
    } catch (error: any) {
      alert(error?.message || "Failed to save vendor");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Add Vendor</h1>
        <p className="text-muted-foreground">Add new vendors and assign bank accounts</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[35%_1fr]">
        <VendorForm
          vendorName={vendorName}
          setVendorName={setVendorName}
          vendorType={vendorType}
          setVendorType={setVendorType}
          description={description}
          setDescription={setDescription}
          contactPerson={contactPerson}
          setContactPerson={setContactPerson}
          email={email}
          setEmail={setEmail}
          phone={phone}
          setPhone={setPhone}
          address={address}
          setAddress={setAddress}
          onCancel={resetForm}
          onSubmit={handleSubmit}
          submitting={submitting}
        />

        <div className="space-y-3">
          {accountsError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {accountsError}
            </div>
          )}
          <AccountAssignment
            unassigned={unassignedAccounts}
            assigned={assignedAccounts}
            onAssign={handleAssign}
            onUnassign={handleUnassign}
            loading={accountsLoading || submitting}
          />
        </div>
      </div>
    </div>
  );
}

