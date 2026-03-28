"use client";

// Switched to server API that uploads to S3

const ALLOWED = ["application/pdf", "image/png", "image/jpeg"] as const;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function getExt(type: string, fallback = "bin"): string {
  if (type === "application/pdf") return "pdf";
  if (type === "image/png") return "png";
  if (type === "image/jpeg") return "jpg";
  return fallback;
}

export async function uploadInvoice(file: File, { checkNumber }: { checkNumber: string }) {
  if (!ALLOWED.includes(file.type as any)) {
    throw new Error("Invalid file type. Only PDF, PNG, JPG allowed.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File too large. Max 10 MB.");
  }

  const form = new FormData();
  form.append('file', file);
  form.append('checkNumber', checkNumber);

  const res = await fetch('/api/upload/invoice', {
    method: 'POST',
    body: form,
  } as RequestInit);

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.url) {
    throw new Error(data?.error || `Upload failed (HTTP ${res.status})`);
  }

  return data.url as string;
}


