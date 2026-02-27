'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { API_BASE_URL } from '@/lib/constants';
import { Button } from '@riderguy/ui';
import {
  ArrowLeft, FileText, Camera, Car, ImageIcon,
  CheckCircle, Clock, AlertCircle, ChevronRight, Sparkles
} from 'lucide-react';

interface OnboardingStep {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
}

export default function OnboardingPage() {
  const router = useRouter();
  const { api } = useAuth();
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!api) return;
    api.get(`${API_BASE_URL}/riders/onboarding`)
      .then((res) => {
        const data = res.data.data;
        const mapped: OnboardingStep[] = [
          {
            key: 'documents',
            label: 'Identity Documents',
            description: 'Upload your ID and license',
            icon: <FileText className="h-5 w-5" />,
            href: '/dashboard/onboarding/documents',
            status: data?.documents ?? 'pending',
          },
          {
            key: 'selfie',
            label: 'Selfie Verification',
            description: 'Take a photo for identity check',
            icon: <Camera className="h-5 w-5" />,
            href: '/dashboard/onboarding/selfie',
            status: data?.selfie ?? 'pending',
          },
          {
            key: 'vehicle',
            label: 'Vehicle Registration',
            description: 'Add your vehicle details',
            icon: <Car className="h-5 w-5" />,
            href: '/dashboard/onboarding/vehicle',
            status: data?.vehicle ?? 'pending',
          },
          {
            key: 'vehiclePhotos',
            label: 'Vehicle Photos',
            description: 'Upload photos of your vehicle',
            icon: <ImageIcon className="h-5 w-5" />,
            href: '/dashboard/onboarding/vehicle-photos',
            status: data?.vehiclePhotos ?? 'pending',
          },
        ];
        setSteps(mapped);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api]);

  const completedCount = steps.filter((s) => s.status === 'approved').length;
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  const statusIcon = (status: string) => {
    switch (status) {
      case 'approved':  return <CheckCircle className="h-5 w-5 text-accent-400" />;
      case 'submitted': return <Clock className="h-5 w-5 text-amber-400" />;
      case 'rejected':  return <AlertCircle className="h-5 w-5 text-danger-400" />;
      default:          return <div className="h-5 w-5 rounded-full border-2 border-surface-600" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'approved':  return { text: 'Approved', color: 'text-accent-400' };
      case 'submitted': return { text: 'Under Review', color: 'text-amber-400' };
      case 'rejected':  return { text: 'Rejected', color: 'text-danger-400' };
      default:          return { text: 'Not Started', color: 'text-subtle' };
    }
  };

  return (
    <div className="min-h-[100dvh] pb-24 animate-page-enter bg-page">
      {/* Header */}
      <div className="safe-area-top bg-nav backdrop-blur-xl sticky top-0 z-20 border-b border-themed">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.push('/dashboard')} className="h-9 w-9 rounded-xl bg-skeleton border border-themed-strong flex items-center justify-center btn-press">
            <ArrowLeft className="h-5 w-5 text-secondary" />
          </button>
          <h1 className="text-lg font-bold text-primary tracking-tight">Rider Onboarding</h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Progress card */}
        <div className="glass-elevated rounded-2xl p-5 relative overflow-hidden">
          {/* Decorative glow */}
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-brand-500/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-400" />
                <h3 className="text-sm font-semibold text-primary">Your Progress</h3>
              </div>
              <span className="text-sm text-brand-400 font-bold tabular-nums">{completedCount}/{steps.length}</span>
            </div>
            <div className="h-2.5 rounded-full bg-skeleton overflow-hidden">
              <div
                className="h-full rounded-full gradient-brand transition-all duration-700 shadow-[0_0_12px_rgba(34,197,94,0.3)]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted mt-2.5">
              {progress === 100 ? '✨ All steps complete! Your application is under review.' : 'Complete all steps to start delivering.'}
            </p>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="glass-elevated rounded-2xl p-4 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-skeleton" />
                    <div className="flex-1">
                      <div className="h-4 bg-skeleton rounded w-1/2 mb-2" />
                      <div className="h-3 bg-skeleton rounded w-1/3" />
                    </div>
                  </div>
                </div>
              ))
            : steps.map((step, idx) => {
                const sl = statusLabel(step.status);
                return (
                  <button
                    key={step.key}
                    onClick={() => router.push(step.href)}
                    className="w-full glass-elevated rounded-2xl p-4 flex items-center gap-4 hover:bg-hover-themed transition-all btn-press animate-slide-up"
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
                      step.status === 'approved' ? 'bg-accent-500/15 text-accent-400'
                        : step.status === 'submitted' ? 'bg-amber-500/15 text-amber-400'
                        : step.status === 'rejected' ? 'bg-danger-500/15 text-danger-400'
                        : 'bg-skeleton text-muted'
                    }`}>
                      {step.icon}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold text-primary">{step.label}</p>
                      <p className={`text-xs mt-0.5 font-medium ${sl.color}`}>{sl.text}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusIcon(step.status)}
                      <ChevronRight className="h-4 w-4 text-subtle" />
                    </div>
                  </button>
                );
              })
          }
        </div>
      </div>
    </div>
  );
}
