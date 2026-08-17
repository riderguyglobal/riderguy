'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { passwordSchema } from '@riderguy/validators';
import { ArrowLeft, AlertCircle, CheckCircle, Eye, EyeOff, KeyRound, Lock, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        <span className="h-7 w-7 border-2 border-[#15803d] border-t-transparent rounded-full animate-spin inline-block" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { resetPassword } = useAuth();

  const [token, setToken]                   = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]     = useState(false);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState('');
  const [success, setSuccess]               = useState(false);

  useEffect(() => {
    const t = searchParams?.get('token');
    if (t) setToken(t);
  }, [searchParams]);

  const handleSubmit = async () => {
    if (!token) { setError('Missing reset token. Please use the link from your email.'); return; }
    if (!password || !confirmPassword) return;
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    const pwResult = passwordSchema.safeParse(password);
    if (!pwResult.success) { setError(pwResult.error.errors[0]?.message ?? 'Invalid password'); return; }
    setLoading(true); setError('');
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message;
      setError(msg || 'Reset failed. The link may have expired.');
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
      type="button" onClick={onClick} disabled={disabled}
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

  /* ─── Page shell (standalone, no auth layout) ─── */
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div style={{ minHeight: '100dvh', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {children}
      </div>
    </div>
  );

  /* ─── Success ─── */
  if (success) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', paddingTop: 16, paddingBottom: 16 }}>
          <div style={{ position: 'relative', width: 68, height: 68, margin: '0 auto 16px' }}>
            <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', background: 'radial-gradient(circle, rgba(21,128,61,0.16) 0%, transparent 70%)' }} />
            <div className="flex items-center justify-center" style={{ width: 68, height: 68, borderRadius: '50%', background: 'linear-gradient(135deg, #16a34a, #0f6830)', boxShadow: '0 6px 28px rgba(21,128,61,0.40)' }}>
              <CheckCircle style={{ width: 28, height: 28, color: '#fff' }} />
            </div>
          </div>
          <p style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 8 }}>Password Reset!</p>
          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 28, lineHeight: 1.55 }}>
            Your password has been changed. You can now sign in.
          </p>
          <PrimaryBtn onClick={() => router.push('/login')}>Sign In</PrimaryBtn>
        </div>
      </Shell>
    );
  }

  /* ─── Invalid / no token ─── */
  if (!token) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', paddingTop: 16, paddingBottom: 16 }}>
          <div style={{ position: 'relative', width: 68, height: 68, margin: '0 auto 16px' }}>
            <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'linear-gradient(135deg, #fee2e2, #fecaca)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(239,68,68,0.18)' }}>
              <AlertCircle style={{ width: 28, height: 28, color: '#ef4444' }} />
            </div>
          </div>
          <p style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 8 }}>Invalid Link</p>
          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 28, lineHeight: 1.55 }}>
            This password reset link is invalid or has expired.
          </p>
          <Link
            href="/forgot-password"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: 50, borderRadius: 13,
              background: '#f3f4f6', border: '1.5px solid #e2e8f0',
              fontSize: 14, fontWeight: 700, color: '#374151', textDecoration: 'none',
            }}
          >
            Request a new link
          </Link>
        </div>
      </Shell>
    );
  }

  /* ─── Form ─── */
  return (
    <Shell>
      {/* Back button */}
      <button
        type="button"
        onClick={() => router.push('/login')}
        className="flex items-center gap-2 mb-5 transition-colors"
      >
        <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft style={{ width: 12, height: 12, color: '#64748b' }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>Back to Sign In</span>
      </button>

      {/* Icon + heading */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1px solid rgba(21,128,61,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <KeyRound style={{ width: 19, height: 19, color: '#15803d' }} />
        </div>
        <div style={{ width: 28, height: 3, borderRadius: 99, background: 'linear-gradient(to right, #16a34a, #4ade80)', marginBottom: 11 }} />
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1.1 }}>New password</h1>
        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: 400 }}>Choose a strong password for your account</p>
      </div>

      {/* Error */}
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

      {/* Fields */}
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <Label>New Password</Label>
          <div className={field.wrapper}>
            <span className="absolute left-[13px] top-1/2 -translate-y-1/2 pointer-events-none">
              <Lock style={{ width: 14, height: 14, color: password ? '#15803d' : '#a0aab8', transition: 'color 0.2s ease' }} />
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoFocus
              className={`${field.base} ${field.height} pl-[38px] pr-[40px]`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-[12px] top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: '#a0aab8' }}
            >
              {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
            </button>
          </div>
          <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>Must include uppercase, lowercase, and a number</p>
        </div>

        <div>
          <Label>Confirm Password</Label>
          <div className={field.wrapper}>
            <span className="absolute left-[13px] top-1/2 -translate-y-1/2 pointer-events-none">
              <Lock style={{ width: 14, height: 14, color: confirmPassword ? '#15803d' : '#a0aab8', transition: 'color 0.2s ease' }} />
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Re-enter your password"
              className={`${field.base} ${field.height} pl-[38px] pr-3.5`}
            />
          </div>
        </div>

        <PrimaryBtn onClick={handleSubmit} disabled={loading || !password || !confirmPassword}>
          {loading ? <Spinner /> : 'Reset Password'}
        </PrimaryBtn>
      </div>
    </Shell>
  );
}
