'use client';

import { useState, useRef, useCallback } from 'react';
import { Button, Textarea } from '@riderguy/ui';
import { Camera, Upload, ImageIcon, X, Check } from 'lucide-react';

type ProofType = 'PHOTO' | 'SIGNATURE' | 'PIN' | 'RECIPIENT_NAME';

interface ProofOfDeliveryProps {
  orderId: string;
  deliveryPin?: string;
  onSubmit: (proof: { type: ProofType; data: string }) => Promise<void>;
}

export function ProofOfDelivery({ orderId, deliveryPin, onSubmit }: ProofOfDeliveryProps) {
  const [proofType, setProofType] = useState<ProofType>('PHOTO');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    setError('');
    let data = '';

    if (proofType === 'PHOTO') {
      if (!photoPreview) { setError('Take or upload a photo'); return; }
      data = photoPreview;
    } else if (proofType === 'SIGNATURE') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      data = canvas.toDataURL('image/png');
    } else if (proofType === 'PIN') {
      if (pin.length < 4) { setError('Enter the delivery PIN'); return; }
      data = pin;
    } else if (proofType === 'RECIPIENT_NAME') {
      if (!recipientName.trim()) { setError('Enter recipient name'); return; }
      data = recipientName.trim();
    }

    setSubmitting(true);
    try {
      await onSubmit({ type: proofType, data });
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
    ctx.strokeStyle = '#fff';
    ctx.lineTo(x, y);
    ctx.stroke();
  }, []);

  const stopDraw = useCallback(() => { isDrawing.current = false; }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const proofTypes: { type: ProofType; label: string; icon: React.ReactNode }[] = [
    { type: 'PHOTO', label: 'Photo', icon: <Camera className="h-4 w-4" /> },
    { type: 'SIGNATURE', label: 'Signature', icon: <span className="text-sm">✍️</span> },
    { type: 'PIN', label: 'PIN', icon: <span className="text-sm">#</span> },
    { type: 'RECIPIENT_NAME', label: 'Name', icon: <span className="text-sm">👤</span> },
  ];

  return (
    <div className="glass-elevated rounded-2xl overflow-hidden">
      <div className="px-4 py-3.5 border-b border-white/[0.06]">
        <h3 className="text-sm font-bold text-white tracking-tight">Proof of Delivery</h3>
      </div>

      {/* Premium proof type selector */}
      <div className="relative flex p-1 m-3 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
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
              proofType === type ? 'text-white' : 'text-surface-400'
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
              <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]">
                <img src={photoPreview} alt="Proof" className="w-full h-48 object-cover" />
                <button
                  onClick={() => { setPhotoPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                  className="absolute top-2 right-2 h-8 w-8 rounded-xl bg-black/60 backdrop-blur-sm flex items-center justify-center btn-press"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full h-40 rounded-2xl border-2 border-dashed border-white/[0.08] flex flex-col items-center justify-center gap-2 hover:border-brand-500/30 hover:bg-brand-500/[0.03] transition-all btn-press"
              >
                <div className="h-12 w-12 rounded-xl bg-white/[0.06] flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-surface-500" />
                </div>
                <span className="text-sm text-surface-400 font-medium">Take or upload photo</span>
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
              className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] touch-none"
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

        {proofType === 'PIN' && (
          <div>
            <p className="text-xs text-surface-400 mb-2">
              {deliveryPin ? `Ask the recipient for their delivery PIN` : 'Enter the delivery PIN'}
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter PIN"
              className="w-full text-center text-2xl font-mono tracking-[0.5em] py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-surface-600 outline-none focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/20 transition-all"
            />
          </div>
        )}

        {proofType === 'RECIPIENT_NAME' && (
          <div>
            <p className="text-xs text-surface-400 mb-2">Name of person who received the package</p>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Enter recipient's name"
              className="w-full py-3 px-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-surface-500 outline-none focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/20 transition-all"
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
