'use client';

import { useState } from 'react';
import { useAuth } from '@riderguy/auth';
import { emailSchema } from '@riderguy/validators';
import { ArrowLeft, Mail, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email) return;
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setError(result.error.errors[0]?.message ?? 'Invalid email');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message;
      setError(msg || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8 animate-scale-in">
          <div className="relative inline-flex mb-6">
            <div className="absolute inset-0 bg-brand-500/20 rounded-full blur-2xl scale-150 animate-ping-soft" />
            <div className="relative h-20 w-20 rounded-full bg-brand-500/10 border border-brand-500/30 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-brand-500" />
            </div>
          </div>
          <h2 className="text-xl font-extrabold text-surface-900 mb-2">Check your email</h2>
          <p className="text-surface-400 text-sm mb-8 max-w-xs mx-auto">
            If an account exists for <span className="font-medium text-surface-600">{email}</span>, we&apos;ve sent a password reset link.
          </p>
          <Link
            href="/login"
            className="h-[52px] px-8 rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-[15px] transition-all btn-press inline-flex items-center gap-2 shadow-[0_4px_24px_rgba(34,197,94,0.3)]"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link href="/login" className="flex items-center gap-2 text-surface-400 hover:text-surface-900 transition-colors group mb-6">
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        <span className="text-sm font-medium">Back to Sign In</span>
      </Link>

      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-surface-900 tracking-tight leading-tight">Reset password</h1>
        <p className="text-surface-400 text-base mt-2">Enter your email and we&apos;ll send you a reset link</p>
      </div>

      {error && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 animate-shake">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 leading-snug">{error}</p>
        </div>
      )}

      <div className="space-y-6 animate-fade-in">
        <div>
          <label className="block text-base font-medium text-surface-600 mb-2.5">Email address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-surface-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="you@example.com"
              autoFocus
              className="w-full h-[56px] rounded-xl bg-surface-50 border border-surface-200 pl-12 pr-5 text-base text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50 transition-all"
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !email}
          className="w-full h-[56px] rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-base transition-all btn-press disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(34,197,94,0.28)]"
        >
          {loading ? (
            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Send Reset Link'
          )}
        </button>
      </div>
    </div>
  );
}
