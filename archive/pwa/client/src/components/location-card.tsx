'use client';

import { ArrowUpDown } from 'lucide-react';
import type { LocationValue } from '@/components/location-input';
import { LocationInput } from '@/components/location-input';
import type { RefObject } from 'react';

interface LocationCardProps {
  pickup: LocationValue;
  dropoff: LocationValue;
  onPickupChange: (v: LocationValue) => void;
  onDropoffChange: (v: LocationValue) => void;
  onSwap?: () => void;
  dropoffRef?: RefObject<HTMLInputElement>;
  dropoffAutoFocus?: boolean;
  className?: string;
}

export function LocationCard({
  pickup,
  dropoff,
  onPickupChange,
  onDropoffChange,
  onSwap,
  dropoffRef,
  dropoffAutoFocus,
  className = '',
}: LocationCardProps) {
  const handleSwap = () => {
    if (onSwap) {
      onSwap();
    } else {
      const p = { ...pickup };
      const d = { ...dropoff };
      onPickupChange(d);
      onDropoffChange(p);
    }
  };

  return (
    <div className={`location-card relative ${className}`}>
      {/* Pickup row */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center gap-0 flex-shrink-0 self-stretch justify-center">
          <span className="dot-pickup" />
        </div>
        <div className="flex-1 min-w-0">
          <LocationInput
            value={pickup}
            onChange={onPickupChange}
            placeholder="Pickup location"
            showCurrentLocation
          />
        </div>
      </div>

      {/* Connector + swap */}
      <div className="flex items-center gap-3 my-0.5">
        <div className="flex flex-col items-center flex-shrink-0" style={{ width: 12 }}>
          <div className="route-connector" style={{ height: 20, width: 2 }} />
        </div>
        {/* separator line */}
        <div className="flex-1 h-px bg-surface-100" />
        {/* swap button */}
        <button
          type="button"
          onClick={handleSwap}
          className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center
                     text-surface-500 hover:bg-surface-200 transition-colors btn-press"
          aria-label="Swap pickup and dropoff"
        >
          <ArrowUpDown className="w-4 h-4" />
        </button>
      </div>

      {/* Dropoff row */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center flex-shrink-0 self-stretch justify-center">
          <span className="dot-dropoff" />
        </div>
        <div className="flex-1 min-w-0">
          <LocationInput
            value={dropoff}
            onChange={onDropoffChange}
            placeholder="Where to?"
            inputRef={dropoffRef}
            autoFocus={dropoffAutoFocus}
          />
        </div>
      </div>
    </div>
  );
}
