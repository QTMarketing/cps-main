"use server";

import type { CheckRecord, PaymentMethod } from "./types";
import { getBaseUrl } from "@/lib/http/baseUrl";

type ListChecksParams = {
  q?: string;
  status?: 'All' | 'PENDING' | 'CLEARED' | 'VOIDED';
  page?: number;
  pageSize?: number;
  storeId?: string;
  vendorId?: string;
};

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

const mapPaymentToDb = (m: PaymentMethod): 'Check' | 'EDI' | 'MO' | 'Cash' => {
  switch (m) {
    case 'CHECK': return 'Check';
    case 'EDI': return 'EDI';
    case 'MO': return 'MO';
    case 'CASH': return 'Cash';
  }
};

export async function listChecks(params: ListChecksParams): Promise<{ rows: CheckRecord[]; total: number; }> {
  // Fetch from Prisma API (Lightsail DB) instead of Supabase
  try {
    const page = Math.max(0, params.page ?? 0);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 10));
    const token = typeof document !== 'undefined'
      ? (document.cookie.split('; ').find(r => r.startsWith('auth-token='))?.split('=')[1] || '')
      : '';

    const baseUrl = getBaseUrl();
    let url = `${baseUrl}/api/checks?page=${page}&limit=${pageSize}`;
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
    } as RequestInit);

    if (res.status === 401 && token) {
      res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      } as RequestInit);
    }

    if (!res.ok) {
      console.error('Failed to fetch checks:', res.status);
      return { rows: [], total: 0 };
    }

    const data = await res.json();
    const checks = Array.isArray(data) ? data : (data?.checks || []);
    const total = data?.total ?? checks.length;
    
    console.log('listChecks: fetched', checks.length, 'checks, total:', total);

    const rows: CheckRecord[] = checks.map((row: any) => ({
      id: row.id,
      createdAt: row.createdAt || row.created_at,
      checkNumber: String(row.checkNumber || row.check_number || row.referenceNumber || ''),
      vendorId: row.vendorId || row.vendor?.id || '',
      vendorName: row.vendor?.vendorName || row.vendor?.vendor_name || 'Unknown Vendor',
      storeId: row.vendor?.store?.id || row.storeId || '',
      storeName: row.vendor?.store?.name || row.store?.name || 'Unknown Store',
      amount: Number(row.amount || 0),
      memo: row.memo || undefined,
      userId: row.issuedByUser?.id || row.issuedBy || '',
      userName: row.issuedByUser?.username || 'Unknown',
      invoiceUrl: row.invoiceUrl || row.invoice_url || undefined,
      status: mapDbStatusToUi(row.status || 'ISSUED'),
    } as CheckRecord));

    return { rows, total };
  } catch (error) {
    console.error('Error fetching checks:', error);
    return { rows: [], total: 0 };
  }
}

export async function listVendors(): Promise<{ id: string; name: string; }[]> {
  try {
    const baseUrl = getBaseUrl();
    let res = await fetch(`${baseUrl}/api/vendors`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
    } as RequestInit);
    if (res.status === 401 && typeof document !== 'undefined') {
      const token = document.cookie.split('; ').find(r => r.startsWith('auth-token='))?.split('=')[1];
      if (token) {
        res = await fetch(`${baseUrl}/api/vendors`, {
          method: 'GET',
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        } as RequestInit);
      }
    }
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data?.vendors) ? data.vendors : data; // support {vendors: []} or []
    return (list || []).map((v: any) => ({ id: v.id, name: v.vendorName || v.vendor_name }));
  } catch {
    return [];
  }
}

export async function listStores(): Promise<{ id: string; name: string; }[]> {
  try {
    const baseUrl = getBaseUrl();
    let res = await fetch(`${baseUrl}/api/stores`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
    } as RequestInit);
    if (res.status === 401 && typeof document !== 'undefined') {
      const token = document.cookie.split('; ').find(r => r.startsWith('auth-token='))?.split('=')[1];
      if (token) {
        res = await fetch(`${baseUrl}/api/stores`, {
          method: 'GET',
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        } as RequestInit);
      }
    }
    if (!res.ok) return [];
    const json = await res.json();
    const list = Array.isArray(json?.stores) ? json.stores : json;
    return (list || []).map((s: any) => ({ id: s.id, name: s.name }));
  } catch {
    return [];
  }
}

export async function listBanks(): Promise<{ id: string; name: string; storeId: string; }[]> {
  // Fetch from our Prisma API; rely on same-origin cookies for auth
  try {
    const baseUrl = getBaseUrl();
    let res = await fetch(`${baseUrl}/api/banks`, {
      method: 'GET',
      cache: 'no-store',
      // Ensure cookies are sent on same-origin
      credentials: 'same-origin',
    } as RequestInit);

    // If cookie wasn't attached (some browsers/contexts), retry with Authorization header from cookie value
    if (res.status === 401 && typeof document !== 'undefined') {
      const token = document.cookie.split('; ').find(r => r.startsWith('auth-token='))?.split('=')[1];
      if (token) {
        res = await fetch(`${baseUrl}/api/banks`, {
          method: 'GET',
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        } as RequestInit);
      }
    }

    if (!res.ok) return [];
    const banks = await res.json();
    return (banks || []).map((b: any) => ({
      id: b.id,
      name: b.bankName || b.bank_name || 'Unnamed Bank',
      storeId: b.storeId || b.store_id || '',
    }));
  } catch {
    return [];
  }
}

// Note: getNextCheckNumber, createCheck, and updateCheckInvoiceUrl functions
// have been moved to client-data.ts and now use the Prisma API instead of Supabase.
// These functions are no longer needed here as they were replaced by API calls.


