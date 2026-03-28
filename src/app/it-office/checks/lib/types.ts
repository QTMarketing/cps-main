export type PaymentMethod = 'CHECK' | 'EDI' | 'MO' | 'CASH';

export interface CheckRecord {
  id: string;
  createdAt: string; // ISO
  checkNumber: string;
  vendorId: string;
  vendorName: string;
  storeId: string;
  storeName: string;
  amount: number;
  memo?: string;
  userId: string;
  userName: string;
  invoiceUrl?: string;
  status: 'PENDING' | 'CLEARED' | 'VOIDED';
}


