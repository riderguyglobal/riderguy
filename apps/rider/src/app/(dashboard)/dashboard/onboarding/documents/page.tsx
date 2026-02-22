'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@riderguy/auth';
import {
  Button,
  Card,
  CardContent,
  Label,
  Spinner,
} from '@riderguy/ui';
import { API_BASE_URL } from '@/lib/constants';

// ─── Document type labels ───────────────────────────────────

const DOC_LABELS: Record<string, { title: string; instructions: string; accept: string }> = {
  NATIONAL_ID: {
    title: 'National ID',
    instructions:
      'Upload a clear, full photo of the front of your national ID card. Make sure all text is readable and the entire card is visible.',
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
  },
  DRIVERS_LICENSE: {
    title: "Driver's License",
    instructions:
      'Upload a clear photo of your driver\'s license. Both sides may be required. Make sure all details are legible.',
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
  },
  INSURANCE_CERTIFICATE: {
    title: 'Insurance Certificate',
    instructions:
      'Upload your vehicle or personal insurance certificate. PDF or image format accepted.',
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
  },
  PROOF_OF_ADDRESS: {
    title: 'Proof of Address',
    instructions:
      'Upload a utility bill, bank statement, or official letter showing your current address. Must be dated within the last 3 months.',
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
  },
};

// ─── Component ──────────────────────────────────────────────

export default function DocumentUploadPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { accessToken } = useAuth();

  const docType = searchParams.get('type') ?? 'NATIONAL_ID';
  const meta = DOC_LABELS[docType] ?? DOC_LABELS.NATIONAL_ID!;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // ── Handle file selection ─────────────────────────────────
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File is too large. Maximum size is 10MB.');
      return;
    }

    setSelectedFile(file);
    setUploadError(null);
    setUploadSuccess(false);

    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  }, []);

  // ── Upload file ───────────────────────────────────────────
  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('type', docType);
      formData.append('fileName', selectedFile.name);
      formData.append('mimeType', selectedFile.type);
      formData.append('fileSizeBytes', String(selectedFile.size));

      const res = await fetch(`${API_BASE_URL}/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(
          json?.error?.message ?? 'Upload failed. Please try again.',
        );
      }

      setUploadSuccess(true);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Upload failed. Please try again.',
      );
    } finally {
      setUploading(false);
    }
  }, [selectedFile, docType, accessToken]);

  // ── Reset file selection ──────────────────────────────────
  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadError(null);
    setUploadSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard/onboarding')}
          className="mb-3 flex items-center gap-1 text-sm text-brand-500 hover:underline"
        >
          ← Back to checklist
        </button>
        <h1 className="text-xl font-bold text-gray-900">
          Upload {meta.title}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{meta.instructions}</p>
      </div>

      {/* Success state */}
      {uploadSuccess && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7 text-green-600"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-green-800">
            {meta.title} Uploaded!
          </h3>
          <p className="mt-1 text-sm text-green-600">
            Your document has been submitted for review.
          </p>
          <div className="mt-4 flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={handleReset}
            >
              Upload Another
            </Button>
            <Button onClick={() => router.push('/dashboard/onboarding')}>
              Back to Checklist
            </Button>
          </div>
        </div>
      )}

      {/* Upload area */}
      {!uploadSuccess && (
        <Card>
          <CardContent className="p-6">
            {/* File input */}
            <input
              ref={fileInputRef}
              type="file"
              accept={meta.accept}
              onChange={handleFileChange}
              className="hidden"
              id="doc-file-input"
            />

            {!selectedFile ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 p-8 transition-colors hover:border-brand-400 hover:bg-brand-50/30"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-7 w-7 text-brand-500"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-700">
                    Tap to select a file
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    JPG, PNG, WebP, or PDF • Max 10MB
                  </p>
                </div>
              </button>
            ) : (
              <div className="space-y-4">
                {/* Preview */}
                {previewUrl && (
                  <div className="relative mx-auto aspect-[4/3] w-full max-w-sm overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                    <Image
                      src={previewUrl}
                      alt="Document preview"
                      fill
                      className="object-contain"
                    />
                  </div>
                )}

                {/* File info */}
                <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-lg">
                    📄
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-gray-700">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type}
                    </p>
                  </div>
                  <button
                    onClick={handleReset}
                    className="text-sm text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {uploadError && (
              <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {uploadError}
              </div>
            )}

            {/* Actions */}
            {selectedFile && !uploadSuccess && (
              <div className="mt-6 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  Change File
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => void handleUpload()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <span className="flex items-center gap-2">
                      <Spinner className="h-4 w-4" /> Uploading…
                    </span>
                  ) : (
                    'Upload Document'
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tips */}
      <div className="mt-6 rounded-xl bg-gray-50 p-4">
        <h3 className="text-sm font-medium text-gray-700">Tips for a successful upload</h3>
        <ul className="mt-2 space-y-1.5 text-xs text-gray-500">
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Ensure the document is in focus and well-lit</span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>All four corners of the document should be visible</span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Text on the document must be readable</span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Avoid glare or shadows on the document</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
