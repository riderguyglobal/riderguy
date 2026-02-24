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
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold text-white">Proof of Delivery</h3>
      </div>

      {/* Proof type selector */}
      <div className="flex gap-1 p-1 m-3 rounded-xl bg-surface-800">
        {proofTypes.map(({ type, label, icon }) => (
          <button
            key={type}
            onClick={() => setProofType(type)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
              proofType === type ? 'bg-surface-700 text-white shadow-sm' : 'text-surface-400'
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
              <div className="relative rounded-xl overflow-hidden">
                <img src={photoPreview} alt="Proof" className="w-full h-48 object-cover" />
                <button
                  onClick={() => { setPhotoPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                  className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full h-40 rounded-xl border-2 border-dashed border-surface-700 flex flex-col items-center justify-center gap-2 hover:border-surface-500 transition-colors"
              >
                <ImageIcon className="h-8 w-8 text-surface-500" />
                <span className="text-sm text-surface-400">Take or upload photo</span>
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
              className="w-full rounded-xl border border-surface-700 bg-surface-800 touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
            <button onClick={clearCanvas} className="text-xs text-brand-400 hover:underline">
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
              className="w-full text-center text-2xl font-mono tracking-[0.5em] py-3 rounded-xl bg-surface-800 border border-surface-700 text-white placeholder:text-surface-600 outline-none focus:border-brand-500"
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
              className="w-full py-3 px-4 rounded-xl bg-surface-800 border border-surface-700 text-white placeholder:text-surface-500 outline-none focus:border-brand-500"
            />
          </div>
        )}

        {error && <p className="text-xs text-danger-400">{error}</p>}

        <Button
          size="lg"
          className="w-full bg-accent-500 hover:bg-accent-600 text-white"
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
