"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Printer, FileText } from "lucide-react";
import CheckPrint from "@/components/CheckPrintComponent";

interface Check {
  id: string;
  checkNumber?: string;
  referenceNumber?: string;
  paymentMethod: string;
  amount: number;
  memo?: string;
  status: string;
  createdAt: string;
  bankId?: string;
  vendorId?: string;
  bank?: {
    id: string;
    bankName: string;
    accountNumber: string;
    routingNumber: string;
  };
  vendor?: {
    vendorName: string;
  };
  issuer?: {
    username: string;
  };
}

export default function CheckPrintingPage() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [field, setField] = useState<'number'|'vendor'|'amount'|'status'|'bank'|'user'>('number');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchChecks();
    // derive role from JWT (avoid AuthContext during prerender)
    try {
      const token = document.cookie
        .split('; ')
        .find(r => r.startsWith('auth-token='))
        ?.split('=')[1];
      if (token) {
        const payload = JSON.parse(typeof atob !== 'undefined' ? atob(token.split('.')[1]) : Buffer.from(token.split('.')[1], 'base64').toString());
        setIsAdmin(payload?.role === 'ADMIN');
      }
    } catch {
      setIsAdmin(false);
    }
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
        console.log("No authentication token found");
        setChecks([]);
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
        console.log("Authentication expired");
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

  const formatCheckDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Draft":
        return "bg-gray-100 text-gray-800";
      case "Submitted":
        return "bg-blue-100 text-blue-800";
      case "Approved":
        return "bg-green-100 text-green-800";
      case "Printed":
        return "bg-purple-100 text-purple-800";
      case "Reconciled":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return checks;
    const q = search.toLowerCase();
    return checks.filter(c => {
      switch (field) {
        case 'number': return (c.referenceNumber || c.checkNumber || '').toLowerCase().includes(q);
        case 'vendor': return (c.vendor?.vendorName || '').toLowerCase().includes(q);
        case 'amount': return String(c.amount).includes(search);
        case 'status': return (c.status || '').toLowerCase().includes(q);
        case 'bank': return (c.bank?.bankName || '').toLowerCase().includes(q);
        case 'user': return (c.issuer as any)?.username?.toLowerCase?.().includes(q) || false;
        default: return true;
      }
    });
  }, [checks, search, field]);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Check Printing</h1>
        <p className="text-muted-foreground mt-2">Print and manage checks</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Available Checks
          </CardTitle>
          <CardDescription>
            Select checks to print or download as PDF
          </CardDescription>
          {isAdmin && (
            <div className="mt-4 flex flex-wrap gap-2">
              <select
                className="border rounded px-2 py-1 bg-background"
                value={field}
                onChange={(e) => setField(e.target.value as any)}
              >
                <option value="number">Check #</option>
                <option value="vendor">Vendor</option>
                <option value="amount">Amount</option>
                <option value="status">Status</option>
                <option value="bank">Bank</option>
                <option value="user">User</option>
              </select>
              <input
                className="border rounded px-3 py-1 flex-1 min-w-[220px] bg-background"
                placeholder={`Search by ${field}`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-2"></div>
              Loading checks...
            </div>
          ) : checks.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No checks available</h3>
              <p className="text-muted-foreground">
                Create some checks first to print them.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((check) => (
                <Card key={check.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="font-semibold">
                          {check.paymentMethod === "Cheque" ? "Check" : check.paymentMethod} 
                          #{check.referenceNumber || check.checkNumber || 'N/A'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {check.vendor?.vendorName || 'Unknown Vendor'} • ${Number(check.amount).toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatCheckDate(check.createdAt)} • {check.bank?.bankName || 'Unknown Bank'}
                        </div>
                      </div>
                      <Badge className={getStatusColor(check.status)}>
                        {check.status}
                      </Badge>
                    </div>
                    <CheckPrint 
                      check={check} 
                      onPrint={() => console.log(`Printed check ${check.id}`)}
                    />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}