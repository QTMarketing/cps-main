export interface ReportCheck {
  id: string;
  createdAt: string;
  checkNumber: number;
  dba: string; // DBA (Doing Business As) from bank
  payeeName: string; // Payee (Vendor) name
  vendorName?: string; // Vendor name if available
  amount: number;
  memo?: string;
  userName: string; // User who created/issued the check
  invoiceUrl?: string; // Invoice URL if available
  status: 'PENDING' | 'CLEARED' | 'VOIDED';
  paymentMethod?: 'Check' | 'EDI' | 'MO' | 'Cash';
}


