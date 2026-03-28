"use client";

import { useRef, useState } from "react";
import ReportsTable, { ReportsTableRef } from "./components/ReportsTable";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { listReportChecks } from "./lib/data";
import { downloadCSV } from "./lib/export";

export default function ReportsPage() {
  const tableRef = useRef<ReportsTableRef>(null);
  const [exporting, setExporting] = useState(false);
  const [globalQ, setGlobalQ] = useState("");

  const downloadAll = async () => {
    try {
      setExporting(true);
      // First request to get total count
      const first = await listReportChecks({ q: globalQ || undefined, page: 0, pageSize: 1000, sortBy: 'createdAt', sortDir: 'desc' });
      const allRows = [...first.rows];
      const total = first.total || first.rows.length;
      const pageSize = 1000;
      const totalPages = Math.ceil(total / pageSize);
      for (let p = 1; p < totalPages; p++) {
        const { rows } = await listReportChecks({ q: globalQ || undefined, page: p, pageSize, sortBy: 'createdAt', sortDir: 'desc' });
        allRows.push(...rows);
      }
      await downloadCSV('reports-all.csv', allRows);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6">
      {/* Top toolbar */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={globalQ} onChange={(e) => setGlobalQ(e.target.value)} className="pl-9 w-64" />
          </div>
          <Button onClick={downloadAll} disabled={exporting}>{exporting ? 'Exporting…' : 'Download all'}</Button>
        </div>
      </div>

      {/* Table */}
      <ReportsTable ref={tableRef} />
    </div>
  );
}