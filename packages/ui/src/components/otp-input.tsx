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
    className,
  },
  ref
) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Expose imperative handle
  useImperativeHandle(ref, () => ({
    clear() {
      setValues(Array(length).fill(''));
      inputRefs.current[0]?.focus();
    },
    focus() {
      const idx = values.findIndex((v) => v === '');
      inputRefs.current[idx >= 0 ? idx : 0]?.focus();
    },
  }));

  useEffect(() => {
    if (autoFocus) {
      inputRefs.current[0]?.focus();
    }
  }, [autoFocus]);

  const handleChange = useCallback(
    (index: number, digit: string) => {
      if (!/^\d?$/.test(digit)) return; // only digits

      const next = [...values];
      next[index] = digit;
      setValues(next);

      const code = next.join('');
      onChange?.(code);

      if (digit && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      if (code.length === length && !code.includes('')) {
        onComplete?.(code);
      }
    },
    [values, length, onChange, onComplete]
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        if (values[index]) {
          handleChange(index, '');
        } else if (index > 0) {
          inputRefs.current[index - 1]?.focus();
          handleChange(index - 1, '');
        }
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' && index > 0) {
        inputRefs.current[index - 1]?.focus();
      } else if (e.key === 'ArrowRight' && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [values, handleChange, length]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, length);
      if (!text) return;

      const next = [...values];
      for (let i = 0; i < text.length; i++) {
        next[i] = text[i]!;
      }
      setValues(next);

      const code = next.join('');
      onChange?.(code);

      if (code.length === length) {
        onComplete?.(code);
        inputRefs.current[length - 1]?.focus();
      } else {
        inputRefs.current[text.length]?.focus();
      }
    },
    [values, length, onChange, onComplete]
  );

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={values[i]}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          className={cn(
            'h-12 w-10 rounded-lg border text-center text-lg font-semibold',
            'transition-colors duration-150 outline-none',
            'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30',
            hasError
              ? 'border-red-500 bg-red-50 text-red-900'
              : 'border-gray-300 bg-white text-gray-900',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        />
      ))}
    </div>
  );
});
