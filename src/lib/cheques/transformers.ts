import { formatAmountInWords } from "@/lib/numberToWords";
import { dollarsToCents } from "@/lib/money";
import { ChequeViewModel } from "./types";

export const chequeSelect = {
  id: true,
  check_number: true,
  amount: true,
  memo: true,
  created_at: true,
  issued_by_username: true,
  payee_name: true,
  Vendor: {
    select: {
      id: true,
      vendor_name: true,
      vendor_type: true,
    },
  },
  Store: {
    select: {
      id: true,
      code: true,
      name: true,
      address: true,
      phone: true,
    },
  },
  Bank: {
    select: {
      id: true,
      bank_name: true,
      dba: true,
      account_name: true,
      return_address: true,
      return_city: true,
      return_state: true,
      return_zip: true,
      routing_number: true,
      account_number: true,
      signature_url: true,
      Corporation: {
        select: {
          id: true,
          name: true,
          owner: true,
          ein: true,
        },
      },
      BankSigner: {
        where: { is_default: true },
        select: {
          Signer: {
            select: {
              Signature: {
                where: { is_active: true },
                orderBy: { uploaded_at: "desc" },
                take: 1,
                select: { url: true },
              },
            },
          },
        },
      },
    },
  },
} as const;

type BankSignatureRecord = {
  Signer: {
    Signature: Array<{
      url: string | null;
    }>;
  };
};

type ChequeRecord = {
  id: number;
  check_number: bigint | number | null;
  amount: any;
  memo: string | null;
  created_at: Date;
  issued_by_username: string | null;
  payee_name: string | null;
  Vendor: {
    id: number;
    vendor_name: string;
    vendor_type: string;
  } | null;
  Store: {
    id: number;
    code: string;
    name: string;
    address: string;
    phone: string | null;
  } | null;
  Bank: {
    id: number;
    bank_name: string;
    routing_number: bigint | number | null;
    account_number: bigint | number | null;
    signature_url: string | null;
    BankSigner: BankSignatureRecord[] | null;
    account_name?: string | null;
    dba?: string | null;
    return_address?: string | null;
    return_city?: string | null;
    return_state?: string | null;
    return_zip?: string | number | null;
    Corporation?: {
      id: number;
      name: string;
      owner: string | null;
      ein: string | null;
    } | null;
  };
};

export function mapChequeRecord(record: ChequeRecord): ChequeViewModel {
  const amountValue = record.amount ? Number(record.amount) : 0;
  const amountCents = dollarsToCents(amountValue);
  const amountWords = formatAmountInWords(amountCents);

  const vendorPayee: ChequeViewModel["payee"] | null =
    record.Vendor != null
      ? {
          id: record.Vendor.id.toString(),
          type: record.Vendor.vendor_type === "EMPLOYEE" ? "employee" : "vendor",
          name: record.Vendor.vendor_name,
        }
      : null;

  const payee: ChequeViewModel["payee"] =
    vendorPayee ??
    (record.payee_name
      ? {
          id: null,
          type: "unknown",
          name: record.payee_name,
        }
      : {
          id: null,
          type: "unknown",
          name: "Unknown Payee",
        });

  const bankRecord = record.Bank as any;

  return {
    id: record.id.toString(),
    number: record.check_number?.toString() || "",
    amount: amountValue,
    amountWords,
    memo: record.memo ?? "",
    createdAt: record.created_at.toISOString(),
    issuedBy: record.issued_by_username ?? "Unknown",
    store: record.Store
      ? {
          id: record.Store.id.toString(),
          code: record.Store.code,
          name: record.Store.name,
          address: record.Store.address,
          phone: record.Store.phone,
        }
      : null,
    bank: {
      id: bankRecord.id.toString(),
      name: bankRecord.bank_name,
      accountName: bankRecord.account_name ?? null,
      dba: bankRecord.dba ?? null,
      addressLine1: bankRecord.return_address ?? null,
      cityStateZip:
        bankRecord.return_city ||
        bankRecord.return_state ||
        bankRecord.return_zip
          ? `${bankRecord.return_city || ""}${
              bankRecord.return_state ? `, ${bankRecord.return_state}` : ""
            }${bankRecord.return_zip ? ` ${bankRecord.return_zip}` : ""}`.trim()
          : null,
      routingNumber: bankRecord.routing_number?.toString() || "",
      accountNumber: bankRecord.account_number?.toString() || "",
      signatureUrl: bankRecord.signature_url || null,
      corporation: bankRecord.Corporation
        ? {
            name: bankRecord.Corporation.name,
            owner: bankRecord.Corporation.owner,
            ein: bankRecord.Corporation.ein,
          }
        : null,
    },
    payee,
  };
}

