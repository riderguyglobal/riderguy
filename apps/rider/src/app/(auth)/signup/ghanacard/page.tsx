'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import {
  ArrowLeft, AlertCircle, CreditCard, Lock, User, Eye, EyeOff,
  ShieldQuestion, ChevronRight,
} from 'lucide-react';

type Step = 'info' | 'security';

const SECURITY_QUESTIONS = [
  'What was the name of your first pet?',
  'What is the name of the street you grew up on?',
  'What was your childhood nickname?',
  'What is your mother\'s maiden name?',
  'What was the name of your first school?',
  'In what city were you born?',
  'What is your favourite food?',
];

export default function GhanaCardSignupPage() {
  const router = useRouter();
  const { registerWithGhanaCard, isAuthenticated } = useAuth();

  const [step, setStep] = useState<Step>('info');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [ghanaCard, setGhanaCard] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace('/signup/pin-setup');
  }, [isAuthenticated, router]);

  function handleInfoSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!firstName.trim()) { setError('First name is required'); return; }
    if (!lastName.trim()) { setError('Last name is required'); return; }
    if (ghanaCard.length < 10) { setError('Enter a valid Ghana Card number'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setStep('security');
  }

  async function handleSecuritySubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!securityQuestion) { setError('Select a security question'); return; }
    if (securityAnswer.trim().length < 2) { setError('Security answer must be at least 2 characters'); return; }

    setLoading(true);
    try {
      await registerWithGhanaCard({
        ghanaCard,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: 'RIDER',
        securityQuestion,
        securityAnswer: securityAnswer.trim(),
      });
      router.replace('/signup/pin-setup');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Registration failed. Try again.');
    } finally { setLoading(false); }
  }

  if (step === 'security') {
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => { setStep('info'); setError(''); }}
          className="flex items-center gap-1.5 text-muted hover:text-secondary text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl gradient-brand flex items-center justify-center shadow-lg shadow-brand-500/20">
            <ShieldQuestion className="w-8 h-8 text-white" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-primary text-center mb-1">Security question</h2>
        <p className="text-muted text-sm text-center mb-8">
          This helps recover your account if you forget your PIN
        </p>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-1 rounded-full bg-brand-500" />
          <div className="w-8 h-1 rounded-full bg-brand-500" />
        </div>

        <form onSubmit={handleSecuritySubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-secondary mb-2.5">Security Question</label>
            <select
              value={securityQuestion}
              onChange={(e) => { setSecurityQuestion(e.target.value); setError(''); }}
              className="w-full px-4 py-4 rounded-2xl border-2 border-themed bg-card text-primary focus:border-brand-500 focus:outline-none transition-all duration-200 appearance-none"
            >
              <option value="">Select a question...</option>
              {SECURITY_QUESTIONS.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-secondary mb-2.5">Your Answer</label>
            <div className="flex items-center rounded-2xl border-2 border-themed bg-card overflow-hidden focus-within:border-brand-500 transition-all duration-200">
              <div className="pl-4 text-muted"><Lock className="w-5 h-5" /></div>
              <input
                type="text"
                value={securityAnswer}
                onChange={(e) => { setSecurityAnswer(e.target.value); setError(''); }}
                placeholder="Enter your answer"
                autoFocus
                className="flex-1 px-3 py-4 text-base text-primary placeholder:text-subtle bg-transparent focus:outline-none"
              />
            </div>
            <p className="text-xs text-muted mt-2">
              Remember this answer exactly. It is case-insensitive.
            </p>
          </div>

          {error && (
            <p className="text-danger-400 text-xs flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
            </p>
          )}

          <button
            type="submit"
            disabled={!securityQuestion || securityAnswer.trim().length < 2 || loading}
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

  return (
    <div className="animate-fade-in">
      <button
        onClick={() => router.push('/signup')}
        className="flex items-center gap-1.5 text-muted hover:text-secondary text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-3xl font-bold text-primary tracking-tight mb-1">Ghana Card signup</h1>
      <p className="text-muted mb-8">Register with your National ID</p>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <div className="w-8 h-1 rounded-full bg-brand-500" />
        <div className="w-8 h-1 rounded-full bg-themed" />
      </div>

      <form onSubmit={handleInfoSubmit} className="space-y-4">
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
          <label className="block text-sm font-semibold text-secondary mb-2.5">Ghana Card Number</label>
          <div className="flex items-center rounded-2xl border-2 border-themed bg-card overflow-hidden focus-within:border-brand-500 transition-all duration-200">
            <div className="pl-4 text-muted"><CreditCard className="w-5 h-5" /></div>
            <input
              type="text"
              value={ghanaCard}
              onChange={(e) => {
                const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                let formatted = '';
                for (let i = 0; i < raw.length && i < 13; i++) {
                  if (i === 3 || i === 12) formatted += '-';
                  formatted += raw[i];
                }
                setGhanaCard(formatted);
                setError('');
              }}
              placeholder="GHA-XXXXXXXXX-X"
              maxLength={15}
              className="flex-1 px-3 py-4 text-base text-primary placeholder:text-subtle bg-transparent focus:outline-none font-mono tracking-wide"
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
          disabled={!firstName.trim() || !lastName.trim() || ghanaCard.length < 10 || !password || !confirmPassword}
          className="w-full relative py-4 rounded-2xl font-semibold text-white gradient-brand hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-200 shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2"
        >
          Next: Security Question
          <ChevronRight className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
