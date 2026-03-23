'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 text-brand-500 animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
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
    <div className="min-h-[100dvh] flex items-center justify-center bg-white px-5">
      <div className="w-full max-w-md text-center py-12">
        {status === 'loading' && (
          <div className="animate-fade-in">
            <Loader2 className="h-12 w-12 text-brand-500 mx-auto animate-spin mb-4" />
            <h2 className="text-xl font-extrabold text-surface-900 mb-2">Verifying your email…</h2>
            <p className="text-surface-400 text-sm">Please wait a moment.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="animate-scale-in">
            <div className="relative inline-flex mb-6">
              <div className="absolute inset-0 bg-brand-500/20 rounded-full blur-2xl scale-150 animate-ping-soft" />
              <div className="relative h-20 w-20 rounded-full bg-brand-500/10 border border-brand-500/30 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-brand-500" />
              </div>
            </div>
            <h2 className="text-xl font-extrabold text-surface-900 mb-2">Email Verified!</h2>
            <p className="text-surface-400 text-sm mb-8">{message}</p>
            <Link
              href="/dashboard"
              className="h-[52px] px-8 rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-[15px] transition-all btn-press inline-flex items-center gap-2 shadow-[0_4px_24px_rgba(34,197,94,0.3)]"
            >
              Go to Dashboard
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="animate-scale-in">
            <div className="relative inline-flex mb-6">
              <div className="relative h-20 w-20 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
                <XCircle className="h-10 w-10 text-red-500" />
              </div>
            </div>
            <h2 className="text-xl font-extrabold text-surface-900 mb-2">Verification Failed</h2>
            <p className="text-surface-400 text-sm mb-8">{message}</p>
            <Link
              href="/login"
              className="h-[52px] px-8 rounded-xl bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold text-[15px] transition-all btn-press inline-flex items-center gap-2"
            >
              Back to Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
