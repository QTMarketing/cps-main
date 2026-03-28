"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type AccountRow = {
  id: string;
  dbaName: string;
  bankName: string;
  accountType: string;
  last4?: string;
  storeName?: string;
  name?: string | null;
};

type Store = {
  id: number;
  code?: string;
  name: string;
  address?: string;
  phone?: string;
  status?: string;
};

export default function AddUser() {
  // Left panel state
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<'USER' | 'STORE_USER' | 'BACK_OFFICE' | 'ADMIN' | 'OFFICE_ADMIN' | 'SUPER_ADMIN'>("USER");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Store assignment state
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [loadingStores, setLoadingStores] = useState(false);

  // Active user after create
  const [activeUserId, setActiveUserId] = useState<string>("");
  const [activeUsername, setActiveUsername] = useState<string>("");

  // Right panels state
  const [qUnassigned, setQUnassigned] = useState("");
  const [qAssigned, setQAssigned] = useState("");
  const [unassigned, setUnassigned] = useState<AccountRow[]>([]);
  const [assigned, setAssigned] = useState<AccountRow[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);

  const [selUnassigned, setSelUnassigned] = useState<Record<string, boolean>>({});
  const [selAssigned, setSelAssigned] = useState<Record<string, boolean>>({});

  const getToken = () => {
    if (typeof document === 'undefined') return undefined;
    const cookies = document.cookie.split('; ');
    const authCookie = cookies.find(r => r.startsWith('auth-token='));
    return authCookie?.split('=')[1];
  };

  // PHASE 1: Load stores on mount
  useEffect(() => {
    const fetchStores = async () => {
      setLoadingStores(true);
      try {
        const t = getToken();
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          ...(t && { Authorization: `Bearer ${t}` }),
        };
        
        const res = await fetch('/api/stores', { 
          headers, 
          credentials: 'include' 
        });
        
        if (!res.ok) {
          console.error('Failed to load stores:', res.status);
          return;
        }
        
        const data = await res.json();
        const storesArray = data?.stores || [];
        setStores(storesArray);
        console.log('[AddUser] Loaded stores:', storesArray.length);
      } catch (err) {
        console.error('Error loading stores:', err);
      } finally {
        setLoadingStores(false);
      }
    };
    
    fetchStores();
  }, []);

  // loadAccounts — fetches assigned/unassigned via UserBank join table
  const loadAccounts = async (userId: string) => {
    if (!userId) {
      setUnassigned([]);
      setAssigned([]);
      return;
    }

    setLoadingLists(true);
    
    try {
      const t = getToken();
      
      if (!t) {
        window.location.href = '/login';
        return;
      }
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${t}`,
      };

      const res = await fetch(`/api/users/${userId}/banks`, { headers, credentials: 'include' });

      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        console.error('[loadAccounts] Failed:', res.status);
        setUnassigned([]);
        setAssigned([]);
        return;
      }

      const data = await res.json();

      const toRow = (b: any): AccountRow => ({
        id: String(b.id),
        dbaName: b.storeName || b.bank_name || '',
        bankName: b.bank_name || '',
        accountType: b.account_type || 'CHECKING',
        last4: b.last4 || '····',
        storeName: b.storeName || 'Unassigned Store',
      });

      let derivedUnassigned: AccountRow[] = (data.unassigned || []).map(toRow);
      let derivedAssigned: AccountRow[] = (data.assigned || []).map(toRow);

      // Apply search filters
      if (qUnassigned.trim()) {
        const q = qUnassigned.toLowerCase();
        derivedUnassigned = derivedUnassigned.filter(b =>
          b.dbaName.toLowerCase().includes(q) || b.bankName.toLowerCase().includes(q)
        );
      }

      if (qAssigned.trim()) {
        const q = qAssigned.toLowerCase();
        derivedAssigned = derivedAssigned.filter(b =>
          b.dbaName.toLowerCase().includes(q) || b.bankName.toLowerCase().includes(q)
        );
      }
      
      setUnassigned(derivedUnassigned);
      setAssigned(derivedAssigned);
    } catch (err) {
      console.error('Error loading accounts:', err);
      setUnassigned([]);
      setAssigned([]);
    } finally {
      setLoadingLists(false);
    }
  };

  // Re-load when search changes or activeUserId changes
  useEffect(() => { 
    if (activeUserId) {
      loadAccounts(activeUserId); 
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [activeUserId, qUnassigned, qAssigned]);

  const createUser = async () => {
    setError(null);
    setSuccessMessage(null);
    
    // Client-side validation
    if (!username || !password) {
      setError("Username and password are required");
      return;
    }
    
    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters long");
      return;
    }
    
    if (username.trim().length > 50) {
      setError("Username must be no more than 50 characters long");
      return;
    }
    
    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }
    
    // Validate store selection for store-scoped roles only
    if ((role === 'USER' || role === 'STORE_USER') && !selectedStoreId) {
      setError(`Store assignment is required for ${role} users. Please select a store.`);
      return;
    }
    
    try {
      setCreating(true);
      const t = getToken();
      const headers: any = { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
      
      // Step 1: Create user with storeId directly
      const res = await fetch('/api/users', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ 
          username: username.trim(), 
          password,
          role,
          storeId: selectedStoreId ? parseInt(selectedStoreId, 10) : undefined,
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        
        // Handle 403 Forbidden - user is not an admin
        if (res.status === 403) {
          throw new Error('Only administrators can create users. Please contact your system administrator.');
        }
        
        // If it's a validation error, show the details
        if (errorData?.details && Array.isArray(errorData.details)) {
          const validationMessages = errorData.details
            .map((issue: any) => {
              const field = issue.path?.join('.') || 'field';
              return `${field}: ${issue.message}`;
            })
            .join(', ');
          throw new Error(`Validation error: ${validationMessages}`);
        }
        
        throw new Error(errorData?.error || 'Failed to create user');
      }
      
      const data = await res.json();
      
      // PHASE 2: Normalize response
      const created = data?.user ?? data;
      const userId = created?.id ? String(created.id) : '';
      
      if (!userId) {
        console.error('[createUser] User created but no ID in response. Response:', data);
        console.error('[createUser] created object:', created);
        throw new Error('User created but no ID returned');
      }
      
      console.log('[createUser] Created user with ID:', userId);
      
      // PHASE 3: Set active user state IMMEDIATELY
      setActiveUserId(userId);
      setActiveUsername(username.trim());
      
      // Success message
      const storeName = selectedStoreId ? stores.find(s => s.id === parseInt(selectedStoreId, 10))?.name : null;
      if (storeName) {
        setSuccessMessage(`User ${username.trim()} created and assigned to ${storeName}`);
      } else {
        setSuccessMessage(`Created user: ${username.trim()} (${role})`);
      }
      
      // Clear form
      setUsername(""); 
      setPassword(""); 
      setRole("USER");
      setSelectedStoreId("");
      setSelUnassigned({});
      setSelAssigned({});
      
      // Load accounts immediately after creation (activeUserId is already set)
      await loadAccounts(userId);
      
    } catch (e: any) {
      setError(e?.message || String(e));
      console.error('Error creating user:', e);
    } finally {
      setCreating(false);
    }
  };

  const toggleAll = (list: AccountRow[], map: Record<string, boolean>, setter: (v: Record<string, boolean>) => void, checked: boolean) => {
    const next: Record<string, boolean> = {};
    if (checked) list.forEach(r => { next[r.id] = true; });
    setter(next);
  };

  const bulkAssign = async () => {
    const ids = Object.keys(selUnassigned).filter(k => selUnassigned[k]).map(Number);
    if (!ids.length || !activeUserId) return;
    
    setError(null);
    setSuccessMessage(null);
    
    try {
      const t = getToken();
      const headers: any = { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
      
      const res = await fetch(`/api/users/${activeUserId}/banks`, { 
        method: 'PUT', 
        headers, 
        body: JSON.stringify({ assignBankIds: ids, unassignBankIds: [] }),
        credentials: 'include',
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Failed to assign banks');
      }
      
      setSuccessMessage(`Assigned ${ids.length} account(s) to ${activeUsername}`);
      setSelUnassigned({});
      await loadAccounts(activeUserId);
    } catch (e: any) {
      setError(e?.message || 'Failed to assign banks');
    }
  };

  const bulkUnassign = async () => {
    const ids = Object.keys(selAssigned).filter(k => selAssigned[k]).map(Number);
    if (!ids.length || !activeUserId) return;
    
    setError(null);
    setSuccessMessage(null);
    
    try {
      const t = getToken();
      const headers: any = { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
      
      const res = await fetch(`/api/users/${activeUserId}/banks`, { 
        method: 'PUT', 
        headers, 
        body: JSON.stringify({ assignBankIds: [], unassignBankIds: ids }),
        credentials: 'include',
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Failed to unassign banks');
      }
      
      setSuccessMessage(`Unassigned ${ids.length} account(s) from ${activeUsername}`);
      setSelAssigned({});
      await loadAccounts(activeUserId);
    } catch (e: any) {
      setError(e?.message || 'Failed to unassign banks');
    }
  };

  // PHASE D: Count selected for button disable
  const selectedUnassignedCount = Object.keys(selUnassigned).filter(k => selUnassigned[k]).length;
  const selectedAssignedCount = Object.keys(selAssigned).filter(k => selAssigned[k]).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Add User</h1>
        <p className="text-muted-foreground">Create a user and manage account access</p>
      </div>

      {/* PHASE D: Success banner */}
      {successMessage && (
        <div className="rounded-md border border-green-500/30 bg-green-500/10 text-green-300 p-3 flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-green-300 hover:text-green-100">✕</button>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 text-red-300 p-3 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-300 hover:text-red-100">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Create User */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="space-y-2">
            <label className="text-sm">Username</label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="jane" />
          </div>
          <div className="space-y-2">
            <label className="text-sm">Display Name</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="space-y-2">
            <label className="text-sm">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" />
          </div>
          <div className="space-y-2">
            <label className="text-sm">Role</label>
            <div className="flex gap-3 text-sm">
              {(['USER','STORE_USER','BACK_OFFICE','ADMIN','OFFICE_ADMIN','SUPER_ADMIN'] as const).map(r => (
                <label key={r} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer ${role===r? 'bg-emerald-600 text-white border-emerald-500':'bg-background text-foreground border-border'}`}>
                  <input type="radio" name="role" value={r} checked={role===r} onChange={() => setRole(r)} className="accent-emerald-500" />
                  {r.replace('_',' ')}
                </label>
              ))}
            </div>
          </div>
          
          {/* PHASE 1: Store dropdown */}
          <div className="space-y-2">
            <label className="text-sm">
              Store {(role === 'USER' || role === 'STORE_USER') && <span className="text-red-500">*</span>}
            </label>
            {loadingStores ? (
              <div className="text-xs text-muted-foreground py-2">Loading stores...</div>
            ) : stores.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2">
                No stores available. Create a store first.
              </div>
            ) : (
              <select 
                value={selectedStoreId} 
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                disabled={role === 'BACK_OFFICE' || role === 'SUPER_ADMIN' || role === 'OFFICE_ADMIN' || role === 'ADMIN'}
              >
                <option value="">-- Select Store --</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>
                    {store.code ? `${store.code} - ${store.name}` : store.name}
                  </option>
                ))}
              </select>
            )}
            {(role === 'USER' || role === 'STORE_USER') && (
              <p className="text-xs text-muted-foreground">
                Required for store-scoped accounts
              </p>
            )}
            {(role === 'BACK_OFFICE') && (
              <p className="text-xs text-muted-foreground">
                Back Office users do not need a store assignment (reports-only).
              </p>
            )}
          </div>
          
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => { setUsername(""); setDisplayName(""); setPassword(""); setRole('USER'); setSelectedStoreId(""); setError(null); setSuccessMessage(null); }}>Cancel</Button>
            <Button 
              onClick={createUser} 
              disabled={creating || ((role === 'USER' || role === 'STORE_USER') && !selectedStoreId) || !username || !password} 
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {creating? 'Creating...':'Create User'}
            </Button>
          </div>
          
          {activeUserId && (
            <div className="pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground">
                <div className="font-medium text-foreground mb-1">Active User:</div>
                <div>{activeUsername} (ID: {activeUserId})</div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Unassigned / Assigned */}
        <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Unassigned */}
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Unassigned Accounts</h2>
              <div className="flex items-center gap-2">
                <input id="ua_all" type="checkbox" className="accent-emerald-500" onChange={(e) => toggleAll(unassigned, selUnassigned, setSelUnassigned, e.target.checked)} disabled={!activeUserId || unassigned.length === 0} />
                <label htmlFor="ua_all" className="text-sm text-muted-foreground">Select All</label>
              </div>
            </div>
            <Input placeholder="Search..." value={qUnassigned} onChange={(e)=>setQUnassigned(e.target.value)} className="mb-3" disabled={!activeUserId} />
            <div className="space-y-2 max-h-[420px] overflow-auto">
              {!activeUserId ? (
                <div className="text-sm text-muted-foreground p-3 border border-border rounded-md bg-muted/30">
                  <div className="font-medium mb-1">Create a user first</div>
                  <div className="text-xs">Fill in the form on the left to create a user, then assign accounts here.</div>
                </div>
              ) : loadingLists ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : unassigned.length === 0 ? (
                <div className="text-sm text-muted-foreground p-3 border border-border rounded-md bg-muted/30">
                  <div className="font-medium mb-1">All accounts assigned</div>
                  <div className="text-xs">No unassigned accounts available for this user.</div>
                </div>
              ) : unassigned.map(a => (
                <div key={a.id} className="flex items-start gap-3 border border-border rounded-md p-3">
                  <input 
                    type="checkbox" 
                    className="accent-emerald-500 mt-1" 
                    checked={!!selUnassigned[a.id]} 
                    onChange={(e)=> setSelUnassigned(prev=>({ ...prev, [a.id]: e.target.checked }))} 
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{a.dbaName}</div>
                    <div className="text-xs text-muted-foreground mt-1">{a.accountType}</div>
                    <div className="text-xs text-muted-foreground">{a.bankName}</div>
                  </div>
                </div>
              ))}
            </div>
            {activeUserId && (
              <div className="mt-3 flex justify-end">
                <Button 
                  size="sm" 
                  className="bg-emerald-600 hover:bg-emerald-500 text-white" 
                  onClick={bulkAssign} 
                  disabled={selectedUnassignedCount === 0}
                >
                  Assign Selected ({selectedUnassignedCount})
                </Button>
              </div>
            )}
          </div>

          {/* Assigned */}
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Assigned Accounts</h2>
              <div className="flex items-center gap-2">
                <input id="as_all" type="checkbox" className="accent-emerald-500" onChange={(e) => toggleAll(assigned, selAssigned, setSelAssigned, e.target.checked)} disabled={!activeUserId || assigned.length === 0} />
                <label htmlFor="as_all" className="text-sm text-muted-foreground">Select All</label>
              </div>
            </div>
            <Input placeholder="Search..." value={qAssigned} onChange={(e)=>setQAssigned(e.target.value)} className="mb-3" disabled={!activeUserId} />
            <div className="space-y-2 max-h-[420px] overflow-auto">
              {!activeUserId ? (
                <div className="text-sm text-muted-foreground p-3 border border-border rounded-md bg-muted/30">
                  <div className="font-medium mb-1">Create a user first</div>
                  <div className="text-xs">Fill in the form on the left to create a user, then manage assignments here.</div>
                </div>
              ) : loadingLists ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : assigned.length === 0 ? (
                <div className="text-sm text-muted-foreground p-3 border border-border rounded-md bg-muted/30">
                  <div className="font-medium mb-1">No assigned accounts</div>
                  <div className="text-xs">No accounts are currently assigned. Select accounts from "Unassigned Accounts" and click "Assign Selected".</div>
                </div>
              ) : assigned.map(a => (
                <div key={a.id} className="flex items-start gap-3 border border-border rounded-md p-3">
                  <input 
                    type="checkbox" 
                    className="accent-emerald-500 mt-1" 
                    checked={!!selAssigned[a.id]} 
                    onChange={(e)=> setSelAssigned(prev=>({ ...prev, [a.id]: e.target.checked }))} 
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{a.dbaName || a.name || 'N/A'}</div>
                    <div className="text-xs text-muted-foreground mt-1">{a.accountType || 'CHECKING'}</div>
                    <div className="text-xs text-muted-foreground">{a.bankName}</div>
                  </div>
                </div>
              ))}
            </div>
            {activeUserId && (
              <div className="mt-3 flex justify-end">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={bulkUnassign}
                  disabled={selectedAssignedCount === 0}
                >
                  Unassign Selected ({selectedAssignedCount})
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

