"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  onUploaded: (url: string) => void;
  required?: boolean;
};

export default function InvoiceUpload({ onUploaded, required }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    // validate
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(f.type)) { setError("Only PDF, JPG, PNG allowed"); return; }
    if (f.size > 10 * 1024 * 1024) { setError("Max 10MB"); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', f);
      const res = await fetch('/api/upload/invoice', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data?.url) { throw new Error(data?.error || 'Upload failed'); }
      setFileName(f.name);
      onUploaded(data.url);
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={onFile} />
        <Button type="button" variant="outline" disabled>{uploading ? 'Uploading…' : 'Desktop Upload'}</Button>
      </div>
      {fileName && <div className="text-xs text-muted-foreground">Attached: {fileName}</div>}
      {required && !fileName && <div className="text-xs text-muted-foreground">Invoice required before submit.</div>}
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}


