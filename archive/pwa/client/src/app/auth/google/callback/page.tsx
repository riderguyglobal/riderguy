'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { AlertCircle } from 'lucide-react';

export default function GoogleCallbackPage() {
  const router = useRouter();
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const state = params.get('state');

    let savedState: string | null = null;
    try { savedState = sessionStorage.getItem('google_oauth_state'); sessionStorage.removeItem('google_oauth_state'); } catch {}
    if (!state || state !== savedState) {
      setError('Invalid OAuth state. Please try again.');
      return;
    }
    if (!accessToken) {
      setError('No access token received from Google.');
      return;
    }

    loginWithGoogle(accessToken, 'CLIENT')
      .then(() => router.replace('/dashboard'))
      .catch((err: any) => {
        const msg = err?.response?.data?.error?.message;
        setError(msg || 'Google sign-in failed. Please try again.');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div style={{ minHeight: '100dvh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
        <div style={{ width: '100%', maxWidth: 340, textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #fee2e2, #fecaca)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 4px 16px rgba(239,68,68,0.18)' }}>
            <AlertCircle style={{ width: 22, height: 22, color: '#ef4444' }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 8, letterSpacing: '-0.2px' }}>Sign-in Failed</p>
          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24, lineHeight: 1.55 }}>{error}</p>
          <button
            type="button"
            onClick={() => router.replace('/register')}
            style={{ height: 44, padding: '0 24px', borderRadius: 11, background: '#f3f4f6', border: '1.5px solid #e2e8f0', fontSize: 13, fontWeight: 700, color: '#374151', cursor: 'pointer' }}
          >
            Back to Register
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <span className="h-8 w-8 border-2 border-[#15803d] border-t-transparent rounded-full animate-spin inline-block" />
        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 12 }}>Completing sign-in…</p>
      </div>
    </div>
  );
}
