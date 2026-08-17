'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        <span className="h-7 w-7 border-2 border-[#15803d] border-t-transparent rounded-full animate-spin inline-block" />
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

  const PrimaryLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <Link
      href={href}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
        height: 50, padding: '0 28px', borderRadius: 13,
        background: 'linear-gradient(135deg, #16a34a 0%, #15803d 55%, #0f6830 100%)',
        color: '#ffffff', fontSize: 14, fontWeight: 700, textDecoration: 'none',
        boxShadow: '0 6px 18px rgba(21,128,61,0.38), 0 2px 6px rgba(21,128,61,0.18)',
      }}
    >
      {children}
      <ChevronRight style={{ marginLeft: 6, width: 15, height: 15, opacity: 0.55 }} />
    </Link>
  );

  return (
    <div style={{ minHeight: '100dvh', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>

        {/* Loading */}
        {status === 'loading' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ position: 'relative', width: 68, height: 68, margin: '0 auto' }}>
              <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', background: 'radial-gradient(circle, rgba(21,128,61,0.12) 0%, transparent 70%)' }} />
              <div style={{ width: 68, height: 68, borderRadius: '50%', border: '2.5px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="h-7 w-7 border-2 border-[#15803d] border-t-transparent rounded-full animate-spin inline-block" />
              </div>
            </div>
            <div>
              <p style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.4px', marginBottom: 6 }}>Verifying your email…</p>
              <p style={{ fontSize: 13, color: '#94a3b8' }}>Please wait a moment.</p>
            </div>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ position: 'relative', width: 68, height: 68, margin: '0 auto' }}>
              <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', background: 'radial-gradient(circle, rgba(21,128,61,0.16) 0%, transparent 70%)' }} />
              <div
                className="flex items-center justify-center"
                style={{ width: 68, height: 68, borderRadius: '50%', background: 'linear-gradient(135deg, #16a34a, #0f6830)', boxShadow: '0 6px 28px rgba(21,128,61,0.40)' }}
              >
                <CheckCircle style={{ width: 28, height: 28, color: '#fff' }} />
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 8 }}>Email Verified!</p>
              <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.55 }}>{message}</p>
            </div>
            <PrimaryLink href="/dashboard">Go to Dashboard</PrimaryLink>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'linear-gradient(135deg, #fee2e2, #fecaca)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(239,68,68,0.18)' }}>
              <XCircle style={{ width: 28, height: 28, color: '#ef4444' }} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 8 }}>Verification Failed</p>
              <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.55 }}>{message}</p>
            </div>
            <Link
              href="/login"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                height: 46, padding: '0 24px', borderRadius: 12,
                background: '#f3f4f6', border: '1.5px solid #e2e8f0',
                fontSize: 13, fontWeight: 700, color: '#374151', textDecoration: 'none',
              }}
            >
              Back to Sign In
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
