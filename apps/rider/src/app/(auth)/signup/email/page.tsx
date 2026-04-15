'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { ArrowLeft, AlertCircle, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';

export default function EmailSignupPage() {
  const router = useRouter();
  const { registerWithEmail, isAuthenticated } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace('/signup/pin-setup');
  }, [isAuthenticated, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!firstName.trim()) { setError('First name is required'); return; }
    if (!lastName.trim()) { setError('Last name is required'); return; }
    if (!email.includes('@')) { setError('Enter a valid email address'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      await registerWithEmail({
        email,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: 'RIDER',
      });
      router.replace('/signup/pin-setup');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Registration failed. Try again.');
    } finally { setLoading(false); }
  }

  return (
    <div className="animate-fade-in">
      <button
        onClick={() => router.push('/signup')}
        className="flex items-center gap-1.5 text-muted hover:text-secondary text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-3xl font-bold text-primary tracking-tight mb-1">Email signup</h1>
      <p className="text-muted mb-8">Create your account with email</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-secondary mb-2">First Name</label>
            <div className="flex items-center rounded-2xl border-2 border-themed bg-card overflow-hidden focus-within:border-brand-500 transition-all duration-200">
              <div className="pl-3 text-muted"><User className="w-4 h-4" /></div>
              <input
                type="text"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setError(''); }}
                placeholder="Kofi"
                autoFocus
                className="flex-1 px-2 py-3.5 text-base text-primary placeholder:text-subtle bg-transparent focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-secondary mb-2">Last Name</label>
            <div className="flex items-center rounded-2xl border-2 border-themed bg-card overflow-hidden focus-within:border-brand-500 transition-all duration-200">
              <input
                type="text"
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); setError(''); }}
                placeholder="Mensah"
                className="flex-1 px-4 py-3.5 text-base text-primary placeholder:text-subtle bg-transparent focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-secondary mb-2.5">Email Address</label>
          <div className="flex items-center rounded-2xl border-2 border-themed bg-card overflow-hidden focus-within:border-brand-500 transition-all duration-200">
            <div className="pl-4 text-muted"><Mail className="w-5 h-5" /></div>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="you@example.com"
              className="flex-1 px-3 py-4 text-base text-primary placeholder:text-subtle bg-transparent focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-secondary mb-2.5">Password</label>
          <div className="flex items-center rounded-2xl border-2 border-themed bg-card overflow-hidden focus-within:border-brand-500 transition-all duration-200">
            <div className="pl-4 text-muted"><Lock className="w-5 h-5" /></div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Min. 8 characters"
              className="flex-1 px-3 py-4 text-base text-primary placeholder:text-subtle bg-transparent focus:outline-none"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="pr-4 text-muted hover:text-secondary transition-colors">
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-secondary mb-2.5">Confirm Password</label>
          <div className="flex items-center rounded-2xl border-2 border-themed bg-card overflow-hidden focus-within:border-brand-500 transition-all duration-200">
            <div className="pl-4 text-muted"><Lock className="w-5 h-5" /></div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
              placeholder="Confirm your password"
              className="flex-1 px-3 py-4 text-base text-primary placeholder:text-subtle bg-transparent focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <p className="text-danger-400 text-xs flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
          </p>
        )}

        <button
          type="submit"
          disabled={!firstName.trim() || !lastName.trim() || !email || !password || !confirmPassword || loading}
          className="w-full relative py-4 rounded-2xl font-semibold text-white gradient-brand hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-200 shadow-lg shadow-brand-500/20"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Creating account...
            </span>
          ) : 'Create Account'}
        </button>
      </form>
    </div>
  );
}
