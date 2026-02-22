'use client';

import React, { forwardRef, useState } from 'react';
import { cn } from '../lib/utils';

// ============================================================
// PhoneInput — phone number input with country code selector
//
// Simple version focused on Ghana (+233) as default, with
// the ability to extend to other countries as needed.
// ============================================================

export interface CountryCode {
  code: string; // e.g. 'NG'
  dialCode: string; // e.g. '+234'
  name: string;
  flag: string; // emoji flag
}

const DEFAULT_COUNTRIES: CountryCode[] = [
  { code: 'GH', dialCode: '+233', name: 'Ghana', flag: '🇬🇭' },
  { code: 'NG', dialCode: '+234', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'KE', dialCode: '+254', name: 'Kenya', flag: '🇰🇪' },
  { code: 'ZA', dialCode: '+27', name: 'South Africa', flag: '🇿🇦' },
  { code: 'GB', dialCode: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'US', dialCode: '+1', name: 'United States', flag: '🇺🇸' },
];

export interface PhoneInputProps {
  /** Full phone number value (includes dial code) */
  value?: string;
  /** Called when the phone number changes (includes dial code) */
  onValueChange?: (fullNumber: string) => void;
  /** List of countries to show (default: common African + intl) */
  countries?: CountryCode[];
  /** Default selected country code (default: 'GH') */
  defaultCountry?: string;
  /** Placeholder for the local number */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Error state */
  hasError?: boolean;
  /** Additional className */
  className?: string;
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  {
    value,
    onValueChange,
    countries = DEFAULT_COUNTRIES,
    defaultCountry = 'GH',
    placeholder = '800 000 0000',
    disabled = false,
    hasError = false,
    className,
  },
  ref
) {
  const defaultEntry = countries.find((c) => c.code === defaultCountry) ?? countries[0];
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(
    defaultEntry!
  );
  const [showDropdown, setShowDropdown] = useState(false);

  // Extract the local part from the full number
  const localNumber = value?.startsWith(selectedCountry.dialCode)
    ? value.slice(selectedCountry.dialCode.length)
    : value ?? '';

  function handleLocalChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^\d]/g, '');
    onValueChange?.(`${selectedCountry.dialCode}${raw}`);
  }

  function handleCountrySelect(country: CountryCode) {
    setSelectedCountry(country);
    setShowDropdown(false);
    // Re-emit with new dial code
    const raw = localNumber.replace(/[^\d]/g, '');
    onValueChange?.(`${country.dialCode}${raw}`);
  }

  return (
    <div className={cn('relative flex', className)}>
      {/* Country selector */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setShowDropdown((p) => !p)}
        className={cn(
          'flex items-center gap-1 rounded-l-lg border border-r-0 px-3 py-2 text-sm',
          'bg-gray-50 hover:bg-gray-100 transition-colors',
          hasError ? 'border-red-500' : 'border-gray-300',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <span className="text-base">{selectedCountry.flag}</span>
        <span className="font-medium text-gray-700">{selectedCountry.dialCode}</span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4 text-gray-400"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Phone number input */}
      <input
        ref={ref}
        type="tel"
        inputMode="numeric"
        value={localNumber}
        onChange={handleLocalChange}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'flex-1 rounded-r-lg border px-3 py-2 text-sm outline-none',
          'transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30',
          hasError
            ? 'border-red-500 bg-red-50 text-red-900'
            : 'border-gray-300 bg-white text-gray-900',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      />

      {/* Country dropdown */}
      {showDropdown && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {countries.map((country) => (
            <button
              key={country.code}
              type="button"
              onClick={() => handleCountrySelect(country)}
              className={cn(
                'flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50',
                country.code === selectedCountry.code && 'bg-brand-50 text-brand-600'
              )}
            >
              <span className="text-base">{country.flag}</span>
              <span className="flex-1">{country.name}</span>
              <span className="text-gray-400">{country.dialCode}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
