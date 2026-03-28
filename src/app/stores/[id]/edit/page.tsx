"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2, Store as StoreIcon } from "lucide-react";

export default function EditStorePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Form state
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  // Check authentication and fetch store data
  useEffect(() => {
    const init = async () => {
      try {
        const sessionRes = await fetch('/api/auth/session', {
          credentials: 'include',
        });
        
        if (!sessionRes.ok) {
          router.push('/login');
          return;
        }

        const sessionData = await sessionRes.json();
        const role = sessionData?.user?.role;
        
        if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
          setError('Unauthorized: Only administrators can edit stores');
          setTimeout(() => router.push('/stores/manage'), 2000);
          return;
        }

        setUserRole(role);

        // Fetch store data
        const token = document.cookie
          .split('; ')
          .find(row => row.startsWith('auth-token='))
          ?.split('=')[1];

        const storeRes = await fetch(`/api/stores/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!storeRes.ok) {
          throw new Error('Failed to fetch store details');
        }

        const storeData = await storeRes.json();
        setCode(storeData.code || "");
        setName(storeData.name || "");
        setAddress(storeData.address || "");
        setPhone(storeData.phone || "");

      } catch (err: any) {
        console.error('Initialization failed:', err);
        setError(err.message || 'Failed to load store details');
      } finally {
        setFetching(false);
      }
    };

    init();
  }, [id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

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

      const response = await fetch(`/api/stores/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          phone: phone.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update store (${response.status})`);
      }

      setSuccess(`Store "${name}" updated successfully!`);
      
      setTimeout(() => {
        router.push('/stores/manage');
      }, 1500);

    } catch (err: any) {
      console.error('Error updating store:', err);
      setError(err.message || 'Failed to update store. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <StoreIcon className="h-6 w-6 text-primary" />
            <CardTitle>Edit Store: {code}</CardTitle>
          </div>
          <CardDescription>
            Update store information and contact details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success && (
            <Alert className="mb-6 border-green-500 bg-green-500/10 text-green-300">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert className="mb-6 border-red-500 bg-red-500/10 text-red-300">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="code">Store Code</Label>
              <Input id="code" value={code} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">
                Store code cannot be changed as it is used for internal tracking.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Store Name / DBA <span className="text-red-500">*</span></Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., QT 126"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Store address"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Store phone number"
                disabled={loading}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/stores/manage')}
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
                    Updating...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
