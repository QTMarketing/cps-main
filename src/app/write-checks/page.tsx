"use client";

import { useState, useEffect } from "react";
import MakePaymentForm from "@/app/it-office/checks/components/MakePaymentForm";
import RecentChecksTable from "@/app/it-office/checks/components/RecentChecksTable";

export default function WriteChecksPage() {
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");

  // Fetch user role on mount
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const res = await fetch('/api/auth/session', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setUserRole(data?.user?.role || '');
        }
      } catch (error) {
        console.error('Failed to fetch user role:', error);
      }
    };
    fetchUserRole();
  }, []);

  // Render MakePayment and Recent Checks in a responsive 2-column grid
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <MakePaymentForm 
        onBankChange={setSelectedBankId} 
        onStoreChange={setSelectedStoreId}
        userRole={userRole}
      />
      <RecentChecksTable 
        bankId={selectedBankId}
        storeId={selectedStoreId}
      />
    </div>
  );
}