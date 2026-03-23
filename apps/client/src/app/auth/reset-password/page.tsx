'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { passwordSchema } from '@riderguy/validators';
import { ArrowLeft, AlertCircle, CheckCircle, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 text-brand-500 animate-spin" />
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

  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const t = searchParams?.get('token');
    if (t) setToken(t);
  }, [searchParams]);

  const handleSubmit = async () => {
    if (!token) { setError('Missing reset token. Please use the link from your email.'); return; }
    if (!password || !confirmPassword) return;

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const pwResult = passwordSchema.safeParse(password);
    if (!pwResult.success) {
      setError(pwResult.error.errors[0]?.message ?? 'Invalid password');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message;
      setError(msg || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white px-5">
        <div className="w-full max-w-md text-center py-12 animate-scale-in">
          <div className="relative inline-flex mb-6">
            <div className="absolute inset-0 bg-brand-500/20 rounded-full blur-2xl scale-150 animate-ping-soft" />
            <div className="relative h-20 w-20 rounded-full bg-brand-500/10 border border-brand-500/30 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-brand-500" />
            </div>
          </div>
          <h2 className="text-xl font-extrabold text-surface-900 mb-2">Password Reset!</h2>
          <p className="text-surface-400 text-sm mb-8">Your password has been changed. You can now sign in.</p>
          <Link
            href="/login"
            className="h-[52px] px-8 rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-[15px] transition-all btn-press inline-flex items-center gap-2 shadow-[0_4px_24px_rgba(34,197,94,0.3)]"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white px-5">
        <div className="w-full max-w-md text-center py-12">
          <div className="relative inline-flex mb-6">
            <div className="relative h-20 w-20 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
              <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
          </div>
          <h2 className="text-xl font-extrabold text-surface-900 mb-2">Invalid Link</h2>
          <p className="text-surface-400 text-sm mb-8">This password reset link is invalid or has expired.</p>
          <Link
            href="/forgot-password"
            className="h-[52px] px-8 rounded-xl bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold text-[15px] transition-all btn-press inline-flex items-center gap-2"
          >
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-white px-5">
      <div className="w-full max-w-md py-12">
        <Link href="/login" className="flex items-center gap-2 text-surface-400 hover:text-surface-900 transition-colors group mb-6">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm font-medium">Back to Sign In</span>
        </Link>

        <div className="mb-10">
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-surface-50 border border-surface-200 flex items-center justify-center">
            <KeyRound className="h-5 w-5 text-surface-600" />
          </div>
          <h1 className="text-3xl font-extrabold text-surface-900 tracking-tight leading-tight">New password</h1>
          <p className="text-surface-400 text-base mt-2">Choose a strong password for your account</p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 animate-shake">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 leading-snug">{error}</p>
          </div>
        )}

        <div className="space-y-5 animate-fade-in">
          <div>
            <label className="block text-base font-medium text-surface-600 mb-2.5">New password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoFocus
                className="w-full h-[56px] rounded-xl bg-surface-50 border border-surface-200 px-5 pr-12 text-base text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50 transition-all"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors p-1">
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <p className="text-xs text-surface-400 mt-1.5">Must include uppercase, lowercase, and a number</p>
          </div>

          <div>
            <label className="block text-base font-medium text-surface-600 mb-2.5">Confirm password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Re-enter your password"
              className="w-full h-[56px] rounded-xl bg-surface-50 border border-surface-200 px-5 text-base text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50 transition-all"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !password || !confirmPassword}
            className="w-full h-[56px] rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-base transition-all btn-press disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(34,197,94,0.28)]"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Reset Password'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
