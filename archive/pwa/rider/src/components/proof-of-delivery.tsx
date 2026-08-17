'use client';

import { useState, useRef } from 'react';
import { Button } from '@riderguy/ui';
import { MAX_FILE_SIZE_BYTES, ALLOWED_IMAGE_TYPES } from '@riderguy/utils';
import { Camera, ImageIcon, X, Check, Banknote, Smartphone, CreditCard, Wallet, ChevronRight } from 'lucide-react';

type ProofType = 'PHOTO' | 'PIN_CODE';

type PaymentMethodOption = 'CASH' | 'MOBILE_MONEY' | 'CARD' | 'WALLET' | 'BANK_TRANSFER';

interface ProofOfDeliveryProps {
  deliveryPin?: string;
  paymentMethod?: string; // The original payment method chosen by client
  riderPaymentConfirmed?: boolean; // Whether rider already confirmed payment
  onConfirmPayment: (actualPaymentMethod: PaymentMethodOption) => Promise<void>;
  onSubmit: (proof: { type: ProofType; data: string; file?: File }) => Promise<void>;
}

const PAYMENT_OPTIONS: { method: PaymentMethodOption; label: string; icon: React.ReactNode; description: string }[] = [
  { method: 'CASH', label: 'Cash', icon: <Banknote className="h-5 w-5" />, description: 'Received cash payment' },
  { method: 'MOBILE_MONEY', label: 'Mobile Money', icon: <Smartphone className="h-5 w-5" />, description: 'Received via MoMo' },
  { method: 'CARD', label: 'Card', icon: <CreditCard className="h-5 w-5" />, description: 'Paid by card' },
  { method: 'WALLET', label: 'Wallet', icon: <Wallet className="h-5 w-5" />, description: 'Paid via app wallet' },
];

export function ProofOfDelivery({ deliveryPin, paymentMethod, riderPaymentConfirmed, onConfirmPayment, onSubmit }: ProofOfDeliveryProps) {
  // Step 1: Confirm payment, Step 2: Proof of delivery
  const [step, setStep] = useState<1 | 2>(riderPaymentConfirmed ? 2 : 1);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethodOption | null>(
    (paymentMethod as PaymentMethodOption) ?? null,
  );
  const [proofType, setProofType] = useState<ProofType>('PIN_CODE');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
      setError('Only JPEG, PNG, and WebP images are allowed');
      return;
    }

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

  const handleConfirmPayment = async () => {
    if (!selectedPayment || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      await onConfirmPayment(selectedPayment);
      setStep(2);
    } catch {
      setError('Failed to confirm payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitProof = async () => {
    if (submitting) return;
    setError('');
    let data = '';

    if (proofType === 'PHOTO') {
      if (!photoPreview || !photoFile) { setError('Take or upload a photo'); return; }
      data = photoPreview;
    } else if (proofType === 'PIN_CODE') {
      if (pin.length < 4) { setError('Enter the delivery PIN from the client'); return; }
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

  const proofTypes: { type: ProofType; label: string; icon: React.ReactNode }[] = [
    { type: 'PIN_CODE', label: 'PIN Code', icon: <span className="text-sm">#</span> },
    { type: 'PHOTO', label: 'Photo', icon: <Camera className="h-4 w-4" /> },
  ];

  return (
    <div className="glass-elevated rounded-2xl overflow-hidden">
      {/* Step indicator */}
      <div className="px-4 py-3.5 border-b border-themed">
        <div className="flex items-center gap-2">
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
            step >= 1 ? 'gradient-brand text-white' : 'bg-skeleton text-muted'
          }`}>1</div>
          <span className={`text-xs font-semibold ${step === 1 ? 'text-primary' : 'text-muted'}`}>Payment</span>
          <ChevronRight className="h-3.5 w-3.5 text-subtle" />
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
            step >= 2 ? 'gradient-brand text-white' : 'bg-skeleton text-muted'
          }`}>2</div>
          <span className={`text-xs font-semibold ${step === 2 ? 'text-primary' : 'text-muted'}`}>Proof</span>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3 pt-3">
        {/* ──── STEP 1: Confirm Payment ──── */}
        {step === 1 && (
          <>
            <div>
              <h3 className="text-sm font-bold text-primary">Confirm Payment Received</h3>
              <p className="text-xs text-muted mt-0.5">
                How did the customer pay? Select the actual payment method used.
              </p>
            </div>

            <div className="space-y-2">
              {PAYMENT_OPTIONS.map(({ method, label, icon, description }) => (
                <button
                  key={method}
                  onClick={() => setSelectedPayment(method)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all btn-press ${
                    selectedPayment === method
                      ? 'border-brand-500 bg-brand-500/5 ring-2 ring-brand-500/20'
                      : 'border-themed hover:border-themed-strong'
                  }`}
                >
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                    selectedPayment === method ? 'bg-brand-500/10 text-brand-500' : 'bg-skeleton text-muted'
                  }`}>
                    {icon}
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-sm font-semibold ${selectedPayment === method ? 'text-brand-500' : 'text-primary'}`}>
                      {label}
                      {paymentMethod === method && (
                        <span className="ml-1.5 text-[10px] font-medium text-muted bg-skeleton px-1.5 py-0.5 rounded">
                          Original
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted">{description}</p>
                  </div>
                  {selectedPayment === method && (
                    <div className="h-5 w-5 rounded-full gradient-brand flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {error && <p className="text-xs text-danger-400">{error}</p>}

            <Button
              size="lg"
              className="w-full gradient-brand text-white shadow-lg btn-press rounded-2xl font-semibold"
              onClick={handleConfirmPayment}
              disabled={!selectedPayment}
              loading={submitting}
            >
              <Banknote className="h-5 w-5 mr-2" />
              Confirm Payment Received
            </Button>
          </>
        )}

        {/* ──── STEP 2: Proof of Delivery ──── */}
        {step === 2 && (
          <>
            <div>
              <h3 className="text-sm font-bold text-primary">Proof of Delivery</h3>
              <p className="text-xs text-muted mt-0.5">
                Ask the client for their PIN code, or take a photo as proof.
              </p>
            </div>

            {/* Proof type selector */}
            <div className="relative flex p-1 rounded-2xl bg-card border border-themed">
              <div
                className="absolute top-1 bottom-1 rounded-xl gradient-accent transition-all duration-300 ease-out shadow-lg"
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

            {proofType === 'PIN_CODE' && (
              <div>
                <p className="text-xs text-muted mb-2">
                  Ask the recipient for their 4-digit delivery PIN
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

            {proofType === 'PHOTO' && (
              <>
                {photoPreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-themed">
                    <img src={photoPreview} alt="Proof" className="w-full h-48 object-cover" />
                    <button
                      onClick={() => { setPhotoPreview(null); setPhotoFile(null); if (fileRef.current) fileRef.current.value = ''; }}
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

            {error && <p className="text-xs text-danger-400">{error}</p>}

            <Button
              size="lg"
              className="w-full gradient-accent text-white shadow-lg glow-accent btn-press rounded-2xl font-semibold"
              onClick={handleSubmitProof}
              loading={submitting}
            >
              <Check className="h-5 w-5 mr-2" />
              Complete Delivery
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
