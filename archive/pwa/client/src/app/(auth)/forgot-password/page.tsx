'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { emailSchema } from '@riderguy/validators';
import { ArrowLeft, Mail, AlertCircle, CheckCircle, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email) return;
    const result = emailSchema.safeParse(email);
    if (!result.success) { setError(result.error.errors[0]?.message ?? 'Invalid email'); return; }
    setLoading(true); setError('');
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message;
      setError(msg || 'Something went wrong. Please try again.');
    } finally { setLoading(false); }
  };

  /* ─── Design tokens ─── */
  const field = {
    wrapper: 'relative',
    base: [
      'w-full appearance-none',
      'bg-[#f3f4f6]',
      'border-2 border-transparent',
      'rounded-[11px]',
      'text-[14px] text-[#0f172a]',
      'placeholder:text-[#a0aab8]',
      'focus:outline-none focus:bg-white focus:border-[#15803d]/70',
      'transition-all duration-200',
    ].join(' '),
    height: 'h-[46px]',
  };

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 5, letterSpacing: '0.4px', textTransform: 'uppercase' as const }}>
      {children}
    </label>
  );

  const PrimaryBtn = ({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full relative flex items-center justify-center btn-press disabled:opacity-50 transition-all duration-200"
      style={{
        height: 50, borderRadius: 13,
        background: disabled ? '#94a3b8' : 'linear-gradient(135deg, #16a34a 0%, #15803d 55%, #0f6830 100%)',
        color: '#ffffff', fontSize: 14, fontWeight: 700, letterSpacing: '0.1px',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : '0 6px 18px rgba(21,128,61,0.38), 0 2px 6px rgba(21,128,61,0.18)',
      }}
    >
      {children}
      {!disabled && <ChevronRight style={{ position: 'absolute', right: 14, width: 16, height: 16, opacity: 0.55 }} />}
    </button>
  );

  const Spinner = () => (
    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
  );

  const BackBtn = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <button type="button" onClick={onClick} className="flex items-center gap-2 mb-5 transition-colors">
      <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ArrowLeft style={{ width: 12, height: 12, color: '#64748b' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>{label}</span>
    </button>
  );

  /* ─── Sent / success state ─── */
  if (sent) {
    return (
      <div>
        <BackBtn onClick={() => router.push('/login')} label="Back to sign in" />
        <div style={{ textAlign: 'center', paddingTop: 24, paddingBottom: 24 }}>
          <div style={{ position: 'relative', width: 68, height: 68, margin: '0 auto 16px' }}>
            <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', background: 'radial-gradient(circle, rgba(21,128,61,0.16) 0%, transparent 70%)' }} />
            <div
              className="flex items-center justify-center"
              style={{ width: 68, height: 68, borderRadius: '50%', background: 'linear-gradient(135deg, #16a34a, #0f6830)', boxShadow: '0 6px 28px rgba(21,128,61,0.40)' }}
            >
              <CheckCircle style={{ width: 28, height: 28, color: '#fff' }} />
            </div>
          </div>
          <p style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 8 }}>Check your email</p>
          <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.55, marginBottom: 4 }}>
            If an account exists for
          </p>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 4 }}>{email}</p>
          <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.55, marginBottom: 28 }}>
            we&apos;ve sent a password reset link.
          </p>
          <PrimaryBtn onClick={() => router.push('/login')}>Back to Sign In</PrimaryBtn>
        </div>
      </div>
    );
  }

  return (
    <div>

      {/* ── Back button ── */}
      <BackBtn onClick={() => router.push('/login')} label="Back to sign in" />

      {/* ── Heading ── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ width: 28, height: 3, borderRadius: 99, background: 'linear-gradient(to right, #16a34a, #4ade80)', marginBottom: 11 }} />
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
          Reset password
        </h1>
        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: 400 }}>
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="animate-shake" style={{
          marginBottom: 12, padding: '9px 12px', borderRadius: 10,
          background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '3px solid #ef4444',
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <AlertCircle style={{ width: 13, height: 13, color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 11, color: '#dc2626', lineHeight: 1.4 }}>{error}</p>
        </div>
      )}

      {/* ── Form ── */}
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <Label>Email Address</Label>
          <div className={field.wrapper}>
            <span className="absolute left-[13px] top-1/2 -translate-y-1/2 pointer-events-none">
              <Mail style={{ width: 14, height: 14, color: email ? '#15803d' : '#a0aab8', transition: 'color 0.2s ease' }} />
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="you@example.com"
              autoFocus
              className={`${field.base} ${field.height} pl-[38px] pr-3.5`}
            />
          </div>
        </div>

        <PrimaryBtn onClick={handleSubmit} disabled={loading || !email}>
          {loading ? <Spinner /> : 'Send Reset Link'}
        </PrimaryBtn>
      </div>

      {/* ── Sign in link ── */}
      <div style={{ textAlign: 'center', marginTop: 18, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>Remembered it? </span>
        <Link href="/login" style={{ fontSize: 12, fontWeight: 700, color: '#15803d', borderBottom: '1.5px solid rgba(21,128,61,0.28)', paddingBottom: 1 }}>
          Back to sign in
        </Link>
      </div>

    </div>
  );
}
