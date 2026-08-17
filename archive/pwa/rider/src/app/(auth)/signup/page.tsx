'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Mail, CreditCard, ArrowLeft, Zap } from 'lucide-react';

type SignupMethod = 'phone' | 'email' | 'ghanacard';

export default function SignupPage() {
  const router = useRouter();
  const [animating, setAnimating] = useState(false);

  function handleSelect(method: SignupMethod) {
    setAnimating(true);
    setTimeout(() => router.push(`/signup/${method}`), 200);
  }

  const methods: {
    key: SignupMethod;
    label: string;
    desc: string;
    icon: React.ReactNode;
    badge?: string;
  }[] = [
    {
      key: 'phone',
      label: 'Phone Number',
      desc: 'Quick setup with OTP verification',
      icon: <Phone className="w-6 h-6" />,
      badge: 'Fastest',
    },
    {
      key: 'email',
      label: 'Email Address',
      desc: 'Sign up with email & password',
      icon: <Mail className="w-6 h-6" />,
    },
    {
      key: 'ghanacard',
      label: 'Ghana Card',
      desc: 'Register with your National ID',
      icon: <CreditCard className="w-6 h-6" />,
    },
  ];

  return (
    <div
      className={`animate-fade-in transition-all duration-200 ${
        animating ? 'opacity-0 translate-y-2' : ''
      }`}
    >
      {/* Back */}
      <button
        onClick={() => router.push('/login')}
        className="flex items-center gap-1.5 text-muted hover:text-secondary text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Header */}
      <h1 className="text-3xl font-bold text-primary tracking-tight mb-1">Create your account</h1>
      <p className="text-muted mb-8">Choose how you want to get started</p>

      {/* Method cards */}
      <div className="space-y-3 mb-8">
        {methods.map((m) => (
          <button
            key={m.key}
            onClick={() => handleSelect(m.key)}
            className="w-full relative flex items-center gap-4 p-4 rounded-2xl border-2 border-themed bg-card hover:border-brand-500/50 hover:bg-brand-500/5 active:scale-[0.98] transition-all duration-200 text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-card-alt flex items-center justify-center text-muted shrink-0">
              {m.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-primary">{m.label}</span>
                {m.badge && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider gradient-brand text-white flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5" />
                    {m.badge}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted mt-0.5">{m.desc}</p>
            </div>
            <ArrowLeft className="w-5 h-5 text-muted rotate-180 shrink-0" />
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-themed" />
        <span className="text-xs font-medium text-muted uppercase tracking-wider">or</span>
        <div className="flex-1 h-px bg-themed" />
      </div>

      {/* Login link */}
      <button
        onClick={() => router.push('/login/authenticate')}
        className="w-full py-3.5 rounded-2xl font-semibold text-secondary bg-card border-2 border-themed hover:border-themed-strong active:scale-[0.98] transition-all duration-200"
      >
        I already have an account
      </button>
    </div>
  );
}
