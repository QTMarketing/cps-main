"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Edit, 
  Trash2, 
  Store as StoreIcon, 
  RefreshCw,
  MapPin,
  Phone,
  AlertCircle,
  Building2
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StoreBankAssignmentDialog } from "@/components/StoreBankAssignmentDialog";

interface Store {
  id: string;
  code: string;
  name: string;
  address: string;
  phone: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function StoresManagePage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [selectedStoreForBanks, setSelectedStoreForBanks] = useState<Store | null>(null);
  const [isBankAssignOpen, setIsBankAssignOpen] = useState(false);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      setIsLoading(true);
      
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth-token='))
        ?.split('=')[1];

      if (!token) {
        console.log("No authentication token found");
        setStores([]);
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/stores", {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setStores(data);
        } else if (Array.isArray(data.stores)) {
          setStores(data.stores);
        } else {
          console.error("Unexpected data format:", data);
          setStores([]);
        }
      } else if (response.status === 401) {
        console.log("Authentication expired");
        setStores([]);
      } else {
        console.error("Failed to fetch stores:", response.status);
        setStores([]);
      }
    } catch (error) {
      console.error("Failed to fetch stores:", error);
      setStores([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (storeId: string, storeName: string) => {
    if (!confirm(`Are you sure you want to delete store "${storeName}"? This action cannot be undone.`)) {
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

      const response = await fetch(`/api/stores/${storeId}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        showAlert("success", "Store deleted successfully!");
        fetchStores();
      } else {
        const errorData = await response.json();
        showAlert("error", errorData.error || "Failed to delete store");
      }
    } catch (error) {
      console.error("Error deleting store:", error);
      showAlert("error", "Failed to delete store. Please try again.");
    }
  };

  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const filteredStores = stores.filter((store) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      store.name.toLowerCase().includes(searchLower) ||
      store.code.toLowerCase().includes(searchLower) ||
      store.address.toLowerCase().includes(searchLower) ||
      store.phone?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (status: string) => {
    return status === "active" ? (
      <Badge variant="default" className="bg-green-500">Active</Badge>
    ) : (
      <Badge variant="secondary">Inactive</Badge>
    );
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Store Management</h1>
        <p className="text-muted-foreground mt-2">Manage store locations and settings</p>
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
                <StoreIcon className="h-5 w-5" />
                Stores
              </CardTitle>
              <CardDescription>
                {filteredStores.length} of {stores.length} stores
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchStores} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button onClick={() => window.location.href = '/add-store'}>
                <StoreIcon className="mr-2 h-4 w-4" />
                Add Store
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search stores by name, code, address, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Stores Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading stores...
            </div>
          ) : filteredStores.length === 0 ? (
            <div className="text-center py-8">
              <StoreIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {searchTerm ? "No stores found" : "No stores yet"}
              </h3>
              <p className="text-muted-foreground">
                {searchTerm 
                  ? "Try adjusting your search criteria."
                  : "Create your first store to get started."
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store Code</TableHead>
                    <TableHead>Store Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStores.map((store) => (
                    <TableRow key={store.id}>
                      <TableCell className="font-medium">
                        <Badge variant="outline">{store.code}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StoreIcon className="h-4 w-4 text-muted-foreground" />
                          {store.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 max-w-[300px]">
                          <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="truncate" title={store.address}>
                            {store.address}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {store.phone ? (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {store.phone}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(store.status)}
                      </TableCell>
                      <TableCell>
                        {new Date(store.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.location.href = `/stores/${store.id}/edit`}
                            title="Edit store"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedStoreForBanks(store); setIsBankAssignOpen(true); }}
                            title="Assign banks"
                          >
                            <Building2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(store.id, store.name)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedStoreForBanks && (
        <StoreBankAssignmentDialog
          store={{ id: Number(selectedStoreForBanks.id), name: selectedStoreForBanks.name }}
          open={isBankAssignOpen}
          onClose={() => setIsBankAssignOpen(false)}
          onSaved={() => {
            setIsBankAssignOpen(false);
            showAlert("success", "Bank assignments updated successfully");
          }}
        />
      )}
    </div>
  );
}
