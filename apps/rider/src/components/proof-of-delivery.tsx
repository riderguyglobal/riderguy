'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@riderguy/ui';
import { useTheme } from '@/lib/theme';
import { MAX_FILE_SIZE_BYTES, ALLOWED_IMAGE_TYPES } from '@riderguy/utils';
import { Camera, ImageIcon, X, Check } from 'lucide-react';

type ProofType = 'PHOTO' | 'SIGNATURE' | 'PIN_CODE';

interface ProofOfDeliveryProps {
  deliveryPin?: string;
  onSubmit: (proof: { type: ProofType; data: string; file?: File }) => Promise<void>;
}

export function ProofOfDelivery({ deliveryPin, onSubmit }: ProofOfDeliveryProps) {
  const { resolvedTheme } = useTheme();
  const [proofType, setProofType] = useState<ProofType>('PHOTO');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
      setError('Only JPEG, PNG, and WebP images are allowed');
      return;
    }

    // Validate file size (10 MB max)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`Photo must be under ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`);
      return;
    }

    setError('');
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setError('');
    let data = '';

    if (proofType === 'PHOTO') {
      if (!photoPreview || !photoFile) { setError('Take or upload a photo'); return; }
      data = photoPreview;
    } else if (proofType === 'SIGNATURE') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      data = canvas.toDataURL('image/png');
    } else if (proofType === 'PIN_CODE') {
      if (pin.length < 4) { setError('Enter the delivery PIN'); return; }
      data = pin;
    }

    setSubmitting(true);
    try {
      await onSubmit({ type: proofType, data, file: proofType === 'PHOTO' ? photoFile ?? undefined : undefined });
    } catch {
      setError('Failed to submit proof');
    } finally {
      setSubmitting(false);
    }
  };

  // Canvas drawing handlers
  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const touch = 'touches' in e ? (e as React.TouchEvent).touches[0] : undefined;
    const x = touch ? touch.clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = touch ? touch.clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const touch = 'touches' in e ? (e as React.TouchEvent).touches[0] : undefined;
    const x = touch ? touch.clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = touch ? touch.clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = resolvedTheme === 'dark' ? '#fff' : '#1a1a2e';
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [resolvedTheme]);

  const stopDraw = useCallback(() => { isDrawing.current = false; }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const proofTypes: { type: ProofType; label: string; icon: React.ReactNode }[] = [
    { type: 'PHOTO', label: 'Photo', icon: <Camera className="h-4 w-4" /> },
    { type: 'SIGNATURE', label: 'Signature', icon: <span className="text-sm">✍️</span> },
    { type: 'PIN_CODE', label: 'PIN', icon: <span className="text-sm">#</span> },
  ];

  return (
    <div className="glass-elevated rounded-2xl overflow-hidden">
      <div className="px-4 py-3.5 border-b border-themed">
        <h3 className="text-sm font-bold text-primary tracking-tight">Proof of Delivery</h3>
      </div>

      {/* Premium proof type selector */}
      <div className="relative flex p-1 m-3 rounded-2xl bg-card border border-themed">
        <div
          className="absolute top-1 bottom-1 rounded-xl gradient-brand transition-all duration-300 ease-out shadow-lg"
          style={{
            width: `calc(${100 / proofTypes.length}% - 4px)`,
            left: `calc(${proofTypes.findIndex(p => p.type === proofType) * (100 / proofTypes.length)}% + 2px)`,
          }}
        />
        {proofTypes.map(({ type, label, icon }) => (
          <button
            key={type}
            onClick={() => setProofType(type)}
            className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors btn-press ${
              proofType === type ? 'text-primary' : 'text-muted'
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      <div className="px-4 pb-4 space-y-3">
        {proofType === 'PHOTO' && (
          <>
            {photoPreview ? (
              <div className="relative rounded-2xl overflow-hidden border border-themed">
                <img src={photoPreview} alt="Proof" className="w-full h-48 object-cover" />
                <button
                  onClick={() => { setPhotoPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                  className="absolute top-2 right-2 h-8 w-8 rounded-xl bg-black/60 backdrop-blur-sm flex items-center justify-center btn-press"
                >
                  <X className="h-4 w-4 text-primary" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full h-40 rounded-2xl border-2 border-dashed border-themed-strong flex flex-col items-center justify-center gap-2 hover:border-brand-500/30 hover:bg-brand-500/[0.03] transition-all btn-press"
              >
                <div className="h-12 w-12 rounded-xl bg-skeleton flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-subtle" />
                </div>
                <span className="text-sm text-muted font-medium">Take or upload photo</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              className="hidden"
            />
          </>
        )}

        {proofType === 'SIGNATURE' && (
          <div className="space-y-2">
            <canvas
              ref={canvasRef}
              width={320}
              height={150}
              className="w-full rounded-2xl border border-themed-strong bg-hover-themed touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
            <button onClick={clearCanvas} className="text-xs text-brand-400 hover:underline font-medium">
              Clear signature
            </button>
          </div>
        )}

        {proofType === 'PIN_CODE' && (
          <div>
            <p className="text-xs text-muted mb-2">
              {deliveryPin ? `Ask the recipient for their delivery PIN` : 'Enter the delivery PIN'}
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter PIN"
              className="w-full text-center text-2xl font-mono tracking-[0.5em] py-3 rounded-2xl bg-card border border-themed-strong text-primary placeholder:text-subtle outline-none focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/20 transition-all"
            />
          </div>
        )}

        {error && <p className="text-xs text-danger-400">{error}</p>}

        <Button
          size="lg"
          className="w-full gradient-accent text-white shadow-lg glow-accent btn-press rounded-2xl font-semibold"
          onClick={handleSubmit}
          loading={submitting}
        >
          <Check className="h-5 w-5 mr-2" />
          Submit Proof
        </Button>
      </div>
    </div>
  );
}
