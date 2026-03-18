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
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={() => router.replace('/register')}
            className="text-brand-500 font-semibold text-sm hover:text-brand-400"
          >
            Back to Register
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-8 w-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
