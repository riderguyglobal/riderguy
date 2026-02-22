'use client';

import React from 'react';
import { cn } from '../lib/utils';

// ============================================================
// StepIndicator — horizontal numbered step progress bar
// ============================================================

export interface Step {
  /** Short label shown below the step circle */
  label: string;
}

export interface StepIndicatorProps {
  steps: Step[];
  /** 0-indexed current step */
  currentStep: number;
  /** Additional className for the wrapper */
  className?: string;
}

export function StepIndicator({ steps, currentStep, className }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress" className={cn('w-full', className)}>
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isUpcoming = index > currentStep;

          return (
            <li
              key={index}
              className={cn('flex flex-1 flex-col items-center', index !== 0 && 'relative')}
            >
              {/* Connector line */}
              {index !== 0 && (
                <div
                  className={cn(
                    'absolute left-0 right-1/2 top-4 -translate-y-1/2 h-0.5',
                    isCompleted || isCurrent ? 'bg-brand-500' : 'bg-gray-200'
                  )}
                  style={{ left: '-50%', right: '50%' }}
                />
              )}

              {/* Circle */}
              <div
                className={cn(
                  'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                  isCompleted && 'border-brand-500 bg-brand-500 text-white',
                  isCurrent && 'border-brand-500 bg-white text-brand-500',
                  isUpcoming && 'border-gray-300 bg-white text-gray-400'
                )}
              >
                {isCompleted ? (
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  'mt-2 text-xs font-medium text-center',
                  isCompleted && 'text-brand-600',
                  isCurrent && 'text-brand-600',
                  isUpcoming && 'text-gray-400'
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
