"use server";

import { cookies } from 'next/headers';

export async function listVendors(): Promise<{ id: string; name: string; }[]> {
  try {
    // Get token from cookies (server-side)
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value || '';

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL 
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    let res = await fetch(`${baseUrl}/api/vendors`, {
      method: 'GET',
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    } as RequestInit);

    if (!res.ok) return [];
    const data = await res.json();
    const vendors = Array.isArray(data?.vendors) ? data.vendors : (data || []);
    return (vendors || []).map((v: any) => ({ 
      id: String(v.id || ''), 
      name: v.vendorName || v.vendor_name || 'Unknown Vendor' 
    }));
  } catch {
    return [];
  }
}

export async function listStores(): Promise<{ id: string; name: string; }[]> {
  try {
    // Stores are not part of the current schema, return empty array
    // This matches the /api/stores endpoint behavior
    return [];
  } catch {
    return [];
  }
}


