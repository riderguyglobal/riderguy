'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@riderguy/auth';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
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

// ─── Step metadata (icons + routes) ─────────────────────────

const STEP_META: Record<string, { icon: string; route: string; description: string }> = {
  account_created: {
    icon: '👤',
    route: '',
    description: 'Your account has been created.',
  },
  national_id: {
    icon: '🪪',
    route: '/dashboard/onboarding/documents?type=NATIONAL_ID',
    description: 'Upload a clear photo of your national ID.',
  },
  drivers_license: {
    icon: '🚗',
    route: '/dashboard/onboarding/documents?type=DRIVERS_LICENSE',
    description: 'Upload your driver\'s license.',
  },
  selfie: {
    icon: '🤳',
    route: '/dashboard/onboarding/selfie',
    description: 'Take a clear selfie for identity verification.',
  },
  vehicle_registration: {
    icon: '🏍️',
    route: '/dashboard/onboarding/vehicle',
    description: 'Register your delivery vehicle.',
  },
  insurance: {
    icon: '🛡️',
    route: '/dashboard/onboarding/documents?type=INSURANCE_CERTIFICATE',
    description: 'Upload your insurance certificate (optional).',
  },
  vehicle_photos: {
    icon: '📸',
    route: '/dashboard/onboarding/vehicle-photos',
    description: 'Upload photos of your vehicle (optional).',
  },
  review_pending: {
    icon: '⏳',
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
      <div className="p-4">
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error || 'Something went wrong.'}
        </div>
        <Button className="mt-4" onClick={() => void fetchProgress()}>
          Retry
        </Button>
      </div>
    );
  }

  const isApproved = progress.onboardingStatus === 'ACTIVATED';
  const isRejected = progress.onboardingStatus === 'DOCUMENTS_REJECTED';

  return (
    <div className="p-4">
      {/* Header with illustration */}
      <div className="mb-6 flex items-start gap-4">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {isApproved ? 'You\'re Approved! 🎉' : isRejected ? 'Application Update' : 'Complete Your Profile'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
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
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">Progress</span>
          <span className="font-semibold text-brand-500">
            {Math.round(progress.overallProgress)}%
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500"
            style={{ width: `${progress.overallProgress}%` }}
          />
        </div>
      </div>

      {/* Status banner */}
      {isApproved && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            ✅ Your application has been approved. Go to your dashboard to start delivering!
          </p>
          <Button className="mt-3" onClick={() => router.push('/dashboard')}>
            Go to Dashboard
          </Button>
        </div>
      )}

      {isRejected && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">
            ❌ Some of your documents were not approved. Please re-upload the rejected items below.
          </p>
        </div>
      )}

      {/* Checklist */}
      <div className="space-y-3">
        {progress.steps.map((step) => {
          const meta = STEP_META[step.key];
          if (!meta) return null;

          const isCompleted = step.status === 'completed';
          const isCurrent = step.status === 'current';
          const canNavigate = meta.route && (isCurrent || (!isCompleted && step.status === 'pending'));

          return (
            <Card
              key={step.key}
              className={`transition-all ${
                isCurrent
                  ? 'border-brand-300 bg-brand-50 ring-1 ring-brand-200'
                  : isCompleted
                    ? 'border-green-200 bg-green-50/50'
                    : 'border-gray-100'
              }`}
            >
              <CardContent className="flex items-center gap-3 p-4">
                {/* Status icon */}
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg ${
                    isCompleted
                      ? 'bg-green-100'
                      : isCurrent
                        ? 'bg-brand-100'
                        : 'bg-gray-100'
                  }`}
                >
                  {isCompleted ? '✓' : meta.icon}
                </div>

                {/* Text */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${isCompleted ? 'text-green-700' : 'text-gray-900'}`}>
                      {step.label}
                    </p>
                    {step.optional && (
                      <Badge variant="outline" className="text-[10px]">
                        Optional
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">{meta.description}</p>
                </div>

                {/* Action button */}
                {canNavigate && (
                  <Button
                    size="sm"
                    variant={isCurrent ? 'default' : 'outline'}
                    onClick={() => router.push(meta.route)}
                  >
                    {isCurrent ? 'Start' : 'Upload'}
                  </Button>
                )}

                {isCompleted && (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                    Done
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info text */}
      <p className="mt-6 text-center text-xs text-gray-400">
        All documents are securely stored and only used for verification purposes.
      </p>
    </div>
  );
}
