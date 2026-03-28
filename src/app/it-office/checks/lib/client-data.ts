// Client-safe data helpers for Make Payment

import type { PaymentMethod } from "./types";

function getTokenFromCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie.split('; ').find(r => r.startsWith('auth-token='))?.split('=')[1];
}

export type BankOption = {
  id: string;
  name: string;
  storeId: string;
  storeName: string;
  accountType: string;
  last4: string;
};

export async function listBanks(storeId?: string): Promise<BankOption[]> {
  const token = getTokenFromCookie();
  const url = storeId ? `/api/banks/my?storeId=${encodeURIComponent(storeId)}` : '/api/banks/my';
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
    console.warn('Failed to load banks for user:', res.status);
    return [];
  }

  const data = await res.json();
  console.log('[LISTBANKS CLIENT] Raw API response:', JSON.stringify(data, null, 2));
  const list = Array.isArray(data?.banks) ? data.banks : data;
  console.log('[LISTBANKS CLIENT] Extracted list length:', list?.length || 0);

  return (list || []).map((b: any): BankOption => ({
    id: String(b.id ?? b.bankId ?? ''),
    name: b.bankName || b.bank_name || 'Unnamed Bank',
    storeId: String(b.storeId || b.store_id || ''),
    storeName: b.storeName || 'Unassigned Store',
    accountType: b.accountType || b.account_type || 'CHECKING',
    last4: b.last4 || '····',
  }));
}

export async function listVendors(bankId: string): Promise<{ id: string; name: string; }[]> {
  if (!bankId) return [];
  const url = `/api/vendors?bankId=${encodeURIComponent(bankId)}`;
  let res = await fetch(url, { method: 'GET', cache: 'no-store', credentials: 'include' } as RequestInit);
  if (res.status === 401) {
    const token = getTokenFromCookie();
    if (token) {
      res = await fetch(url, { method: 'GET', cache: 'no-store', headers: { Authorization: `Bearer ${token}` } } as RequestInit);
    }
  }
  if (!res.ok) return [];
  const data = await res.json();
  const list = Array.isArray(data?.vendors) ? data.vendors : data;
  return (list || []).map((v: any) => ({ id: String(v.id ?? ''), name: v.vendorName || v.vendor_name }));
}

export async function listStores(): Promise<{ id: string; name: string; }[]> {
  let res = await fetch('/api/stores', { method: 'GET', cache: 'no-store', credentials: 'include' } as RequestInit);
  if (res.status === 401) {
    const token = getTokenFromCookie();
    if (token) {
      res = await fetch('/api/stores', { method: 'GET', cache: 'no-store', headers: { Authorization: `Bearer ${token}` } } as RequestInit);
    }
  }
  if (!res.ok) return [];
  const data = await res.json();
  const list = Array.isArray(data?.stores) ? data.stores : data;
  return (list || []).map((s: any) => ({ id: s.id, name: s.name }));
}

export async function getNextCheckNumber(storeId?: string): Promise<number> {
  if (!storeId) return 1; // No preview without store
  
  const token = getTokenFromCookie();
  const url = `/api/stores/${encodeURIComponent(storeId)}/next-check-number`;
  
  let res = await fetch(url, { cache: 'no-store', credentials: 'include' } as RequestInit);
  if (res.status === 401 && token) {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } } as RequestInit);
  }
  if (!res.ok) return 1;
  const json = await res.json();
  return Number(json?.next || 1);
}

export async function createCheck(input: { paymentMethod: PaymentMethod; bankId: string; vendorId: string; storeId?: string; amount: string | number; memo?: string; payeeName?: string; }): Promise<{ ok: boolean; id?: string; checkNumber?: number; error?: string; }> {
  const token = getTokenFromCookie();
  const payload = {
    paymentMethod: input.paymentMethod === 'CHECK' ? 'Cheque' : input.paymentMethod === 'CASH' ? 'Cash' : input.paymentMethod,
    bankId: input.bankId,
    vendorId: input.vendorId,
    amount: input.amount,
    memo: input.memo,
    payeeName: input.payeeName,
  } as any;
  if (input.storeId) {
    payload.storeId = input.storeId;
  }
  const res = await fetch('/api/checks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  } as RequestInit);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, error: text || `HTTP ${res.status}` };
  }
  const json = await res.json();
  return {
    ok: true,
    id: json?.id,
    checkNumber: Number(json?.checkNumber || json?.referenceNumber || 0),
  };
}

export async function updateCheckInvoiceUrl(checkId: string, invoiceUrl: string): Promise<{ ok: boolean; error?: string; }> {
  const token = getTokenFromCookie();
  const res = await fetch(`/api/checks/${encodeURIComponent(checkId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ invoiceUrl }),
  } as RequestInit);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, error: text || `HTTP ${res.status}` };
  }
  return { ok: true };
}


