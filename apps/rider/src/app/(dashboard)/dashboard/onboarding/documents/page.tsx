'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { API_BASE_URL } from '@/lib/constants';
import { Button } from '@riderguy/ui';
import { ArrowLeft, Upload, File, X, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface Doc {
  id: string;
  type: string;
  status: string;
  fileName?: string;
  rejectionReason?: string;
}

const DOC_TYPES = [
  { type: 'NATIONAL_ID', label: 'National ID / Passport' },
  { type: 'DRIVERS_LICENSE', label: "Driver's License" },
  { type: 'PROOF_OF_ADDRESS', label: 'Proof of Address' },
];

export default function DocumentsPage() {
  const router = useRouter();
  const { api } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedType, setSelectedType] = useState('');

  useEffect(() => {
    if (!api) return;
    api.get(`${API_BASE_URL}/documents`).then((res) => {
      setDocs(res.data.data ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [api]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedType || !api) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Max 10MB.');
      return;
    }

    setUploading(selectedType);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', selectedType);

      await api.post(`${API_BASE_URL}/documents/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Refresh docs
      const res = await api.get(`${API_BASE_URL}/documents`);
      setDocs(res.data.data ?? []);
    } catch {
      setError('Upload failed. Try again.');
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const triggerUpload = (type: string) => {
    setSelectedType(type);
    setTimeout(() => fileRef.current?.click(), 50);
  };

  const getDocStatus = (type: string) => docs.find((d) => d.type === type);

  return (
    <div className="min-h-[100dvh] pb-10 animate-page-enter">
      {/* Header */}
      <div className="safe-area-top bg-surface-950 sticky top-0 z-20 border-b border-white/5">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.push('/dashboard/onboarding')} className="h-9 w-9 rounded-full bg-surface-800 flex items-center justify-center">
            <ArrowLeft className="h-5 w-5 text-surface-300" />
          </button>
          <h1 className="text-lg font-bold text-white">Documents</h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-4">
        <p className="text-sm text-surface-400">Upload your identification documents for verification.</p>

        {error && (
          <div className="p-3 rounded-xl bg-danger-500/10 border border-danger-500/20 flex items-start gap-2 animate-shake">
            <AlertCircle className="h-4 w-4 text-danger-400 shrink-0 mt-0.5" />
            <p className="text-xs text-danger-300">{error}</p>
          </div>
        )}

        {DOC_TYPES.map(({ type, label }) => {
          const doc = getDocStatus(type);
          const isUploading = uploading === type;

          return (
            <div key={type} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <File className="h-5 w-5 text-surface-400" />
                  <span className="text-sm font-medium text-white">{label}</span>
                </div>
                {doc && (
                  <div className="flex items-center gap-1.5">
                    {doc.status === 'APPROVED' && <CheckCircle className="h-4 w-4 text-accent-400" />}
                    {doc.status === 'PENDING' && <Clock className="h-4 w-4 text-amber-400" />}
                    {doc.status === 'REJECTED' && <AlertCircle className="h-4 w-4 text-danger-400" />}
                    <span className={`text-xs ${
                      doc.status === 'APPROVED' ? 'text-accent-400'
                        : doc.status === 'REJECTED' ? 'text-danger-400'
                        : 'text-amber-400'
                    }`}>
                      {doc.status === 'APPROVED' ? 'Approved' : doc.status === 'REJECTED' ? 'Rejected' : 'Under Review'}
                    </span>
                  </div>
                )}
              </div>

              {doc?.status === 'REJECTED' && doc.rejectionReason && (
                <p className="text-xs text-danger-300 bg-danger-500/10 p-2 rounded-lg mb-3">{doc.rejectionReason}</p>
              )}

              {(!doc || doc.status === 'REJECTED') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-surface-700 text-surface-300"
                  onClick={() => triggerUpload(type)}
                  loading={isUploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {doc ? 'Re-upload' : 'Upload'}
                </Button>
              )}

              {doc?.fileName && doc.status !== 'REJECTED' && (
                <p className="text-xs text-surface-500 truncate mt-2">{doc.fileName}</p>
              )}
            </div>
          );
        })}

        <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleUpload} className="hidden" />
      </div>
    </div>
  );
}
