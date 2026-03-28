"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { v4 as uuidv4 } from "uuid";
import io, { Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const QRCode = dynamic(() => import('qrcode.react').then(m => m.QRCodeCanvas), { ssr: false });

type Props = {
  onUploaded: (fileUrl: string) => void;
  required?: boolean;
};

export default function InvoiceUploadWithQR({ onUploaded, required }: Props) {
  const [sessionId] = useState(() => uuidv4());
  const [status, setStatus] = useState<'idle'|'waiting'|'scanning'|'uploading'|'success'|'error'>('idle');
  const [isQRModalOpen, setQRModalOpen] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const scanUrl = useMemo(() => `${appUrl.replace(/\/$/, '')}/mobile-upload/${sessionId}`, [appUrl, sessionId]);

  useEffect(() => {
    const socketUrl = (process.env.NEXT_PUBLIC_SOCKET_URL as string) || '';
    const s = socketUrl ? io(socketUrl, { transports: ['websocket', 'polling'] }) : io({ transports: ['websocket', 'polling'] });
    socketRef.current = s;
    s.on('connect', () => setStatus('waiting'));
    s.emit('session:join', sessionId);
    s.on('session:scanning', () => setStatus('scanning'));
    s.on('invoice:uploaded', async ({ imageData }: any) => {
      try {
        setStatus('uploading');
        const file = await dataUrlToFile(imageData, `invoice-${Date.now()}.jpg`);
        await uploadFile(file);
      } catch {
        setStatus('error');
      }
    });
    return () => {
      s.disconnect();
    };
  }, [sessionId]);

  const onDesktopFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!validateFile(f)) return;
    setSelectedFile(f);
    await uploadFile(f);
  };

  const validateFile = (file: File) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      alert('Invalid file type. Allowed: PDF, JPG, PNG');
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Max 10MB');
      return false;
    }
    return true;
  };

  const uploadFile = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('sessionId', sessionId);
    const res = await fetch('/api/upload/invoice', { method: 'POST', body: form });
    if (!res.ok) {
      const t = await res.text();
      console.error('Upload failed:', t);
      setStatus('error');
      return;
    }
    const data = await res.json();
    onUploaded(data.url);
    setStatus('success');
    setQRModalOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          onChange={onDesktopFile}
        />
        <Dialog open={isQRModalOpen} onOpenChange={setQRModalOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline">Scan with Phone</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Scan to Upload Invoice</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-2">
              {appUrl ? (
                <>
                  <QRCode value={scanUrl} size={200} />
                  <div className="text-sm text-muted-foreground break-all text-center">{scanUrl}</div>
                </>
              ) : (
                <div className="text-sm text-destructive">Set NEXT_PUBLIC_APP_URL for QR to work.</div>
              )}
              <div className="text-xs text-muted-foreground">Status: {status}</div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {required && status !== 'success' && (
        <div className="text-xs text-muted-foreground">Invoice required before submit.</div>
      )}
    </div>
  );
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}


