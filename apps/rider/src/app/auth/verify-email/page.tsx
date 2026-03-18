'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const { verifyEmail } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const token = searchParams?.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }

    verifyEmail(token)
      .then(() => {
        setStatus('success');
        setMessage('Your email has been verified successfully!');
      })
      .catch((err: any) => {
        setStatus('error');
        const msg = err?.response?.data?.error?.message;
        setMessage(msg || 'Verification failed. The link may have expired.');
      });
  }, [searchParams, verifyEmail]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-page px-5">
      <div className="w-full max-w-md text-center py-12">
        {status === 'loading' && (
          <div className="animate-fade-in">
            <Loader2 className="h-12 w-12 text-brand-400 mx-auto animate-spin mb-4" />
            <h2 className="text-xl font-extrabold text-primary mb-2">Verifying your email…</h2>
            <p className="text-muted text-sm">Please wait a moment.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="animate-scale-in">
            <div className="relative inline-flex mb-6">
              <div className="absolute inset-0 bg-brand-500/20 rounded-full blur-2xl scale-150" />
              <div className="relative h-20 w-20 rounded-full bg-brand-500/10 border border-brand-500/30 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-brand-400" />
              </div>
            </div>
            <h2 className="text-xl font-extrabold text-primary mb-2">Email Verified!</h2>
            <p className="text-muted text-sm mb-8">{message}</p>
            <Link
              href="/dashboard"
              className="h-[52px] px-8 rounded-2xl gradient-brand text-white font-bold text-[15px] transition-all btn-press inline-flex items-center gap-2 shadow-lg glow-brand"
            >
              Go to Dashboard
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="animate-scale-in">
            <div className="relative inline-flex mb-6">
              <div className="relative h-20 w-20 rounded-full bg-danger-500/10 border border-danger-500/20 flex items-center justify-center">
                <XCircle className="h-10 w-10 text-danger-400" />
              </div>
            </div>
            <h2 className="text-xl font-extrabold text-primary mb-2">Verification Failed</h2>
            <p className="text-muted text-sm mb-8">{message}</p>
            <Link
              href="/login"
              className="h-[52px] px-8 rounded-2xl bg-card border border-themed text-secondary font-bold text-[15px] transition-all btn-press inline-flex items-center gap-2 hover:bg-hover-themed"
            >
              Back to Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
