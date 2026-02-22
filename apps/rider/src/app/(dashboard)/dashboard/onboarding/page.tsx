'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@riderguy/auth';
import {
  Button,
  Spinner,
} from '@riderguy/ui';
import { API_BASE_URL } from '@/lib/constants';

// ─── Types ──────────────────────────────────────────────────

interface OnboardingStep {
  key: string;
  label: string;
  status: 'completed' | 'current' | 'pending';
  optional: boolean;
}

interface OnboardingProgress {
  overallProgress: number;
  onboardingStatus: string;
  steps: OnboardingStep[];
}

// ─── Step metadata (SVG icons + routes) ─────────────────────

const STEP_META: Record<string, { icon: React.ReactNode; route: string; description: string }> = {
  account_created: {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    route: '',
    description: 'Your account has been created.',
  },
  national_id: {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
    route: '/dashboard/onboarding/documents?type=NATIONAL_ID',
    description: 'Upload a clear photo of your national ID.',
  },
  drivers_license: {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M14 10h4M14 14h4"/></svg>,
    route: '/dashboard/onboarding/documents?type=DRIVERS_LICENSE',
    description: 'Upload your driver\'s license.',
  },
  selfie: {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
    route: '/dashboard/onboarding/selfie',
    description: 'Take a clear selfie for identity verification.',
  },
  vehicle_registration: {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/><path d="M15 5h4l3 8v5h-3M1 8h10v8H8"/></svg>,
    route: '/dashboard/onboarding/vehicle',
    description: 'Register your delivery vehicle.',
  },
  insurance: {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    route: '/dashboard/onboarding/documents?type=INSURANCE_CERTIFICATE',
    description: 'Upload your insurance certificate (optional).',
  },
  vehicle_photos: {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
    route: '/dashboard/onboarding/vehicle-photos',
    description: 'Upload photos of your vehicle (optional).',
  },
  review_pending: {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    route: '',
    description: 'Your application is being reviewed by our team.',
  },
};

// ─── Component ──────────────────────────────────────────────

export default function OnboardingPage() {
  const { user, accessToken } = useAuth();
  const router = useRouter();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/riders/onboarding`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) throw new Error('Failed to fetch onboarding progress');

      const json = await res.json();
      setProgress(json.data);
    } catch {
      setError('Could not load onboarding progress. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void fetchProgress();
  }, [fetchProgress]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-brand-500" />
      </div>
    );
  }

  if (error || !progress) {
    return (
      <div className="px-4 pt-6">
        <div className="rounded-2xl bg-danger-50 border border-danger-200 p-4 text-sm text-danger-700">
          {error || 'Something went wrong.'}
        </div>
        <Button className="mt-4 rounded-xl" onClick={() => void fetchProgress()}>
          Retry
        </Button>
      </div>
    );
  }

  const isApproved = progress.onboardingStatus === 'ACTIVATED';
  const isRejected = progress.onboardingStatus === 'DOCUMENTS_REJECTED';
  const completedCount = progress.steps.filter((s) => s.status === 'completed').length;

  return (
    <div className="dash-page-enter pb-8">
      {/* ── Hero header ── */}
      <div className="bg-gradient-to-br from-surface-900 via-surface-800 to-brand-900 px-4 pt-6 pb-8">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">
              {isApproved ? 'You\'re Approved!' : isRejected ? 'Application Update' : 'Complete Your Profile'}
            </h1>
            <p className="mt-1 text-sm text-white/60">
              {isApproved
                ? 'You can now start accepting deliveries.'
                : isRejected
                  ? 'Please review and re-upload the necessary documents.'
                  : 'Complete the steps below to start accepting deliveries.'}
            </p>
          </div>
          <div className="relative h-16 w-16 flex-shrink-0">
            <Image
              src="/images/illustrations/biker-train.svg"
              alt="Onboarding"
              fill
              className="object-contain"
            />
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium text-white/60">{completedCount} of {progress.steps.length} steps</span>
            <span className="font-bold text-white">
              {Math.round(progress.overallProgress)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-400 to-accent-400 transition-all duration-700"
              style={{ width: `${progress.overallProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Status banners */}
      {isApproved && (
        <div className="mx-4 -mt-4 relative z-10">
          <div className="rounded-2xl bg-gradient-to-br from-accent-50 to-accent-100/50 border border-accent-200 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-surface-900">Application Approved</p>
                <p className="text-xs text-surface-500">Start delivering today!</p>
              </div>
            </div>
            <Button className="mt-3 w-full bg-surface-900 hover:bg-surface-800 rounded-xl h-11" onClick={() => router.push('/dashboard')}>
              Go to Dashboard
            </Button>
          </div>
        </div>
      )}

      {isRejected && (
        <div className="mx-4 -mt-4 relative z-10">
          <div className="rounded-2xl bg-danger-50 border border-danger-200 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-100">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-danger-800">Documents Not Approved</p>
                <p className="text-xs text-danger-600">Please re-upload the rejected items below.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Checklist ── */}
      <div className={`px-4 space-y-2 dash-stagger-in ${isApproved || isRejected ? 'pt-4' : 'pt-4'}`}>
        {progress.steps.map((step, idx) => {
          const meta = STEP_META[step.key];
          if (!meta) return null;

          const isCompleted = step.status === 'completed';
          const isCurrent = step.status === 'current';
          const canNavigate = meta.route && (isCurrent || (!isCompleted && step.status === 'pending'));

          return (
            <div
              key={step.key}
              className={`rounded-2xl border-2 p-4 transition-all ${
                isCurrent
                  ? 'border-brand-500 bg-brand-50/50 shadow-sm'
                  : isCompleted
                    ? 'border-accent-200 bg-accent-50/30'
                    : 'border-surface-100 bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Status icon */}
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                    isCompleted
                      ? 'bg-accent-100 text-accent-600'
                      : isCurrent
                        ? 'bg-brand-100 text-brand-600'
                        : 'bg-surface-100 text-surface-400'
                  }`}
                >
                  {isCompleted ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : (
                    meta.icon
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold ${isCompleted ? 'text-accent-700' : 'text-surface-900'}`}>
                      {step.label}
                    </p>
                    {step.optional && (
                      <span className="rounded-md bg-surface-100 px-1.5 py-0.5 text-[10px] font-medium text-surface-500">
                        Optional
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-surface-500">{meta.description}</p>
                </div>

                {/* Action */}
                {canNavigate && (
                  <Button
                    size="sm"
                    className={`rounded-xl flex-shrink-0 ${
                      isCurrent
                        ? 'bg-brand-500 hover:bg-brand-600'
                        : ''
                    }`}
                    variant={isCurrent ? 'default' : 'outline'}
                    onClick={() => router.push(meta.route)}
                  >
                    {isCurrent ? 'Start' : 'Upload'}
                  </Button>
                )}

                {isCompleted && (
                  <span className="inline-flex items-center rounded-full bg-accent-100 px-2.5 py-1 text-[10px] font-bold text-accent-700">
                    Done
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info text */}
      <div className="mt-6 flex items-center justify-center gap-1.5 px-4">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        <p className="text-[10px] text-surface-400">
          All documents are securely stored and only used for verification.
        </p>
      </div>
    </div>
  );
}
