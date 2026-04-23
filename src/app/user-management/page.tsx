"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Key, 
  Eye, 
  EyeOff,
  User,
  Mail,
  Shield,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle
} from "lucide-react";
import RoleSwitcher from "@/components/RoleSwitcher";
import { BankAssignmentDialog } from "@/components/BankAssignmentDialog";
import { VendorAssignmentDialog } from "@/components/VendorAssignmentDialog";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_STORE_USER_CHEQUE_LIMIT_CENTS } from "@/lib/chequeLimits";

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["SUPER_ADMIN", "OFFICE_ADMIN", "ADMIN", "BACK_OFFICE", "STORE_USER", "USER"]),
  storeId: z.string().optional(),
});

const updateUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").optional(),
  email: z.string().email("Invalid email address").optional(),
  role: z.enum(["SUPER_ADMIN", "OFFICE_ADMIN", "ADMIN", "BACK_OFFICE", "STORE_USER", "USER"]).optional(),
  storeId: z.string().min(1, "Store is required").optional(),
  /** Dollars as text; empty = org default ($3,999) for store users */
  maxChequeAmountDollars: z.string().optional(),
});

const updatePasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// =============================================================================
// TYPES
// =============================================================================

interface User {
  id: string;
  username: string;
  email: string;
  role: "SUPER_ADMIN" | "OFFICE_ADMIN" | "ADMIN" | "BACK_OFFICE" | "STORE_USER" | "USER";
  storeId: string;
  storeName?: string | null;
  /** Super-admin override in cents; null/undefined = default $3,999 for store users */
  maxChequeAmountCents?: number | null;
  createdAt: string;
  updatedAt: string;
  store?: {
    name: string;
  };
  _count?: {
    checks: number;
  };
}

interface Store {
  id: string;
  name: string;
  address: string;
  phone: string;
}

function storeUserChequeLimitLabel(u: User): string {
  if (u.role !== "USER" && u.role !== "STORE_USER") return "—";
  const cents = u.maxChequeAmountCents ?? DEFAULT_STORE_USER_CHEQUE_LIMIT_CENTS;
  const isDefault = u.maxChequeAmountCents == null;
  const dollars = (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isDefault ? `$${dollars} (default)` : `$${dollars}`;
}

type CreateUserFormData = z.infer<typeof createUserSchema>;
type UpdateUserFormData = z.infer<typeof updateUserSchema>;
type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>;

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const canManageBanks =
    currentUser?.role === "SUPER_ADMIN";
  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  const [users, setUsers] = useState<User[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isBankDialogOpen, setIsBankDialogOpen] = useState(false);
  const [isVendorDialogOpen, setIsVendorDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Create user form
  const createForm = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      role: "USER",
      storeId: "",
    },
  });

  // Update user form
  const updateForm = useForm<UpdateUserFormData>({
    resolver: zodResolver(updateUserSchema),
  });

  // Update password form
  const passwordForm = useForm<UpdatePasswordFormData>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  useEffect(() => {
    fetchUsers();
    fetchStores();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth-token='))
        ?.split('=')[1];

      if (!token) {
        console.log("No authentication token found for users");
        setUsers([]);
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/users", {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[UserManagement] Fetched users:', { count: data?.length || 0, firstUser: data?.[0] });
        if (Array.isArray(data)) {
          setUsers(data);
        } else if (data.users && Array.isArray(data.users)) {
          setUsers(data.users);
        } else {
          console.warn('[UserManagement] Unexpected response format:', data);
          setUsers([]);
        }
      } else if (response.status === 401) {
        console.log("Authentication expired for users");
        setUsers([]);
      } else {
        console.error("Failed to fetch users:", response.status);
        setUsers([]);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth-token='))
        ?.split('=')[1];

      if (!token) {
        console.log("No authentication token found for stores");
        setStores([]);
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
        } else if (data.stores) {
          setStores(data.stores);
        } else {
          setStores([]);
        }
      } else if (response.status === 401) {
        console.log("Authentication expired for stores");
        setStores([]);
      } else {
        console.error("Failed to fetch stores:", response.status);
        setStores([]);
      }
    } catch (error) {
      console.error("Error fetching stores:", error);
      setStores([]);
    }
  };

  // =============================================================================
  // UTILITY FUNCTIONS
  // =============================================================================

  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
    case "SUPER_ADMIN":
      return "default";
      case "ADMIN":
        return "destructive";
      case "USER":
        return "secondary";
      default:
        return "outline";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // =============================================================================
  // FORM HANDLERS
  // =============================================================================

  const onCreateUser = async (data: CreateUserFormData) => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth-token='))
        ?.split('=')[1];

      if (!token) {
        showAlert("error", "Authentication required. Please log in.");
        return;
      }

      // Validate store requirement for store-scoped roles only
      if ((data.role === 'USER' || data.role === 'STORE_USER') && !data.storeId) {
        showAlert("error", `Store assignment is required for ${data.role} users.`);
        return;
      }

      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: data.username,
          password: data.password,
          role: data.role,
          storeId: data.storeId ? parseInt(data.storeId, 10) : undefined,
        }),
      });

      if (response.ok) {
        const newUser = await response.json();
        console.log('[UserManagement] Created user:', newUser);
        
        // Refresh users list to get updated store information
        await fetchUsers();
        
        showAlert("success", `User "${newUser.username}" created successfully`);
        setIsCreateDialogOpen(false);
        createForm.reset();
      } else {
        const errorData = await response.json();
        showAlert("error", errorData.message || errorData.error || "Failed to create user");
      }
    } catch (error) {
      console.error("Error creating user:", error);
      showAlert("error", "Error creating user");
    }
  };

  const onUpdateUser = async (data: UpdateUserFormData) => {
    if (!selectedUser) return;

    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth-token='))
        ?.split('=')[1];

      if (!token) {
        showAlert("error", "Authentication required. Please log in.");
        return;
      }

      const payload: Record<string, unknown> = {
        username: data.username,
        email: data.email,
        role: data.role,
        storeId: data.storeId,
      };

      if (
        isSuperAdmin &&
        (selectedUser.role === "USER" || selectedUser.role === "STORE_USER")
      ) {
        const raw = (data.maxChequeAmountDollars ?? "").trim();
        if (raw === "") {
          payload.maxChequeAmountCents = null;
        } else {
          const n = parseFloat(raw);
          if (!Number.isFinite(n) || n <= 0) {
            showAlert("error", "Max cheque amount must be a positive number.");
            return;
          }
          payload.maxChequeAmountCents = Math.round(n * 100);
        }
      }

      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        showAlert("success", "User updated successfully");
        setIsEditDialogOpen(false);
        setSelectedUser(null);
        updateForm.reset();
        fetchUsers();
      } else {
        const errorData = await response.json();
        showAlert("error", errorData.error || "Failed to update user");
      }
    } catch (error) {
      console.error("Error updating user:", error);
      showAlert("error", "Error updating user");
    }
  };

  const onUpdatePassword = async (data: UpdatePasswordFormData) => {
    if (!selectedUser || isUpdatingPassword) return;

    try {
      setIsUpdatingPassword(true);

      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth-token='))
        ?.split('=')[1];

      if (!token) {
        showAlert("error", "Authentication required. Please log in.");
        return;
      }

      console.log('[UserManagement] Updating password for user:', selectedUser.id);

      const response = await fetch(`/api/users/${selectedUser.id}/password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ password: data.password }),
      });

      console.log('[UserManagement] Password update response status:', response.status);

      if (response.ok) {
        showAlert("success", "Password updated successfully");
        setIsPasswordDialogOpen(false);
        setSelectedUser(null);
        passwordForm.reset();
      } else {
        const errorData = await response.json();
        console.error('[UserManagement] Password update error:', errorData);
        showAlert("error", errorData.error || "Failed to update password");
      }
    } catch (error) {
      console.error("Error updating password:", error);
      showAlert("error", "Error updating password");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const onDeleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to delete user "${user.username}"?`)) {
      return;
    }

    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth-token='))
        ?.split('=')[1];

      if (!token) {
        showAlert("error", "Authentication required. Please log in.");
        return;
      }

      const response = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (response.ok) {
        showAlert("success", "User deleted successfully");
        fetchUsers();
      } else {
        const errorData = await response.json();
        showAlert("error", errorData.error || "Failed to delete user");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      showAlert("error", "Error deleting user");
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    updateForm.reset({
      username: user.username,
      email: user.email,
      role: user.role,
      storeId: user.storeId,
      maxChequeAmountDollars:
        user.maxChequeAmountCents != null
          ? String(user.maxChequeAmountCents / 100)
          : "",
    });
    setIsEditDialogOpen(true);
  };

  const openPasswordDialog = (user: User) => {
    setSelectedUser(user);
    passwordForm.reset();
    setIsPasswordDialogOpen(true);
  };

  const openVendorDialog = (user: User) => {
    setSelectedUser(user);
    setIsVendorDialogOpen(true);
  };

  // =============================================================================
  // FILTERING
  // =============================================================================

  const filteredUsers = users.filter((user) => {
    const matchesSearch = 
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = !roleFilter || roleFilter === "all" || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  // =============================================================================
  // RENDER
  // =============================================================================

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading users...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">
            Manage users, roles, and permissions for your organization
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new user to the system with appropriate role and permissions.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={createForm.handleSubmit(onCreateUser)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  {...createForm.register("username")}
                  placeholder="Enter username"
                />
                {createForm.formState.errors.username && (
                  <p className="text-sm text-red-500">
                    {createForm.formState.errors.username.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...createForm.register("email")}
                  placeholder="Enter email"
                />
                {createForm.formState.errors.email && (
                  <p className="text-sm text-red-500">
                    {createForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    {...createForm.register("password")}
                    placeholder="Enter password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {createForm.formState.errors.password && (
                  <p className="text-sm text-red-500">
                    {createForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select onValueChange={(value) => createForm.setValue("role", value as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                    <SelectItem value="OFFICE_ADMIN">Office Admin</SelectItem>
                    <SelectItem value="USER">User</SelectItem>
                    <SelectItem value="STORE_USER">Store User</SelectItem>
                    <SelectItem value="BACK_OFFICE">Back Office</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
                {createForm.formState.errors.role && (
                  <p className="text-sm text-red-500">
                    {createForm.formState.errors.role.message}
                  </p>
                )}
              </div>

              {/* Store dropdown - required for store-scoped roles */}
              {(createForm.watch("role") === "USER" || createForm.watch("role") === "STORE_USER") && (
                <div className="space-y-2">
                  <Label htmlFor="storeId">
                    Store <span className="text-red-500">*</span>
                  </Label>
                  <Select onValueChange={(value) => createForm.setValue("storeId", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select store" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No stores available
                        </div>
                      ) : (
                        stores.map((store) => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {createForm.formState.errors.storeId && (
                    <p className="text-sm text-red-500">
                      {createForm.formState.errors.storeId.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Required for store-scoped accounts
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create User</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alert */}
      {alert && (
        <Alert className={`mb-6 ${alert.type === "error" ? "border-red-500" : "border-green-500"}`}>
          {alert.type === "error" ? (
            <XCircle className="h-4 w-4" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                  <SelectItem value="OFFICE_ADMIN">Office Admin</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="BACK_OFFICE">Back Office</SelectItem>
                  <SelectItem value="STORE_USER">Store User</SelectItem>
                  <SelectItem value="USER">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
          <CardDescription>
            Manage user accounts, roles, and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Store</TableHead>
                    {isSuperAdmin && (
                      <TableHead>Max cheque</TableHead>
                    )}
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{user.username}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <RoleSwitcher
                          userId={user.id}
                          currentRole={user.role as "USER" | "STORE_USER" | "BACK_OFFICE" | "ADMIN" | "OFFICE_ADMIN" | "SUPER_ADMIN"}
                          compact={true}
                          onRoleChange={(newRole) => {
                            // Update local state
                            setUsers(users.map(u => 
                              u.id === user.id ? { ...u, role: newRole } : u
                            ));
                            // Refresh users list
                            fetchUsers();
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{user.store?.name || "Unknown"}</span>
                        </div>
                      </TableCell>
                      {isSuperAdmin && (
                        <TableCell className="text-sm whitespace-nowrap">
                          {storeUserChequeLimitLabel(user)}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{formatDate(user.createdAt)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPasswordDialog(user)}
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          {canManageBanks && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Assign bank accounts"
                              onClick={() => {
                                setSelectedUser(user);
                                setIsBankDialogOpen(true);
                              }}
                            >
                              <Building2 className="h-4 w-4" />
                            </Button>
                          )}
                          {isSuperAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Assign vendors"
                              onClick={() => openVendorDialog(user)}
                            >
                              <Shield className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteUser(user)}
                            className="text-red-500 hover:text-red-700"
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

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and role assignments.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={updateForm.handleSubmit(onUpdateUser)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                {...updateForm.register("username")}
                placeholder="Enter username"
              />
              {updateForm.formState.errors.username && (
                <p className="text-sm text-red-500">
                  {updateForm.formState.errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                {...updateForm.register("email")}
                placeholder="Enter email"
              />
              {updateForm.formState.errors.email && (
                <p className="text-sm text-red-500">
                  {updateForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select onValueChange={(value) => updateForm.setValue("role", value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                  <SelectItem value="OFFICE_ADMIN">Office Admin</SelectItem>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="STORE_USER">Store User</SelectItem>
                  <SelectItem value="BACK_OFFICE">Back Office</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
              {updateForm.formState.errors.role && (
                <p className="text-sm text-red-500">
                  {updateForm.formState.errors.role.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-storeId">Store</Label>
              <Select onValueChange={(value) => updateForm.setValue("storeId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {updateForm.formState.errors.storeId && (
                <p className="text-sm text-red-500">
                  {updateForm.formState.errors.storeId.message}
                </p>
              )}
            </div>

            {isSuperAdmin &&
              selectedUser &&
              (selectedUser.role === "USER" || selectedUser.role === "STORE_USER") && (
                <div className="space-y-2">
                  <Label htmlFor="edit-max-cheque">Max cheque amount ($)</Label>
                  <Input
                    id="edit-max-cheque"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder={`Default ${DEFAULT_STORE_USER_CHEQUE_LIMIT_CENTS / 100}`}
                    {...updateForm.register("maxChequeAmountDollars")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum amount per single cheque. Leave empty for the default ($
                    {(DEFAULT_STORE_USER_CHEQUE_LIMIT_CENTS / 100).toFixed(0)}).
                  </p>
                </div>
              )}

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update User</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Vendors Dialog */}
      {selectedUser && (
        <VendorAssignmentDialog
          user={{ id: selectedUser.id, username: selectedUser.username }}
          open={isVendorDialogOpen}
          callerRole={currentUser?.role || ""}
          onClose={() => setIsVendorDialogOpen(false)}
          onSaved={() => {
            setIsVendorDialogOpen(false);
            showAlert("success", "Vendors updated successfully");
          }}
        />
      )}

      {/* Update Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.username}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={passwordForm.handleSubmit(onUpdatePassword)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  {...passwordForm.register("password")}
                  placeholder="Enter new password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {passwordForm.formState.errors.password && (
                <p className="text-sm text-red-500">
                  {passwordForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                {...passwordForm.register("confirmPassword")}
                placeholder="Confirm new password"
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-sm text-red-500">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                The user will need to log in with the new password after this change.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsPasswordDialogOpen(false)}
                disabled={isUpdatingPassword}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isUpdatingPassword}
              >
                {isUpdatingPassword ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bank Assignment Dialog */}
      {selectedUser && (
        <BankAssignmentDialog
          user={{
            id: selectedUser.id,
            username: selectedUser.username,
            storeId: selectedUser.storeId,
          }}
          open={isBankDialogOpen}
          onClose={() => setIsBankDialogOpen(false)}
          onSaved={() => {
            setIsBankDialogOpen(false);
            fetchUsers();
          }}
          callerRole={currentUser?.role ?? "ADMIN"}
        />
      )}

    </div>
  );
}
