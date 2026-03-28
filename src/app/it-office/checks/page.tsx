"use client";

import { useRef } from "react";
import { SidebarLayout } from "@/components/SidebarLayout";
import MakePaymentForm from "./components/MakePaymentForm";
import RecentChecksTable, { RecentChecksTableRef } from "./components/RecentChecksTable";

export default function ITOfficeChecksPage() {
  const tableRef = useRef<RecentChecksTableRef>(null);

  return (
    <SidebarLayout>
      <div className="p-6">
        {/* Top bar / breadcrumb title */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">IT Office</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MakePaymentForm onCreated={() => tableRef.current?.refresh()} />
          <RecentChecksTable ref={tableRef} />
        </div>
      </div>
    </SidebarLayout>
  );
}


