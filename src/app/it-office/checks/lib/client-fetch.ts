// Client-only data fetching functions (not server actions)
// These run in the browser and can use relative URLs

import type { CheckRecord } from "./types";

type ListChecksParams = {
  q?: string;
  status?: 'All' | 'PENDING' | 'CLEARED' | 'VOIDED';
  page?: number;
  pageSize?: number;
  storeId?: string;
  vendorId?: string;
  bankId?: string;
};

function getTokenFromCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie.split('; ').find(r => r.startsWith('auth-token='))?.split('=')[1];
}

const mapStatusToDb = (s?: 'PENDING' | 'CLEARED' | 'VOIDED') => {
  if (!s) return undefined;
  if (s === 'PENDING') return 'ISSUED' as const;
  if (s === 'CLEARED') return 'CLEARED' as const;
  if (s === 'VOIDED') return 'VOIDED' as const;
  return undefined;
};

const mapDbStatusToUi = (s: string): CheckRecord['status'] => {
  switch (s) {
    case 'ISSUED':
      return 'PENDING';
    case 'CLEARED':
      return 'CLEARED';
    case 'VOIDED':
      return 'VOIDED';
    default:
      return 'PENDING';
  }
};

export async function listChecksClient(params: ListChecksParams): Promise<{ rows: CheckRecord[]; total: number; }> {
  try {
    const page = Math.max(0, params.page ?? 0);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 10));
    const token = getTokenFromCookie();

    let url = `/api/checks?page=${page}&limit=${pageSize}`;
    if (params.bankId) {
      url += `&bankId=${encodeURIComponent(params.bankId)}`;
    }
    if (params.status && params.status !== 'All') {
      const dbStatus = mapStatusToDb(params.status);
      if (dbStatus) url += `&status=${encodeURIComponent(dbStatus)}`;
    }
    if (params.q && params.q.trim()) {
      url += `&search=${encodeURIComponent(params.q.trim())}`;
    }
    if (params.vendorId) {
      url += `&vendorId=${encodeURIComponent(params.vendorId)}`;
    }
    if (params.storeId) {
      url += `&storeId=${encodeURIComponent(params.storeId)}`;
    }

    let res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
    });

    if (res.status === 401 && token) {
      res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    if (!res.ok) {
      console.error('Failed to fetch checks:', res.status);
      return { rows: [], total: 0 };
    }

    const data = await res.json();
    
    console.log('[client-fetch] Response keys:', Object.keys(data));
    console.log('[client-fetch] data.rows?.length:', data?.rows?.length, 'data.checks?.length:', data?.checks?.length);
    
    // Normalize response shape - support multiple formats
    const rawRows = data?.rows ?? data?.checks ?? data?.data ?? [];
    console.log('[client-fetch] rawRows.length:', rawRows.length, 'isArray:', Array.isArray(rawRows));
    
    if (!Array.isArray(rawRows)) {
      console.warn('[client-fetch] Response rows is not an array, coercing to empty array');
      return { rows: [], total: 0 };
    }
    
    const total = data?.total ?? rawRows.length;

    const rows: CheckRecord[] = rawRows.map((row: any) => ({
      id: row.id,
      createdAt: row.createdAt || row.created_at,
      checkNumber: String(row.checkNumber || row.check_number || row.referenceNumber || ''),
      vendorId: row.vendorId || row.vendor?.id || '',
      vendorName: row.vendor?.vendorName || row.vendor?.vendor_name || row.payeeName || row.payee_name || 'Unknown Vendor',
      storeId: row.storeId || row.store?.id || '',
      storeName: row.storeName || row.store?.name || 'Unknown Store',
      amount: Number(row.amount || 0),
      memo: row.memo || undefined,
      userId: row.issuedByUser?.id || row.issuedBy || '',
      userName: row.issuedByUser?.username || row.userName || 'Unknown',
      invoiceUrl: row.invoiceUrl || row.invoice_url || undefined,
      status: mapDbStatusToUi(row.status || 'ISSUED'),
    } as CheckRecord));

    console.log('[client-fetch] Mapped rows.length:', rows.length, 'total:', total);
    if (rows.length > 0) {
      console.log('[client-fetch] First row:', { id: rows[0].id, checkNumber: rows[0].checkNumber, vendorName: rows[0].vendorName });
    }

    return { rows, total };
  } catch (error) {
    console.error('Error fetching checks:', error);
    return { rows: [], total: 0 };
  }
}

export type Store = {
  id: string;
  name: string;
  address?: string;
  status?: string;
  region?: string;
};

export async function listStoresClient(): Promise<Store[]> {
  try {
    const token = getTokenFromCookie();

    let res = await fetch('/api/stores', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
    });

    if (res.status === 401 && token) {
      res = await fetch('/api/stores', {
        method: 'GET',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    if (!res.ok) {
      console.error('Failed to fetch stores:', res.status);
      return [];
    }

    const data = await res.json();
    const stores = data?.stores ?? [];

    return stores.map((s: any) => ({
      id: s.id.toString(),
      name: s.name,
      address: s.address,
      status: s.status,
      region: s.region,
    }));
  } catch (error) {
    console.error('Error fetching stores:', error);
    return [];
  }
}
