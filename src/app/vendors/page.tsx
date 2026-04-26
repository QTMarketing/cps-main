"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Building2, 
  Filter,
  RefreshCw,
  User,
  Mail,
  Phone
} from "lucide-react";

// Validation schema
const vendorSchema = z.object({
  vendorName: z.string().min(1, "Vendor name is required"),
  vendorType: z.enum(["Merchandise", "Expense", "Employee"], {
    message: "Please select a vendor type",
  }),
  description: z.string().optional(),
  contact: z.string().optional(),
});

type VendorFormData = z.infer<typeof vendorSchema>;

interface Vendor {
  id: string;
  vendorName: string;
  vendorType: string;
  description?: string;
  contact?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
  accounts?: Array<{
    id: string;
    bankName: string;
    dbaName: string;
    accountType: string;
    storeId?: string | null;
    storeName?: string | null;
    storeCode?: string | null;
  }>;
}

interface Store {
  id: string;
  name: string;
  address: string;
  phone: string;
}
export default function VendorsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // Redirect non-SUPER_ADMIN users
  useEffect(() => {
    if (user !== undefined && user !== null && !isSuperAdmin) {
      router.replace("/unauthorized");
    }
  }, [user, isSuperAdmin, router]);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<VendorFormData>({
    resolver: zodResolver(vendorSchema),
  });

  // Fetch data on component mount
  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setIsLoading(true);
      
      // Get authentication token from cookie
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth-token='))
        ?.split('=')[1];

      if (!token) {
        console.log("No authentication token found for vendors");
        setVendors([]);
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/vendors", {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Handle multiple response formats
        if (Array.isArray(data)) {
          setVendors(data);
        } else if (data.vendors && Array.isArray(data.vendors)) {
          setVendors(data.vendors);
        } else {
          console.error("Expected array or {vendors} but got:", data);
          setVendors([]);
        }
      } else if (response.status === 401) {
        console.log("Authentication expired for vendors");
        setVendors([]);
      } else {
        console.error("Failed to fetch vendors:", response.status);
        setVendors([]);
      }
    } catch (error) {
      console.error("Failed to fetch vendors:", error);
      setVendors([]);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: VendorFormData) => {
    setIsSubmitting(true);
    try {
      const url = editingVendor ? `/api/vendors/${editingVendor.id}` : "/api/vendors";
      const method = editingVendor ? "PUT" : "POST";

      // Normalize vendorType to uppercase to match backend enum
      const normalizedData = {
        ...data,
        vendorType: data.vendorType.toUpperCase() as "MERCHANDISE" | "EXPENSE" | "EMPLOYEE"
      };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(normalizedData),
      });

      if (response.ok) {
        reset();
        setIsModalOpen(false);
        setEditingVendor(null);
        fetchVendors();
        toast.success(editingVendor ? "Vendor updated successfully!" : "Vendor created successfully!");
      } else {
        throw new Error("Failed to save vendor");
      }
    } catch (error) {
      console.error("Error saving vendor:", error);
      toast.error("Failed to save vendor. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setValue("vendorName", vendor.vendorName);
    setValue("vendorType", vendor.vendorType as "Merchandise" | "Expense" | "Employee");
    setValue("description", vendor.description || "");
    setValue("contact", vendor.contact || vendor.contactPerson || "");
    setIsModalOpen(true);
  };

  const handleDelete = async (vendorId: string) => {
    if (!confirm("Are you sure you want to delete this vendor?")) {
      return;
    }

    try {
      const response = await fetch(`/api/vendors/${vendorId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchVendors();
        toast.success("Vendor deleted successfully!");
      } else {
        throw new Error("Failed to delete vendor");
      }
    } catch (error) {
      console.error("Error deleting vendor:", error);
      toast.error("Failed to delete vendor. Please try again.");
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingVendor(null);
    reset();
  };

  // Filter vendors based on search and filter criteria
  const filteredVendors = vendors.filter((vendor) => {
    const matchesSearch = searchTerm === "" || 
      vendor.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.contact?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterType === "all" || vendor.vendorType === filterType;

    return matchesSearch && matchesFilter;
  });

  const getVendorTypeColor = (type: string) => {
    switch (type) {
      case "Merchandise":
        return "bg-blue-100 text-blue-800";
      case "Expense":
        return "bg-green-100 text-green-800";
      case "Employee":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Vendor Management</h1>
        <p className="text-muted-foreground mt-2">Manage vendors and their information</p>
      </div>

      {/* Action Bar */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Vendors
              </CardTitle>
              <CardDescription>
                {filteredVendors.length} of {vendors.length} vendors
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchVendors} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              {isSuperAdmin && (
              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => handleModalClose()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Vendor
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>
                      {editingVendor ? "Edit Vendor" : "Add New Vendor"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingVendor 
                        ? "Update vendor information below." 
                        : "Fill in the vendor information below to create a new vendor."
                      }
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {/* Vendor Name */}
                    <div className="space-y-2">
                      <Label htmlFor="vendorName">Vendor Name *</Label>
                      <Input
                        id="vendorName"
                        {...register("vendorName")}
                        placeholder="Enter vendor name"
                        className={errors.vendorName ? "border-red-500" : ""}
                      />
                      {errors.vendorName && (
                        <p className="text-sm text-red-500">{errors.vendorName.message}</p>
                      )}
                    </div>

                    {/* Vendor Type */}
                    <div className="space-y-2">
                      <Label htmlFor="vendorType">Vendor Type *</Label>
                      <Select onValueChange={(value) => setValue("vendorType", value as any)}>
                        <SelectTrigger className={errors.vendorType ? "border-red-500" : ""}>
                          <SelectValue placeholder="Select vendor type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Merchandise">Merchandise</SelectItem>
                          <SelectItem value="Expense">Expense</SelectItem>
                          <SelectItem value="Employee">Employee</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.vendorType && (
                        <p className="text-sm text-red-500">{errors.vendorType.message}</p>
                      )}
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        {...register("description")}
                        placeholder="Enter vendor description"
                        rows={3}
                      />
                    </div>

                    {/* Contact Details */}
                    <div className="space-y-2">
                      <Label htmlFor="contact">Contact Details</Label>
                      <Input
                        id="contact"
                        {...register("contact")}
                        placeholder="Email, phone, or contact information"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={handleModalClose} className="flex-1">
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting} className="flex-1">
                        {isSubmitting ? "Saving..." : editingVendor ? "Update Vendor" : "Create Vendor"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and Filter */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search vendors by name, description, or contact..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-48">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Merchandise">Merchandise</SelectItem>
                  <SelectItem value="Expense">Expense</SelectItem>
                  <SelectItem value="Employee">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Vendors Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading vendors...
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {searchTerm || filterType !== "all" ? "No vendors found" : "No vendors yet"}
              </h3>
              <p className="text-muted-foreground">
                {searchTerm || filterType !== "all" 
                  ? "Try adjusting your search or filter criteria."
                  : "Create your first vendor to get started."
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Stores</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Created</TableHead>
                    {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendors.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {vendor.vendorName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getVendorTypeColor(vendor.vendorType)}>
                          {vendor.vendorType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const names = Array.from(
                            new Set(
                              (vendor.accounts ?? [])
                                .map((a) => a.storeName)
                                .filter((n): n is string => !!n)
                            )
                          );
                          if (names.length === 0) return <span className="text-muted-foreground">-</span>;
                          return (
                            <div className="flex flex-wrap gap-1 max-w-[220px]">
                              {names.slice(0, 4).map((n) => (
                                <Badge key={n} variant="outline" className="text-xs">
                                  {n}
                                </Badge>
                              ))}
                              {names.length > 4 && (
                                <Badge variant="outline" className="text-xs">
                                  +{names.length - 4} more
                                </Badge>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate" title={vendor.description}>
                          {vendor.description || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {vendor.contact?.includes("@") ? (
                            <Mail className="h-4 w-4 text-muted-foreground" />
                          ) : vendor.contact?.match(/\d/) ? (
                            <Phone className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <User className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="max-w-[150px] truncate">
                            {vendor.contact || "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(vendor.createdAt).toLocaleDateString("en-US", {
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
                            onClick={() => handleEdit(vendor)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(vendor.id)}
                            className="text-red-600 hover:text-red-700"
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
    </div>
  );
}