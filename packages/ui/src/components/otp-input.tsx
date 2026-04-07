'use client';

import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type ClipboardEvent,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { cn } from '../lib/utils';

// ============================================================
// OTP Input — 6-digit code entry (individual boxes)
// iOS Safari compatible: pattern, setTimeout focus, visibility-aware
// ============================================================

export interface OtpInputProps {
  /** Number of digits (default: 6) */
  length?: number;
  /** Called when all digits are entered */
  onComplete?: (code: string) => void;
  /** Called on every change */
  onChange?: (code: string) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Error state styling */
  hasError?: boolean;
  /** Auto-focus the first input on mount */
  autoFocus?: boolean;
  /** Visual variant: 'dark' (default) for dark backgrounds, 'light' for light backgrounds */
  variant?: 'dark' | 'light';
  /** Additional className for the wrapper */
  className?: string;
}

export interface OtpInputHandle {
  /** Clear all digits and focus the first input */
  clear: () => void;
  /** Focus the first empty input */
  focus: () => void;
}

export const OtpInput = forwardRef<OtpInputHandle, OtpInputProps>(function OtpInput(
  {
    length = 6,
    onComplete,
    onChange,
    disabled = false,
    hasError = false,
    autoFocus = true,
    variant = 'dark',
    className,
  },
  ref
) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const hiddenRef = useRef<HTMLInputElement | null>(null);

  // iOS-safe focus helper — uses setTimeout to avoid keyboard dismissal on Safari
  const safeFocus = useCallback((el: HTMLInputElement | null | undefined) => {
    if (!el) return;
    setTimeout(() => el.focus(), 0);
  }, []);

  // Expose imperative handle
  useImperativeHandle(ref, () => ({
    clear() {
      setValues(Array(length).fill(''));
      // Don't auto-focus after clear — let user tap (iOS ignores programmatic focus outside gestures)
    },
    focus() {
      const idx = values.findIndex((v) => v === '');
      safeFocus(inputRefs.current[idx >= 0 ? idx : 0]);
    },
  }));

  useEffect(() => {
    if (autoFocus) {
      // Use requestAnimationFrame for best-effort autofocus; iOS may still block this
      requestAnimationFrame(() => {
        inputRefs.current[0]?.focus();
      });
    }
  }, [autoFocus]);

  // Web OTP API — auto-read SMS code on supported browsers (Android Chrome)
  useEffect(() => {
    if (typeof window === 'undefined' || !('OTPCredential' in window)) return;

    const ac = new AbortController();

    (navigator.credentials as any)
      .get({ otp: { transport: ['sms'] }, signal: ac.signal })
      .then((otp: any) => {
        if (otp?.code) {
          const digits = otp.code.replace(/\D/g, '').slice(0, length);
          if (digits.length === length) {
            const next = digits.split('');
            setValues(next);
            onChange?.(digits);
            onComplete?.(digits);
          }
        }
      })
      .catch(() => {
        // User dismissed or API unavailable — ignore
      });

    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = useCallback(
    (index: number, digit: string) => {
      // Handle multi-character input (mobile paste that bypasses onPaste)
      const cleaned = digit.replace(/\D/g, '');
      if (cleaned.length > 1) {
        const next = [...values];
        for (let i = 0; i < cleaned.length && index + i < length; i++) {
          next[index + i] = cleaned[i]!;
        }
        setValues(next);
        const code = next.join('');
        onChange?.(code);
        const focusIdx = Math.min(index + cleaned.length, length - 1);
        safeFocus(inputRefs.current[focusIdx]);
        if (code.length === length && !next.includes('')) {
          onComplete?.(code);
        }
        return;
      }

      if (!/^\d?$/.test(cleaned)) return; // only digits

      const next = [...values];
      next[index] = cleaned;
      setValues(next);

      const code = next.join('');
      onChange?.(code);

      // Auto-advance: use setTimeout to prevent iOS keyboard flickering
      if (cleaned && index < length - 1) {
        safeFocus(inputRefs.current[index + 1]);
      }

      if (code.length === length && !next.includes('')) {
        onComplete?.(code);
      }
    },
    [values, length, onChange, onComplete, safeFocus]
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        if (values[index]) {
          handleChange(index, '');
        } else if (index > 0) {
          safeFocus(inputRefs.current[index - 1]);
          handleChange(index - 1, '');
        }
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' && index > 0) {
        safeFocus(inputRefs.current[index - 1]);
      } else if (e.key === 'ArrowRight' && index < length - 1) {
        safeFocus(inputRefs.current[index + 1]);
      }
    },
    [values, handleChange, length, safeFocus]
  );

  const handlePaste = useCallback(
    (index: number, e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, length - index);
      if (!text) return;

      const next = [...values];
      for (let i = 0; i < text.length; i++) {
        next[index + i] = text[i]!;
      }
      setValues(next);

      const code = next.join('');
      onChange?.(code);

      if (code.length === length && !next.includes('')) {
        onComplete?.(code);
      } else {
        safeFocus(inputRefs.current[Math.min(index + text.length, length - 1)]);
      }
    },
    [values, length, onChange, onComplete, safeFocus]
  );

  return (
    <div className={cn('flex items-center justify-center gap-2 sm:gap-3', className)}>
      {/* Hidden input for iOS Safari OTP autofill — iOS 17+ requires the input to be
          visually present (not opacity-0 or pointer-events-none) for autocomplete="one-time-code"
          to trigger the SMS code suggestion. We position it with sr-only so it is accessible
          and detectable by iOS but not visually intrusive. */}
      <input
        ref={hiddenRef}
        type="text"
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="[0-9]*"
        className="sr-only"
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}
        tabIndex={-1}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, length);
          if (digits.length === length) {
            const next = digits.split('');
            setValues(next);
            onChange?.(digits);
            onComplete?.(digits);
          }
        }}
      />
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={values[i]}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => { if (e.target.value) e.target.select(); }}
          className={cn(
            'h-12 w-10 sm:h-14 sm:w-12 rounded-xl border text-center text-lg font-bold',
            'transition-all duration-200 outline-none',
            'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:scale-105',
            hasError
              ? variant === 'dark'
                ? 'border-red-500/50 bg-red-500/10 text-red-300'
                : 'border-red-500 bg-red-50 text-red-900'
              : variant === 'dark'
                ? 'border-white/[0.12] bg-white/[0.06] text-white'
                : 'border-surface-200 bg-surface-50 text-surface-900',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        />
      ))}
    </div>
  );
});
