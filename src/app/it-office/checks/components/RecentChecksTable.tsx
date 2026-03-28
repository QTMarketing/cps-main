"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listChecksClient } from "../lib/client-fetch";
import { ExternalLink, Search, Printer } from "lucide-react";
import CheckPrint from "@/components/CheckPrintComponent";

type Status = "All" | "PENDING" | "CLEARED" | "VOIDED";

export interface RecentChecksTableRef {
  refresh: () => void;
}

export interface RecentChecksTableProps {
  bankId?: string;
  storeId?: string;
}

const statusColors: Record<Exclude<Status, "All">, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  CLEARED: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300",
  VOIDED: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
};

export default forwardRef<RecentChecksTableRef, RecentChecksTableProps>(function RecentChecksTable({ bankId, storeId }, ref) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("All");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { rows, total } = await listChecksClient({ 
        q, 
        status, 
        page, 
        pageSize,
        bankId: bankId || undefined,  // Pass bankId if available
        storeId: storeId || undefined // Pass storeId if available
      });
      console.log('[RecentChecksTable] Received from listChecksClient:', { rowsLength: rows.length, total, bankId, storeId });
      setRows(rows);
      setTotal(total);
    } catch (err) {
      console.error('[RecentChecksTable] Error loading checks:', err);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [q, status, page, pageSize, bankId, storeId]);

  useImperativeHandle(ref, () => ({ refresh: load }), [load]);

  useEffect(() => { 
    load(); 
  }, [load]);
  
  useEffect(() => {
    const handler = () => {
      // Reset filters and force reload
      setStatus("All");
      setPage(0);
      setQ("");
      // Force immediate reload by calling load directly
      load();
    };
    window.addEventListener('checks:refresh', handler as EventListener);
    return () => window.removeEventListener('checks:refresh', handler as EventListener);
  }, [load]); // Include load in deps so handler always has current version

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const canPrev = page > 0;
  const canNext = page + 1 < pageCount;

  const handlePrint = (check: any) => {
    setSelectedCheck(check);
    setPrintDialogOpen(true);
  };

  return (
    <Card className="bg-background">
      <CardHeader>
        <CardTitle>Recent Checks</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search (check #, memo, vendor, store)"
              value={q}
              onChange={(e) => { setPage(0); setQ(e.target.value); }}
            />
          </div>
          <Select value={status} onValueChange={(v) => { setPage(0); setStatus(v as Status); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="CLEARED">Cleared</SelectItem>
              <SelectItem value="VOIDED">Voided</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(pageSize)} onValueChange={(v) => { setPage(0); setPageSize(parseInt(v)); }}>
            <SelectTrigger className="w-28"><SelectValue placeholder="Page size" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(0)} disabled={!canPrev}>First</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p-1))} disabled={!canPrev}>Prev</Button>
            <div className="text-sm text-muted-foreground">Page {page + 1} / {pageCount}</div>
            <Button variant="outline" size="sm" onClick={() => setPage(p => canNext ? p+1 : p)} disabled={!canNext}>Next</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(pageCount - 1)} disabled={!canNext}>Last</Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created Date</TableHead>
                <TableHead>Check Number</TableHead>
                <TableHead>Vendors</TableHead>
                <TableHead>Store</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Memo</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`s-${i}`}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <TableCell key={j}>
                        <div className="h-4 w-full max-w-[180px] animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10}>
                    <div className="text-center text-muted-foreground py-12">No data</div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.createdAt).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '')}</TableCell>
                    <TableCell className="truncate max-w-[160px]" title={r.checkNumber}>
                      {r.paymentMethod && r.paymentMethod !== 'CHECK'
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300">{r.paymentMethod}</span>
                        : (r.checkNumber ?? '—')}
                    </TableCell>
                    <TableCell className="truncate max-w-[220px]" title={r.vendorName}>{r.vendorName}</TableCell>
                    <TableCell className="truncate max-w-[200px]" title={r.storeName}>{r.storeName}</TableCell>
                    <TableCell className="text-right">{new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(r.amount))}</TableCell>
                    <TableCell className="truncate max-w-[240px]" title={r.memo || ''}>{r.memo || '—'}</TableCell>
                    <TableCell className="truncate max-w-[160px]" title={r.userName}>{r.userName}</TableCell>
                    <TableCell>
                      {r.invoiceUrl ? (
                        <a href={`/api/invoices/${r.id}/file`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          <ExternalLink className="h-4 w-4" /> View
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[(r.status || 'PENDING')] || statusColors.PENDING}`}>
                        {r.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {(!r.paymentMethod || r.paymentMethod === 'CHECK') && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handlePrint(r)}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Print Dialog */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Print Cheque #{selectedCheck?.checkNumber}</DialogTitle>
          </DialogHeader>
          {selectedCheck && (
            <CheckPrint 
              check={selectedCheck}
              onPrint={() => setPrintDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
});


