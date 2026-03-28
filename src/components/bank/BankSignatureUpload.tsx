"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, X, Check, AlertCircle } from "lucide-react";

type BankSignatureUploadProps = {
  bankId: number;
  bankName: string;
  currentSignatureUrl?: string | null;
  onSignatureUpdated?: (signatureUrl: string) => void;
};

type ToastState = {
  variant: "success" | "error";
  message: string;
} | null;

export default function BankSignatureUpload({
  bankId,
  bankName,
  currentSignatureUrl,
  onSignatureUpdated,
}: BankSignatureUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [presignedUrl, setPresignedUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch presigned URL for current signature (if it's an S3 key)
  useEffect(() => {
    setPresignedUrl(null);
    
    if (!currentSignatureUrl) {
      return;
    }

    // If it's an S3 key (starts with "signatures/"), fetch presigned URL
    if (currentSignatureUrl.startsWith('signatures/')) {
      fetch(`/api/banks/${bankId}/signature-url`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          if (data.url) {
            setPresignedUrl(data.url);
          }
        })
        .catch(err => {
          console.warn('[BankSignatureUpload] Failed to load signature URL:', err);
        });
    } else {
      // Legacy path - use directly
      setPresignedUrl(currentSignatureUrl);
    }
  }, [bankId, currentSignatureUrl]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file) {
      return;
    }

    // Validate file type (PNG, JPEG, or TIFF)
    const isPng = file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
    const isJpeg = file.type === "image/jpeg" || file.name.toLowerCase().match(/\.(jpg|jpeg)$/i);
    const isTiff = file.type === "image/tiff" || file.name.toLowerCase().match(/\.(tif|tiff)$/i);

    if (!isPng && !isJpeg && !isTiff) {
      setToast({
        variant: "error",
        message: "Only PNG, JPEG, and TIFF files are accepted",
      });
      return;
    }

    // Validate file size (2MB max)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      setToast({
        variant: "error",
        message: "File size must be less than 2MB",
      });
      return;
    }

    // Create preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setSelectedFile(file);
    setToast(null);
  };

  const handleClearSelection = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setToast({
        variant: "error",
        message: "Please select a file first",
      });
      return;
    }

    setIsUploading(true);
    setToast(null);

    try {
      const formData = new FormData();
      formData.append("signature", selectedFile);

      const response = await fetch(`/api/banks/${bankId}/signature`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to upload signature");
      }

      const result = await response.json();

      setToast({
        variant: "success",
        message: "Signature uploaded successfully",
      });

      // Clear selection
      handleClearSelection();

      // Notify parent component with the S3 key
      if (onSignatureUpdated && result.signatureKey) {
        onSignatureUpdated(result.signatureKey);
      }

      // Force reload after a short delay to show the new signature
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      setToast({
        variant: "error",
        message: error instanceof Error ? error.message : "Failed to upload signature",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to remove this signature?")) {
      return;
    }

    setIsUploading(true);
    setToast(null);

    try {
      const response = await fetch(`/api/banks/${bankId}/signature`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete signature");
      }

      setToast({
        variant: "success",
        message: "Signature removed successfully",
      });

      // Notify parent component
      if (onSignatureUpdated) {
        onSignatureUpdated("");
      }

      // Force reload after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      setToast({
        variant: "error",
        message: error instanceof Error ? error.message : "Failed to remove signature",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="border border-slate-800 bg-slate-950/80 text-slate-100">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-100">
          Authorized Signature for {bankName}
        </CardTitle>
        <p className="text-sm text-slate-400">
          Upload a PNG, JPEG, or TIFF signature image. This signature will appear on all checks drawn from this bank.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {toast && (
          <div
            className={`rounded-md border px-4 py-3 text-sm shadow-sm flex items-start gap-3 ${
              toast.variant === "success"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : "border-red-500/40 bg-red-500/10 text-red-200"
            }`}
          >
            {toast.variant === "success" ? (
              <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            )}
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="text-xs font-medium uppercase tracking-wide hover:opacity-70"
            >
              ×
            </button>
          </div>
        )}

        {/* Current Signature */}
        {currentSignatureUrl && presignedUrl && !previewUrl && (
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Current Signature
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950/70 p-4">
              <img
                src={presignedUrl}
                alt="Current signature"
                className="h-24 max-w-xs rounded bg-white object-contain p-2"
                onError={() => console.warn('Failed to load signature image')}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={isUploading}
              className="border-red-500/40 text-red-300 hover:bg-red-500/10"
            >
              <X className="mr-2 h-4 w-4" />
              Remove Signature
            </Button>
          </div>
        )}

        {/* File Selection */}
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {currentSignatureUrl ? "Upload New Signature" : "Upload Signature"}
          </div>

          <label
            htmlFor={`signature-upload-${bankId}`}
            className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-slate-700 bg-slate-950/50 px-4 py-8 text-center text-sm text-slate-400 hover:border-slate-500 hover:text-slate-200 transition"
          >
            <Upload className="mb-2 h-6 w-6" />
            <span className="font-medium">
              {selectedFile ? selectedFile.name : "Click to upload signature image"}
            </span>
            <span className="mt-1 text-xs text-slate-500">
              PNG, JPEG, or TIFF, max 2MB
            </span>
            <input
              ref={fileInputRef}
              id={`signature-upload-${bankId}`}
              type="file"
              accept="image/png,image/jpeg,image/tiff"
              className="hidden"
              onChange={handleFileSelect}
              disabled={isUploading}
            />
          </label>

          {/* Preview */}
          {previewUrl && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Preview
              </div>
              <div className="rounded-md border border-slate-800 bg-slate-950/70 p-4">
                <img
                  src={previewUrl}
                  alt="Signature preview"
                  className="h-24 max-w-xs rounded bg-white object-contain p-2"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="flex-1 bg-slate-700 text-slate-100 hover:bg-slate-600"
                >
                  {isUploading ? "Uploading..." : "Upload Signature"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClearSelection}
                  disabled={isUploading}
                  className="border-slate-700 bg-slate-900/70 text-slate-100 hover:bg-slate-800"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-md border border-slate-800 bg-slate-900/40 p-3">
          <p className="text-xs text-slate-400">
            <strong className="text-slate-300">Note:</strong> The signature image will be embedded in all PDF checks generated for this bank. PNG, JPEG, and TIFF formats are all supported.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
