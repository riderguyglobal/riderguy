'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { ArrowLeft, Tag, Check, X, Loader2, ChevronRight } from 'lucide-react';

const STORAGE_KEY = 'riderguy:saved_promo';

interface ValidatedPromo {
  code: string;
  discountType: 'PERCENTAGE' | 'FLAT';
  discountValue: number;
  maxDiscountGhs: number | null;
  description: string | null;
  validUntil: string | null;
  forNewUsersOnly: boolean;
}

const HOW_IT_WORKS = [
  { step: '1', text: 'Enter your promo code and tap "Apply".' },
  { step: '2', text: 'Verified codes are saved automatically.' },
  { step: '3', text: 'The discount is applied when you place your next order.' },
];

export default function PromosPage() {
  const router  = useRouter();
  const { api } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [code,     setCode]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [validated,setValidated]= useState<ValidatedPromo | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  async function handleApply() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || !api) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/promo/validate', { code: trimmed });
      const promo = res.data.data as ValidatedPromo;
      setValidated(promo);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(promo));
      setCode('');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Invalid or expired promo code.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleRemove() {
    setValidated(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  function discountLabel(promo: ValidatedPromo): string {
    if (promo.discountType === 'PERCENTAGE') {
      const suffix = promo.maxDiscountGhs ? ` (max GHS ${promo.maxDiscountGhs})` : '';
      return `${promo.discountValue}% off${suffix}`;
    }
    return `GHS ${promo.discountValue} off`;
  }

  return (
    <div className="min-h-[100dvh] bg-surface-50 animate-page-enter">

      {/* ── Header ───────────────────────────────── */}
      <div
        className="bg-surface-50 flex items-center gap-3 px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)', paddingBottom: 14 }}
      >
        <button onClick={() => router.back()} className="map-btn bg-white shadow-card">
          <ArrowLeft className="h-5 w-5 text-surface-900" />
        </button>
        <p className="flex-1 text-[17px] font-bold text-surface-900">Promo Codes</p>
      </div>

      <div className="px-5 pb-10 space-y-4">

        {/* ── Active promo ─────────────────────────── */}
        {validated && (
          <div className="bg-brand-500 rounded-2xl px-4 py-4 animate-scale-in">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Tag className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-white/60">Active Promo</p>
                  <p className="text-[18px] font-extrabold text-white tracking-wider">{validated.code}</p>
                  <p className="text-[13px] text-white/80 font-semibold mt-0.5">
                    {discountLabel(validated)}
                  </p>
                  {validated.description && (
                    <p className="text-[12px] text-white/60 mt-0.5">{validated.description}</p>
                  )}
                  {validated.validUntil && (
                    <p className="text-[11px] text-white/50 mt-0.5">
                      Expires {new Date(validated.validUntil).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleRemove}
                className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 active:scale-90 transition-all"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/20">
              <Check className="h-4 w-4 text-white/70" />
              <p className="text-[12px] text-white/70 font-semibold">
                Discount will be applied on your next order
              </p>
            </div>
          </div>
        )}

        {/* ── Input ────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-card px-4 py-4">
          <p className="section-label mb-3">Enter a promo code</p>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleApply()}
              placeholder="e.g. RIDE20"
              className="input-field flex-1 !h-12 uppercase tracking-widest font-bold"
              autoCapitalize="characters"
              autoComplete="off"
            />
            <button
              onClick={handleApply}
              disabled={!code.trim() || loading}
              className="h-12 px-5 rounded-2xl bg-surface-900 text-white text-[14px] font-bold flex items-center gap-2 active:scale-95 transition-all disabled:opacity-40"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
            </button>
          </div>
          {error && (
            <p className="text-[13px] font-semibold text-red-500 mt-2 flex items-center gap-1.5">
              <X className="h-3.5 w-3.5" /> {error}
            </p>
          )}
        </div>

        {/* ── How it works ─────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-card px-4 py-4">
          <p className="section-label mb-3">How it works</p>
          <div className="space-y-3">
            {HOW_IT_WORKS.map(item => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-surface-900 flex items-center justify-center flex-shrink-0">
                  <span className="text-[11px] font-extrabold text-white">{item.step}</span>
                </div>
                <p className="text-[14px] text-surface-600 leading-snug pt-0.5">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA — quick send ─────────────────────── */}
        {validated && (
          <button
            onClick={() => router.push('/dashboard/send')}
            className="w-full flex items-center gap-3 px-4 py-4 bg-white rounded-2xl shadow-card text-left active:bg-surface-50 transition-colors"
          >
            <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
              <Tag className="h-5 w-5 text-brand-600" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-bold text-surface-900">Send a package now</p>
              <p className="text-[12px] text-surface-400 mt-0.5">Your promo will be applied automatically</p>
            </div>
            <ChevronRight className="h-4 w-4 text-surface-300" />
          </button>
        )}

      </div>
    </div>
  );
}
