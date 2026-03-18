'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';

export default function GoogleCallbackPage() {
  const router = useRouter();
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const state = params.get('state');

    // Verify CSRF state
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

    loginWithGoogle(accessToken, 'RIDER')
      .then(() => router.replace('/dashboard'))
      .catch((err: any) => {
        const msg = err?.response?.data?.error?.message;
        setError(msg || 'Google sign-in failed. Please try again.');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page p-6">
        <div className="text-center space-y-4">
          <p className="text-danger-400 text-sm">{error}</p>
          <button
            onClick={() => router.replace('/register')}
            className="text-brand-400 font-semibold text-sm hover:text-brand-300"
          >
            Back to Register
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page">
      <div className="h-8 w-8 border-3 border-brand-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
