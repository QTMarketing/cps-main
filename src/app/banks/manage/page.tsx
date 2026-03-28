"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Edit, 
  Trash2, 
  Building2, 
  RefreshCw,
  CreditCard,
  AlertCircle,
  ShoppingBag
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { VendorBankAssignmentDialog } from "@/components/VendorBankAssignmentDialog";

interface Bank {
  id: string;
  bank_name: string;
  dba: string | null;
  account_number: string;
  routing_number: string;
  account_type: string;
  signature_url: string | null;
  created_at: string;
}

export default function BanksManagePage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [banks, setBanks] = useState<Bank[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [selectedBankForVendors, setSelectedBankForVendors] = useState<Bank | null>(null);
  const [isVendorAssignOpen, setIsVendorAssignOpen] = useState(false);

  useEffect(() => {
    fetchBanks();
  }, []);

  const fetchBanks = async () => {
    try {
      setIsLoading(true);
      
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth-token='))
        ?.split('=')[1];

      if (!token) {
        console.log("No authentication token found");
        setBanks([]);
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/banks", {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.banks)) {
          setBanks(data.banks);
        } else if (Array.isArray(data)) {
          setBanks(data);
        } else {
          console.error("Unexpected data format:", data);
          setBanks([]);
        }
      } else if (response.status === 401) {
        console.log("Authentication expired");
        setBanks([]);
      } else {
        console.error("Failed to fetch banks:", response.status);
        setBanks([]);
      }
    } catch (error) {
      console.error("Failed to fetch banks:", error);
      setBanks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (bankId: string, bankName: string) => {
    if (!confirm(`Are you sure you want to delete bank "${bankName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth-token='))
        ?.split('=')[1];

      if (!token) {
        showAlert("error", "Authentication required");
        return;
      }

      const response = await fetch(`/api/banks/${bankId}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        showAlert("success", "Bank deleted successfully!");
        fetchBanks();
      } else {
        const errorData = await response.json();
        showAlert("error", errorData.error || "Failed to delete bank");
      }
    } catch (error) {
      console.error("Error deleting bank:", error);
      showAlert("error", "Failed to delete bank. Please try again.");
    }
  };

  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const filteredBanks = banks.filter((bank) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      bank.bank_name.toLowerCase().includes(searchLower) ||
      bank.dba?.toLowerCase().includes(searchLower) ||
      bank.account_number.includes(searchTerm) ||
      bank.routing_number.includes(searchTerm)
    );
  });

  const maskAccountNumber = (accountNumber: string) => {
    if (accountNumber.length <= 4) return accountNumber;
    return '****' + accountNumber.slice(-4);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Bank Management</h1>
        <p className="text-muted-foreground mt-2">Manage bank accounts and settings</p>
      </div>

      {alert && (
        <Alert className={`mb-6 ${alert.type === "success" ? "border-green-500 bg-green-50 dark:bg-green-950" : "border-red-500 bg-red-50 dark:bg-red-950"}`}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Banks
              </CardTitle>
              <CardDescription>
                {filteredBanks.length} of {banks.length} banks
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchBanks} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              {isSuperAdmin && (
                <Button onClick={() => window.location.href = '/banks/add'}>
                  <Building2 className="mr-2 h-4 w-4" />
                  Add Bank
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search banks by name, DBA, account, or routing number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Banks Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading banks...
            </div>
          ) : filteredBanks.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {searchTerm ? "No banks found" : "No banks yet"}
              </h3>
              <p className="text-muted-foreground">
                {searchTerm 
                  ? "Try adjusting your search criteria."
                  : "Create your first bank account to get started."
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bank Name</TableHead>
                    <TableHead>DBA</TableHead>
                    <TableHead>Account Type</TableHead>
                    <TableHead>Account Number</TableHead>
                    <TableHead>Routing Number</TableHead>
                    <TableHead>Signature</TableHead>
                    <TableHead>Created</TableHead>
                    {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBanks.map((bank) => (
                    <TableRow key={bank.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {bank.bank_name}
                        </div>
                      </TableCell>
                      <TableCell>{bank.dba || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{bank.account_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {maskAccountNumber(bank.account_number)}
                        </code>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {bank.routing_number}
                        </code>
                      </TableCell>
                      <TableCell>
                        {bank.signature_url ? (
                          <Badge variant="default" className="bg-green-500">
                            <CreditCard className="h-3 w-3 mr-1" />
                            Set
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Not Set</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(bank.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      {isSuperAdmin && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.location.href = `/banks/${bank.id}/edit`}
                              title="Edit bank"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setSelectedBankForVendors(bank); setIsVendorAssignOpen(true); }}
                              title="Assign vendors"
                            >
                              <ShoppingBag className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(bank.id, bank.bank_name)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedBankForVendors && (
        <VendorBankAssignmentDialog
          bank={{ id: Number(selectedBankForVendors.id), bank_name: selectedBankForVendors.bank_name }}
          open={isVendorAssignOpen}
          onClose={() => setIsVendorAssignOpen(false)}
          onSaved={() => {
            setIsVendorAssignOpen(false);
          }}
        />
      )}
    </div>
  );
}
