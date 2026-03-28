"use client";

import { useState, useEffect, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Search, 
  Download, 
  FileText, 
  Eye,
  Calendar as CalendarIcon,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Filter,
  RefreshCw,
  Filter as FilterIcon,
  Columns as ColumnsIcon
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import jsPDF from "jspdf";
import InvoicePreviewModal from "@/components/invoices/InvoicePreviewModal";
import "jspdf-autotable";
import { toast } from "sonner";


interface Check {
  id: string;
  checkNumber?: string;
  referenceNumber?: string;
  paymentMethod: string;
  amount: number;
  memo?: string;
  status: string;
  createdAt: string;
  bank?: {
    bankName: string;
    store?: { name: string };
  };
  vendor?: {
    vendorName: string;
  };
  issuedByUser?: {
    username: string;
  };
  invoiceUrl?: string | null;
}

interface FilterState {
  searchTerm: string;
  paymentMethod: string;
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
}

export default function ReportsContent() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: "",
    paymentMethod: "all",
    dateRange: {
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    },
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewCheck, setPreviewCheck] = useState<string | null>(null);

  // Fetch checks data
  useEffect(() => {
    fetchChecks();
  }, []);

  const fetchChecks = async () => {
    try {
      setIsLoading(true);
      
      // Get authentication token from cookie
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth-token='))
        ?.split('=')[1];

      if (!token) {
        console.log("No authentication token found for checks");
        setChecks([]);
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/checks", {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Handle multiple response formats
        if (Array.isArray(data)) {
          setChecks(data);
        } else if (data.rows && Array.isArray(data.rows)) {
          setChecks(data.rows);
        } else if (data.checks && Array.isArray(data.checks)) {
          setChecks(data.checks);
        } else {
          console.error("Expected array or {rows/checks} but got:", data);
          setChecks([]);
        }
      } else if (response.status === 401) {
        console.log("Authentication expired for checks");
        setChecks([]);
      } else {
        console.error("Failed to fetch checks:", response.status);
        setChecks([]);
      }
    } catch (error) {
      console.error("Failed to fetch checks:", error);
      setChecks([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter data based on current filters
  const filteredData = useMemo(() => {
    return checks.filter((check) => {
      // Search term filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesSearch = 
          (check.referenceNumber || check.checkNumber || '').toLowerCase().includes(searchLower) ||
          (check.vendor?.vendorName || '').toLowerCase().includes(searchLower) ||
          (check.memo || '').toLowerCase().includes(searchLower) ||
          (check.issuedByUser?.username || '').toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Payment method filter
      if (filters.paymentMethod && filters.paymentMethod !== "all" && check.paymentMethod !== filters.paymentMethod) {
        return false;
      }

      // Date range filter
      if (filters.dateRange.from || filters.dateRange.to) {
        const checkDate = new Date(check.createdAt);
        if (filters.dateRange.from && checkDate < filters.dateRange.from) {
          return false;
        }
        if (filters.dateRange.to && checkDate > filters.dateRange.to) {
          return false;
        }
      }

      return true;
    });
  }, [checks, filters]);

  // Define columns
  const columnHelper = createColumnHelper<Check>();
  
  const columns: ColumnDef<Check>[] = [
    columnHelper.accessor("createdAt", {
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 lg:px-3"
        >
          Created Date
          {column.getIsSorted() === "asc" ? (
            <ChevronUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === "desc" ? (
            <ChevronDown className="ml-2 h-4 w-4" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ getValue }) => {
        const date = new Date(getValue());
        return format(date, "MMM dd, yyyy");
      },
    }),
    columnHelper.accessor((row) => row.referenceNumber || row.checkNumber || 'N/A', {
      id: "checkNumber",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 lg:px-3"
        >
          Check Number
          {column.getIsSorted() === "asc" ? (
            <ChevronUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === "desc" ? (
            <ChevronDown className="ml-2 h-4 w-4" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ getValue }) => getValue(),
    }),
    columnHelper.accessor((row) => row.vendor?.vendorName || 'Unknown Vendor', {
      id: "vendorName",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 lg:px-3"
        >
          Vendors
          {column.getIsSorted() === "asc" ? (
            <ChevronUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === "desc" ? (
            <ChevronDown className="ml-2 h-4 w-4" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ getValue }) => getValue(),
    }),
    columnHelper.accessor((row) => row.bank?.store?.name || 'Unknown Store', {
      id: "storeName",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 lg:px-3"
        >
          Store
          {column.getIsSorted() === "asc" ? (
            <ChevronUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === "desc" ? (
            <ChevronDown className="ml-2 h-4 w-4" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ getValue }) => getValue(),
    }),
    columnHelper.accessor("amount", {
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 lg:px-3"
        >
          Amount
          {column.getIsSorted() === "asc" ? (
            <ChevronUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === "desc" ? (
            <ChevronDown className="ml-2 h-4 w-4" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ getValue }) => {
        const amount = Number(getValue());
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(amount);
      },
    }),
    columnHelper.accessor("memo", {
      header: "Memo",
      cell: ({ getValue }) => {
        const memo = getValue();
        return memo ? (
          <div className="max-w-[200px] truncate" title={memo}>
            {memo}
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    }),
    columnHelper.accessor((row) => row.issuedByUser?.username || 'Unknown', {
      id: "username",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 lg:px-3"
        >
          User
          {column.getIsSorted() === "asc" ? (
            <ChevronUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === "desc" ? (
            <ChevronDown className="ml-2 h-4 w-4" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ getValue }) => getValue(),
    }),
    // Invoice Column
    columnHelper.display({
      id: 'invoice',
      header: 'Invoice',
      cell: ({ row }) => {
        const c = row.original;
        if (!c.invoiceUrl) {
          return <span className="text-muted-foreground">No Invoice</span>;
        }
        return (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setPreviewUrl(c.invoiceUrl!); setPreviewCheck(c.referenceNumber || c.checkNumber || null); }}>
              <Eye className="h-4 w-4 mr-1" /> View
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadInvoice(c.invoiceUrl!, c.referenceNumber || c.checkNumber || 'invoice')}>
              <Download className="h-4 w-4 mr-1" /> Download
            </Button>
          </div>
        );
      }
    })
  ];

  // Initialize table
  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  // Export functions
  const exportToCSV = () => {
    const headers = ["Created Date", "Check Number", "Vendors", "Store", "Amount", "Memo", "User", "Invoice"];
    const csvContent = [
      headers.join(","),
      ...filteredData.map((check) => [
        format(new Date(check.createdAt), "MMM dd, yyyy"),
        check.referenceNumber || check.checkNumber || 'N/A',
        check.vendor?.vendorName || 'Unknown Vendor',
        check.bank?.store?.name || 'Unknown Store',
        Number(check.amount),
        check.memo || "",
        check.issuedByUser?.username || 'Unknown',
        check.invoiceUrl ? check.invoiceUrl : 'No Invoice',
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `checks-report-${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text("Checks Report", 14, 22);
    
    // Add date range
    doc.setFontSize(12);
    const dateRangeText = `Date Range: ${filters.dateRange.from ? format(filters.dateRange.from, "MMM dd, yyyy") : "All"} - ${filters.dateRange.to ? format(filters.dateRange.to, "MMM dd, yyyy") : "All"}`;
    doc.text(dateRangeText, 14, 30);
    
    // Add table
    const tableData = filteredData.map((check) => [
      format(new Date(check.createdAt), "MMM dd, yyyy"),
      check.referenceNumber || check.checkNumber || 'N/A',
      check.vendor?.vendorName || 'Unknown Vendor',
      check.bank?.store?.name || 'Unknown Store',
      `$${Number(check.amount).toFixed(2)}`,
      check.memo || "",
      check.issuedByUser?.username || 'Unknown',
      check.invoiceUrl ? 'Yes' : 'No',
    ]);

    (doc as any).autoTable({
      head: [["Created Date", "Check Number", "Vendors", "Store", "Amount", "Memo", "User", "Invoice"]],
      body: tableData,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] },
    });

    doc.save(`checks-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const downloadInvoice = async (url: string, checkNo: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g,'-');
      a.href = URL.createObjectURL(blob);
      const ext = /pdf($|\?)/i.test(url) ? 'pdf' : 'jpg';
      a.download = `invoice-${checkNo}-${ts}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error('Download failed', e);
      toast.error('Failed to download invoice');
    }
  };

  const clearFilters = () => {
    setFilters({
      searchTerm: "",
      paymentMethod: "all",
      dateRange: {
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
      },
    });
    setGlobalFilter("");
  };

  const totalAmount = filteredData.reduce((sum, check) => sum + Number(check.amount), 0);

  return (
    <div className="container mx-auto p-6">
      {/* Top toolbar */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <Button onClick={exportToCSV}>Download all</Button>
          <details className="relative">
            <summary className="list-none">
              <Button variant="outline"><ColumnsIcon className="h-4 w-4 mr-2" /> Columns</Button>
            </summary>
            <div className="absolute right-0 mt-2 w-56 rounded-md border bg-popover p-2 shadow">
              {table.getAllLeafColumns().map((col) => (
                <label key={col.id} className="flex items-center gap-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={col.getIsVisible()}
                    onChange={(e) => col.toggleVisibility(e.target.checked)}
                  />
                  {col.columnDef.header && typeof col.columnDef.header === 'function' ? col.id : String(col.columnDef.header)}
                </label>
              ))}
            </div>
          </details>
        </div>
      </div>

      {/* Filter Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>
            Filter and search through check transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Check #, Payee, Memo..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Payment Method</label>
              <Select
                value={filters.paymentMethod}
                onValueChange={(value) => setFilters(prev => ({ ...prev, paymentMethod: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All methods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All methods</SelectItem>
                  <SelectItem value="Check">Check</SelectItem>
                  <SelectItem value="EDI">EDI</SelectItem>
                  <SelectItem value="MO">MO</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range From */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">From Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateRange.from ? format(filters.dateRange.from, "MMM dd, yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateRange.from}
                    onSelect={(date) => setFilters(prev => ({ 
                      ...prev, 
                      dateRange: { ...prev.dateRange, from: date } 
                    }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Date Range To */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">To Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateRange.to ? format(filters.dateRange.to, "MMM dd, yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateRange.to}
                    onSelect={(date) => setFilters(prev => ({ 
                      ...prev, 
                      dateRange: { ...prev.dateRange, to: date } 
                    }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
            <Button variant="outline" onClick={fetchChecks} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Checks</p>
                <p className="text-2xl font-bold">{filteredData.length}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(totalAmount)}
                </p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average Amount</p>
                <p className="text-2xl font-bold">
                  {filteredData.length > 0 
                    ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                      }).format(totalAmount / filteredData.length)
                    : "$0.00"
                  }
                </p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Check Transactions</CardTitle>
              <CardDescription>
                Showing {filteredData.length} of {checks.length} transactions
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportToCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={exportToPDF}>
                <FileText className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading checks...
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No checks found</h3>
              <p className="text-muted-foreground">
                Try adjusting your filters or create some checks first.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {filteredData.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center space-x-2">
                <p className="text-sm text-muted-foreground">
                  Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{" "}
                  {Math.min(
                    (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                    filteredData.length
                  )}{" "}
                  of {filteredData.length} entries
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <InvoicePreviewModal
        open={!!previewUrl}
        onClose={() => { setPreviewUrl(null); setPreviewCheck(null); }}
        invoiceUrl={previewUrl || ''}
        checkNumber={previewCheck}
      />
    </div>
  );
}
