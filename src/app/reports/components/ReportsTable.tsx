"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listReportChecks } from "../lib/data";
import { listVendors, listStores } from "../lib/lookups";
import type { ReportCheck } from "../lib/types";
import { downloadCSV } from "../lib/export";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, ExternalLink, ChevronLeft, ChevronRight, Filter, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import CheckPrint from "@/components/CheckPrintComponent";

type Status = 'All' | 'PENDING' | 'CLEARED' | 'VOIDED';

export interface ReportsTableRef {
  refresh: () => void;
}

function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default forwardRef<ReportsTableRef, {}>(function ReportsTable(_, ref) {
  // Filters/state
  const [q, setQ] = useState("");
  const qDebounced = useDebounced(q, 300);
  const [status, setStatus] = useState<Status>("All");
  const [vendorId, setVendorId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [dateFrom, setDateFrom] = useState<string | undefined>(undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'createdAt' | 'checkNumber' | 'amount'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ReportCheck[]>([]);
  const [total, setTotal] = useState(0);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const [selectedCheck, setSelectedCheck] = useState<ReportCheck | null>(null);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [fullCheckData, setFullCheckData] = useState<{ id: string; checkNumber?: number | string | null; referenceNumber?: number | string | null; } | null>(null);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const myId = ++requestIdRef.current;
    try {
      // Note: our server action doesn't accept AbortSignal; race control via requestId
      const { rows, total } = await listReportChecks({
        q: qDebounced || undefined,
        status: status === 'All' ? undefined : status,
        vendorId: vendorId || undefined,
        storeId: storeId || undefined,
        dateFrom,
        dateTo,
        page,
        pageSize,
        sortBy,
        sortDir,
      });
      if (myId !== requestIdRef.current) return; // stale
      setRows(rows);
      setTotal(total);
      setTotalAmount(rows.reduce((s, r) => s + Number(r.amount || 0), 0));
    } catch (e: any) {
      if (myId !== requestIdRef.current) return;
      setError(e?.message || 'Failed to load data');
    } finally {
      if (myId === requestIdRef.current) setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({ refresh: fetchData }), [qDebounced, status, vendorId, storeId, dateFrom, dateTo, sortBy, sortDir, page, pageSize]);

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [qDebounced, status, vendorId, storeId, dateFrom, dateTo, sortBy, sortDir, page, pageSize]);

  // Load lookups once
  useEffect(() => {
    (async () => {
      try {
        const [v, s] = await Promise.all([listVendors(), listStores()]);
        setVendors(v);
        setStores(s);
      } catch {
        setVendors([]);
        setStores([]);
      }
    })();
  }, []);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const canPrev = page > 0;
  const canNext = page + 1 < pageCount;

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    // Use explicit en-US locale to prevent hydration mismatch
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d).replace(',', '');
  };

  const currency = (n: number) => {
    // Use explicit en-US locale to prevent hydration mismatch
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  };

  const downloadRow = (r: ReportCheck) => {
    downloadCSV(`check-${r.checkNumber}.csv`, [r]);
  };

  const handlePrint = (r: ReportCheck) => {
    setSelectedCheck(r);
    setFullCheckData({
      id: r.id,
      checkNumber: r.checkNumber,
      referenceNumber: r.checkNumber,
    });
    setIsPrintDialogOpen(true);
  };

  return (
    <Card className="bg-background">
      <CardContent className="p-0">
        {/* Top bar with search on the right */}
        <div className="flex items-center justify-between p-3 border-b">
          <div className="text-xs px-2 py-1 rounded bg-muted text-foreground/80">
            Total Amount: {hasMounted ? currency(totalAmount) : "$0.00"}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={q} onChange={(e) => { setPage(0); setQ(e.target.value); }} className="pl-9 w-64" />
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="px-4 py-2 text-sm text-red-400 bg-red-500/10 border-b border-red-500/30 flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={fetchData}>Retry</Button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                {/* Created Date */}
                <TableHead className="whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" className="h-8 px-2" onClick={() => { setSortBy('createdAt'); setSortDir(sortBy === 'createdAt' && sortDir === 'asc' ? 'desc' : 'asc'); }}>
                      Created Date
                    </Button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Filter className="h-4 w-4" /></Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[260px]">
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">From</div>
                            <Calendar mode="single" selected={dateFrom ? new Date(dateFrom) : undefined} onSelect={(d) => { setPage(0); setDateFrom(d ? d.toISOString() : undefined); }} />
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">To</div>
                            <Calendar mode="single" selected={dateTo ? new Date(dateTo) : undefined} onSelect={(d) => { setPage(0); setDateTo(d ? d.toISOString() : undefined); }} />
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>

                {/* Cheque Number */}
                <TableHead className="whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" className="h-8 px-2" onClick={() => { setSortBy('checkNumber'); setSortDir(sortBy === 'checkNumber' && sortDir === 'asc' ? 'desc' : 'asc'); }}>
                      Cheque Number
                    </Button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Filter className="h-4 w-4" /></Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56">
                        <Input placeholder="Number contains" onChange={(e) => { setPage(0); setQ(e.target.value); }} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>

                {/* DBA (Doing Business As) */}
                <TableHead className="whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>DBA</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Filter className="h-4 w-4" /></Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56">
                        <Input placeholder="DBA contains" onChange={(e) => { setPage(0); setQ(e.target.value); }} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>

                {/* Payee (Vendor) */}
                <TableHead>
                  <div className="flex items-center gap-1">
                    <span>Payee</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Filter className="h-4 w-4" /></Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56">
                        <Input placeholder="Payee contains" onChange={(e) => { setPage(0); setQ(e.target.value); }} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>

                {/* Amount */}
                <TableHead>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" className="h-8 px-2" onClick={() => { setSortBy('amount'); setSortDir(sortBy === 'amount' && sortDir === 'asc' ? 'desc' : 'asc'); }}>
                      Amount
                    </Button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Filter className="h-4 w-4" /></Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56">
                        <div className="text-xs text-muted-foreground mb-2">Use global search for amount contains</div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>

                {/* Memo */}
                <TableHead>
                  <div className="flex items-center gap-1">
                    <span>Memo</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Filter className="h-4 w-4" /></Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56">
                        <Input placeholder="Memo contains" onChange={(e) => { setPage(0); setQ(e.target.value); }} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>

                {/* User */}
                <TableHead>
                  <div className="flex items-center gap-1">
                    <span>User</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Filter className="h-4 w-4" /></Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56">
                        <Input placeholder="User contains" onChange={(e) => { setPage(0); setQ(e.target.value); }} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>

                {/* Invoice */}
                <TableHead>
                  <div className="flex items-center gap-1">
                    <span>Invoice</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Filter className="h-4 w-4" /></Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56">
                        <Button variant="outline" className="w-full" onClick={() => { /* Filter by invoices only */ }}>Has invoice only</Button>
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>

                {/* Print */}
                <TableHead className="text-right">Print</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={`s-${i}`}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <TableCell key={j}><div className="h-4 w-full max-w-[180px] animate-pulse rounded bg-muted" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9}>
                    <div className="text-center text-muted-foreground py-12">No data</div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id} className="h-9">
                    <TableCell className="py-2 whitespace-nowrap">{formatDateTime(r.createdAt)}</TableCell>
                    <TableCell className="py-2">{r.checkNumber}</TableCell>
                    <TableCell className="py-2 truncate max-w-[200px]" title={r.dba || 'N/A'}>
                      {r.dba || 'N/A'}
                    </TableCell>
                    <TableCell className="py-2 truncate max-w-[220px]" title={r.payeeName || r.vendorName || 'N/A'}>
                      {r.payeeName || r.vendorName || 'N/A'}
                    </TableCell>
                    <TableCell className="py-2 text-right whitespace-nowrap">{currency(Number(r.amount))}</TableCell>
                    <TableCell className="py-2 truncate max-w-[240px]" title={r.memo || ''}>
                      {r.memo || '—'}
                    </TableCell>
                    <TableCell className="py-2 truncate max-w-[180px]" title={r.userName || 'N/A'}>
                      {r.userName || 'N/A'}
                    </TableCell>
                    <TableCell className="py-2">
                      {r.invoiceUrl ? (
                        <a 
                          href={`/api/invoices/${r.id}/file`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <ExternalLink className="h-4 w-4" /> View
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handlePrint(r)}
                      >
                        <Printer className="h-4 w-4 mr-1" />
                        Print
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer / Pagination */}
        <div className="flex items-center justify-between p-3 border-t">
          <div className="text-sm text-muted-foreground">Total: {total}</div>
          <div className="flex items-center gap-3">
            <Select value={String(pageSize)} onValueChange={(v) => { setPage(0); setPageSize(parseInt(v)); }}>
              <SelectTrigger className="w-28"><SelectValue placeholder="Rows" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground">Page {page + 1} / {pageCount}</div>
            <Button variant="outline" size="icon" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={!canPrev}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" onClick={() => setPage(p => canNext ? p + 1 : p)} disabled={!canNext}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardContent>

      {/* Print Dialog */}
      <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Print Check</DialogTitle>
            <DialogDescription>
              {selectedCheck && `Check #${selectedCheck.checkNumber}`}
            </DialogDescription>
          </DialogHeader>
          {fullCheckData && (
            <CheckPrint 
              check={fullCheckData} 
              onPrint={() => {
                setIsPrintDialogOpen(false);
                setSelectedCheck(null);
                setFullCheckData(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
});


