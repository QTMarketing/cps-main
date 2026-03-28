"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, RefreshCw, Search } from "lucide-react";
import FileUpload from "@/components/FileUpload";
import { format } from "date-fns";

type Bank = { id: string; bankName: string; store?: { name: string } };
type Vendor = { id: string; vendorName: string };
type Store = { id: string; name: string };
type CheckItem = {
  id: string;
  createdAt: string;
  referenceNumber?: string;
  checkNumber?: string;
  vendor?: { vendorName: string };
  bank?: { bankName: string; store?: { name: string } };
  amount: number;
  memo?: string;
  issuedByUser?: { username: string };
  invoiceUrl?: string | null;
  status: string;
};

interface Props { token?: string }

export default function WriteChecksClient({ token }: Props) {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [paymentMethod, setPaymentMethod] = useState("Cheque");
  const [checkNumber, setCheckNumber] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);

  // Toolbar
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const authHeaders = token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [b, v, s, c] = await Promise.all([
          fetch("/api/banks", { headers: authHeaders }).then(r => r.ok ? r.json() : []),
          fetch("/api/vendors", { headers: authHeaders }).then(r => r.ok ? r.json() : []),
          fetch("/api/stores", { headers: authHeaders }).then(r => r.ok ? r.json() : { stores: [] }),
          fetch("/api/checks", { headers: authHeaders }).then(r => r.ok ? r.json().then(data => data.checks || []) : [])
        ]);
        setBanks(Array.isArray(b) ? b : []);
        setVendors(Array.isArray(v) ? v : []);
        setStores(Array.isArray(s?.stores) ? s.stores : (Array.isArray(s) ? s : []));
        setChecks(Array.isArray(c) ? c : []);
      } finally { setLoading(false); }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return checks.filter(ch => {
      if (status !== "All" && ch.status !== status) return false;
      if (!q) return true;
      return (
        (ch.referenceNumber || ch.checkNumber || "").toLowerCase().includes(q) ||
        (ch.vendor?.vendorName || "").toLowerCase().includes(q) ||
        (ch.bank?.store?.name || "").toLowerCase().includes(q) ||
        (ch.memo || "").toLowerCase().includes(q) ||
        (ch.issuedByUser?.username || "").toLowerCase().includes(q)
      );
    });
  }, [checks, search, status]);

  const paged = useMemo(() => {
    const start = page * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  const onUploadDone = (files: any[]) => {
    if (files && files.length > 0 && files[0].url) {
      setInvoiceUrl(files[0].url);
    }
  };

  const submit = async () => {
    if (!vendorId || !storeId || !amount) { toast.error("Please complete the form"); return; }
    if (!invoiceUrl) { toast.error("Invoice is required"); return; }
    try {
      setLoading(true);
      const body = {
        bankId: banks.find(b => b.store?.name && stores.find(s => s.id === storeId))?.id || banks[0]?.id,
        vendorId,
        amount: amount, // Send as string, API converts to cents to avoid floating-point errors
        memo: memo || undefined,
        paymentMethod,
        status: "Draft",
        invoiceUrl,
        storeId,
      };
      const res = await fetch('/api/checks', { method: 'POST', headers: authHeaders, body: JSON.stringify(body) });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.details || j.error || 'Create failed');
      }
      const created = await res.json();
      setChecks(prev => [created, ...prev]);
      setPaymentMethod("Cheque"); setCheckNumber(""); setVendorId(""); setStoreId(""); setAmount(""); setMemo(""); setInvoiceUrl(null);
      toast.success('Cheque created');
    } catch (e: any) {
      toast.error(`Failed to create cheque: ${e?.message || e}`);
    } finally { setLoading(false); }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Make a Payment */}
        <Card className="bg-background">
          <CardHeader>
            <CardTitle>Make a Payment</CardTitle>
            <CardDescription>Fill the form to create a new check</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Payment Method */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Payment Method</label>
              <Tabs value={paymentMethod} onValueChange={setPaymentMethod} className="w-full">
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="Cheque">Check</TabsTrigger>
                  <TabsTrigger value="EDI">EDI</TabsTrigger>
                  <TabsTrigger value="MO">MO</TabsTrigger>
                  <TabsTrigger value="Cash">Cash</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Check Number (read-only helper) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Check Number</label>
              <Input placeholder="Auto-assigned" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} />
            </div>

            {/* Vendor */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Vendor</label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.vendorName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Store */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Store</label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Amount</label>
              <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>

            {/* Memo */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Memo</label>
              <Textarea rows={3} placeholder="Optional" value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>

            {/* File */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">File</label>
              <FileUpload onFilesUploaded={onUploadDone} />
              {!invoiceUrl && <p className="text-xs text-muted-foreground">PNG, JPG, or PDF required.</p>}
            </div>

            {/* Submit */}
            <div className="flex justify-end">
              <Button onClick={submit} disabled={loading || !invoiceUrl}>Submit</Button>
            </div>
          </CardContent>
        </Card>

        {/* Right: Recent Checks */}
        <Card className="bg-background">
          <CardHeader>
            <CardTitle>Recent Checks</CardTitle>
            <CardDescription>Latest payments with invoice visibility</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Cleared">Cleared</SelectItem>
                  <SelectItem value="Voided">Voided</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(0)} disabled={page===0}>First</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p-1))} disabled={page===0}>Prev</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => (p+1) * pageSize < filtered.length ? p+1 : p)} disabled={(page+1)*pageSize >= filtered.length}>Next</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, Math.ceil(filtered.length/pageSize)-1))} disabled={(page+1)*pageSize >= filtered.length}>Last</Button>
                <Button variant="outline" size="sm" onClick={() => { setSearch(""); setStatus("All"); setPage(0); }}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Reset
                </Button>
              </div>
            </div>

            {/* Table */}
            {paged.length === 0 ? (
              <div className="text-center py-16">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <div className="text-foreground font-medium">No data</div>
                <div className="text-muted-foreground text-sm">No checks found for the current filters.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Created Date</TableHead>
                      <TableHead>Check Number</TableHead>
                      <TableHead>Vendors</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Memo</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{format(new Date(c.createdAt), "MMM dd, yyyy")}</TableCell>
                        <TableCell>{c.referenceNumber || c.checkNumber || 'N/A'}</TableCell>
                        <TableCell>{c.vendor?.vendorName || 'Unknown Vendor'}</TableCell>
                        <TableCell>{c.bank?.store?.name || 'Unknown Store'}</TableCell>
                        <TableCell>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(c.amount))}</TableCell>
                        <TableCell>{c.memo || '-'}</TableCell>
                        <TableCell>{c.issuedByUser?.username || 'Unknown'}</TableCell>
                        <TableCell>{c.invoiceUrl ? 'Yes' : 'No'}</TableCell>
                        <TableCell>{c.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


