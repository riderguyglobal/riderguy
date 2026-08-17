'use client';

import { TRACKING_STEPS, ORDER_STATUS_CONFIG } from '@/lib/constants';

interface OrderProgressBarProps {
  status: string;
  className?: string;
}

export function OrderProgressBar({ status, className = '' }: OrderProgressBarProps) {
  const cfg = ORDER_STATUS_CONFIG[status];
  const currentStep = cfg?.step ?? 0;
  const isCancelled = currentStep === -1;

  if (isCancelled) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="tracking-progress-track">
          <div className="tracking-progress-fill bg-red-500" style={{ width: '100%' }} />
        </div>
        <p className="text-[12px] font-medium text-red-500 text-center">
          {cfg?.description ?? 'Order cancelled'}
        </p>
      </div>
    );
  }

  const progressPct = Math.max(0, Math.min(100, (currentStep / (TRACKING_STEPS.length - 1)) * 100));

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Progress bar */}
      <div className="tracking-progress-track">
        <div
          className="tracking-progress-fill"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Step dots + labels */}
      <div className="flex items-start justify-between">
        {TRACKING_STEPS.map((step, i) => {
          const isDone    = i < currentStep;
          const isCurrent = i === currentStep;
          const isFuture  = i > currentStep;
          return (
            <div key={step.key} className="flex flex-col items-center gap-1 flex-1">
              <span
                className={`step-dot mx-auto
                  ${isDone    ? 'step-dot-done'    : ''}
                  ${isCurrent ? 'step-dot-current' : ''}
                  ${isFuture  ? 'step-dot-future'  : ''}
                `}
              />
              <span
                className={`text-[9px] font-semibold text-center leading-tight
                  ${isCurrent ? 'text-surface-900' : 'text-surface-300'}
                  ${isDone    ? 'text-surface-500' : ''}
                `}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
