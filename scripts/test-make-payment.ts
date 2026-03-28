/*
  Dev E2E: create a check and upload a dummy invoice, then verify it appears
  Usage:
    TOKEN=... STORE_ID=... VENDOR_ID=... BANK_ID=... BASE_URL=http://localhost:3000 \
    npx tsx scripts/test-make-payment.ts
*/

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TOKEN = process.env.TOKEN || '';
const STORE_ID = process.env.STORE_ID || '';
const VENDOR_ID = process.env.VENDOR_ID || '';
const BANK_ID = process.env.BANK_ID || '';

async function getBanks() {
  const res = await fetch(`${BASE_URL}/api/banks`, {
    headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : undefined,
  });
  if (!res.ok) throw new Error(`banks GET failed: ${res.status}`);
  return res.json();
}

async function createBankIfMissing(): Promise<string> {
  if (BANK_ID) return BANK_ID;
  if (!STORE_ID) throw new Error('STORE_ID required when BANK_ID not provided');
  const res = await fetch(`${BASE_URL}/api/banks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bankName: `E2E Bank ${Date.now()}`,
      accountNumber: String(Math.floor(Math.random()*1e12)),
      routingNumber: String(Math.floor(Math.random()*1e9)),
      storeId: STORE_ID,
      balance: 100000,
    })
  });
  if (!res.ok) throw new Error(`bank POST failed: ${res.status}`);
  const data = await res.json();
  return data.id as string;
}

async function createVendorIfMissing(): Promise<string> {
  if (VENDOR_ID) return VENDOR_ID;
  const res = await fetch(`${BASE_URL}/api/vendors`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      vendorName: `E2E Vendor ${Date.now()}`,
      vendorType: 'MERCHANDISE',
      storeId: STORE_ID,
    })
  });
  if (!res.ok) throw new Error(`vendor POST failed: ${res.status}`);
  const data = await res.json();
  return data.id as string;
}

async function createCheck(bankId: string, vendorId: string, storeId: string) {
  const res = await fetch(`${BASE_URL}/api/checks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      paymentMethod: 'Cheque',
      bankId,
      vendorId,
      storeId,
      amount: 123.45,
      memo: 'E2E test',
      payeeName: 'E2E Payee'
    })
  });
  if (!res.ok) throw new Error(`checks POST failed: ${res.status}`);
  return res.json();
}

async function uploadDummyInvoice(checkId: string, checkNumber?: string) {
  // Use a small inline PNG as dummy upload via upload API if available
  const dummy = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P8z/C/HwAFgwJpXf6m9wAAAABJRU5ErkJggg==',
    'base64'
  );
  const form = new FormData();
  form.append('file', new Blob([dummy], { type: 'image/png' }), `invoice-${Date.now()}.png`);
  if (checkNumber) form.append('checkNumber', checkNumber);

  const res = await fetch(`${BASE_URL}/api/upload/invoice`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
    },
    body: form as any,
  });
  if (!res.ok) throw new Error(`invoice upload failed: ${res.status}`);
  return res.json();
}

async function listRecentChecks() {
  const res = await fetch(`${BASE_URL}/api/checks`, {
    headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : undefined,
  });
  if (!res.ok) throw new Error(`checks GET failed: ${res.status}`);
  return res.json();
}

(async () => {
  if (!TOKEN) throw new Error('TOKEN env is required');
  if (!STORE_ID) throw new Error('STORE_ID env is required');

  console.log('1) Banks snapshot:');
  const banks = await getBanks();
  console.log('   banks:', banks.length);

  console.log('2) Ensure bank/vendor exist');
  const bankId = await createBankIfMissing();
  const vendorId = await createVendorIfMissing();
  console.log('   bankId:', bankId, 'vendorId:', vendorId);

  console.log('3) Create check');
  const created = await createCheck(bankId, vendorId, STORE_ID);
  console.log('   created check:', created);

  console.log('4) Upload dummy invoice');
  try {
    const uploaded = await uploadDummyInvoice(created.id, created.referenceNumber || created.checkNumber);
    console.log('   uploaded invoice:', uploaded);
  } catch (e) {
    console.warn('   upload skipped or failed:', (e as Error).message);
  }

  console.log('5) Verify recent checks');
  const recent = await listRecentChecks();
  const found = recent.find((c: any) => c.id === created.id);
  console.log(found ? '   Found new check in recent list' : '   Check not found in recent list');
})();


