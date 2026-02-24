'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { Button, Input, Label, OtpInput, PhoneInput, StepIndicator } from '@riderguy/ui';
import { AlertCircle, CheckCircle, User, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const STEPS = [{ label: 'Phone' }, { label: 'Verify' }, { label: 'Details' }, { label: 'Done' }];

export default function RegisterPage() {
  const router = useRouter();
  const { requestOtp, verifyOtp, register } = useAuth();
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async () => {
    if (!phone) return;
    setLoading(true);
    setError('');
    try {
      await requestOtp(phone, 'REGISTRATION');
      setStep(1);
    } catch {
      setError('Failed to send code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6) return;
    setLoading(true);
    setError('');
    try {
      await verifyOtp(phone, otp, 'REGISTRATION');
      setStep(2);
    } catch {
      setError('Invalid code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !password) return;
    setLoading(true);
    setError('');
    try {
      await register({ firstName, lastName, email, password, phone, role: 'CLIENT', otpCode: otp });
      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {step < 3 && (
        <button onClick={() => step > 0 ? setStep(step - 1) : router.push('/login')} className="flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      )}

      <div>
        <h1 className="text-2xl font-bold text-surface-900 mb-1">Create account</h1>
        <p className="text-surface-500">Join RiderGuy to start sending packages</p>
      </div>

      <StepIndicator steps={STEPS} currentStep={step} />

      {error && (
        <div className="p-3 rounded-xl bg-danger-50 border border-danger-100 flex items-start gap-2 animate-shake">
          <AlertCircle className="h-4 w-4 text-danger-500 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-600">{error}</p>
        </div>
      )}

      {/* Step 0: Phone */}
      {step === 0 && (
        <div className="space-y-4 animate-fade-in">
          <div className="space-y-2">
            <Label className="text-surface-700">Phone number</Label>
            <PhoneInput value={phone} onValueChange={setPhone} placeholder="024 XXX XXXX" />
          </div>
          <Button size="xl" className="w-full bg-brand-500 hover:bg-brand-600" onClick={handleSendOtp} loading={loading}>
            Continue
          </Button>
        </div>
      )}

      {/* Step 1: OTP */}
      {step === 1 && (
        <div className="space-y-4 animate-fade-in">
          <div className="space-y-2">
            <Label className="text-surface-700">Verification code</Label>
            <p className="text-xs text-surface-400">Sent to {phone}</p>
            <OtpInput length={6} onChange={setOtp} />
          </div>
          <Button size="xl" className="w-full bg-brand-500 hover:bg-brand-600" onClick={handleVerifyOtp} loading={loading} disabled={otp.length < 6}>
            Verify
          </Button>
        </div>
      )}

      {/* Step 2: Details */}
      {step === 2 && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-surface-700">First name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" />
            </div>
            <div className="space-y-2">
              <Label className="text-surface-700">Last name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-surface-700">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="space-y-2">
            <Label className="text-surface-700">Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <Button size="xl" className="w-full bg-brand-500 hover:bg-brand-600" onClick={handleRegister} loading={loading}>
            Create Account
          </Button>
        </div>
      )}

      {/* Step 3: Success */}
      {step === 3 && (
        <div className="text-center py-8 animate-scale-in">
          <div className="h-16 w-16 rounded-full bg-accent-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-accent-500" />
          </div>
          <h2 className="text-xl font-bold text-surface-900 mb-2">Welcome to RiderGuy!</h2>
          <p className="text-surface-500 mb-6">Your account is ready. Start sending packages now.</p>
          <Button size="xl" className="bg-brand-500 hover:bg-brand-600" onClick={() => router.replace('/dashboard')}>
            <User className="h-4 w-4 mr-2" />
            Go to Dashboard
          </Button>
        </div>
      )}

      {step < 3 && (
        <p className="text-center text-sm text-surface-500">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-500 font-medium hover:text-brand-600">
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}
