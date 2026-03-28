"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function AddStorePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Form state
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  // Check authentication and role
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/session', {
          credentials: 'include',
        });
        
        if (!res.ok) {
          router.push('/login');
          return;
        }

        const data = await res.json();
        const role = data?.user?.role;
        
        if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
          setError('Unauthorized: Only administrators can create stores');
          setTimeout(() => router.push('/write-checks'), 2000);
          return;
        }

        setUserRole(role);
      } catch (err) {
        console.error('Auth check failed:', err);
        router.push('/login');
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (!code.trim()) {
      setError("Store code is required (e.g., '126' for QT 126)");
      return;
    }

    if (!name.trim()) {
      setError("Store name is required");
      return;
    }

    setLoading(true);

    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth-token='))
        ?.split('=')[1];

      const response = await fetch('/api/stores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          address: address.trim() || undefined,
          status: 'active',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create store (${response.status})`);
      }

      const data = await response.json();
      console.log('[AddStore] Created store:', data);

      setSuccess(`Store "${name}" (${code}) created successfully!`);
      
      // Reset form
      setCode("");
      setName("");
      setAddress("");

      // Redirect to Write Checks after 1.5 seconds
      setTimeout(() => {
        router.push('/write-checks');
      }, 1500);

    } catch (err: any) {
      console.error('Error creating store:', err);
      setError(err.message || 'Failed to create store. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/write-checks');
  };

  // Show loading state while checking auth
  if (checkingAuth) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Show error if not authorized
  if (error && !userRole) {
    return (
      <div className="container mx-auto p-6">
        <Alert className="border-red-500">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Add New Store</CardTitle>
          <CardDescription>
            Create a new store location (e.g., QT 126, Wholesale A). This store will be available for check creation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Success Alert */}
          {success && (
            <Alert className="mb-6 border-green-500 bg-green-500/10 text-green-300">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Error Alert */}
          {error && userRole && (
            <Alert className="mb-6 border-red-500 bg-red-500/10 text-red-300">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Store Code */}
            <div className="space-y-2">
              <Label htmlFor="code">
                Store Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g., 126"
                disabled={loading}
                maxLength={10}
              />
              <p className="text-xs text-muted-foreground">
                Numeric code for this store (e.g., "58", "126" - used for check numbering)
              </p>
            </div>

            {/* Store Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Store Name / DBA <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., QT 126 or PND SUNS 2 INC"
                disabled={loading}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                Full name or DBA of the store
              </p>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">Address (Optional)</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g., 123 Main St, City, State 12345"
                disabled={loading}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                Physical address of the store
              </p>
            </div>

            {/* Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Store'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Helper Info */}
      <div className="mt-6 p-4 rounded-md bg-muted/50 border border-border">
        <h3 className="text-sm font-semibold mb-2">💡 Tips:</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Store Code should be numeric (e.g., "58", "126") - it determines check numbers</li>
          <li>• Example: Store 58 → check numbers start at 580001, 580002, etc.</li>
          <li>• Store Name is the full business name or DBA</li>
          <li>• After creating a store, it will appear in the Write Checks dropdown</li>
          <li>• You can assign bank accounts to stores later</li>
        </ul>
      </div>
    </div>
  );
}
