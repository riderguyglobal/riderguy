'use client';

import { useRef, useEffect, useState } from 'react';
import {
  MapPin,
  X,
  Loader2,
  Check,
  Crosshair,
  Search,
  Navigation,
} from 'lucide-react';
import {
  useMapboxAutocomplete,
  reverseGeocode,
  splitPlaceName,
  type MapboxFeature,
} from '@/hooks/use-mapbox-autocomplete';

export interface LocationValue {
  address: string;
  coordinates: [number, number] | null; // [lng, lat]
}

interface LocationInputProps {
  /** Current location value */
  value: LocationValue;
  /** Called when user selects a place or clears */
  onChange: (value: LocationValue) => void;
  /** Input placeholder */
  placeholder?: string;
  /** Show "Use current location" button */
  showCurrentLocation?: boolean;
  /** Auto-focus input on mount */
  autoFocus?: boolean;
  /** Ref to the input element (for external focus control) */
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /** Additional class on the root wrapper */
  className?: string;
  /** Brand color accent for the dot indicator */
  accentColor?: 'brand' | 'dark';
}

export function LocationInput({
  value,
  onChange,
  placeholder = 'Search location',
  showCurrentLocation = true,
  autoFocus = false,
  inputRef: externalRef,
  className = '',
  accentColor = 'dark',
}: LocationInputProps) {
  const ac = useMapboxAutocomplete();
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = externalRef || internalRef;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [locating, setLocating] = useState(false);

  // Sync external value changes into the autocomplete query
  useEffect(() => {
    if (value.address && value.coordinates) {
      ac.setQuery(value.address);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        ac.setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ac]);

  const handleInputChange = (text: string) => {
    ac.onChange(text);
    // If user edits after selecting, clear coordinates
    if (value.coordinates) {
      onChange({ address: text, coordinates: null });
    }
  };

  const selectPlace = (feature: MapboxFeature) => {
    onChange({ address: feature.place_name, coordinates: feature.center });
    ac.setQuery(feature.place_name);
    ac.setOpen(false);
  };

  const handleClear = () => {
    ac.clear();
    onChange({ address: '', coordinates: null });
    inputRef.current?.focus();
  };

  const handleCurrentLocation = async () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const [lng, lat] = [pos.coords.longitude, pos.coords.latitude];
        const name = await reverseGeocode(lat, lng);
        onChange({ address: name, coordinates: [lng, lat] });
        ac.setQuery(name);
        ac.setOpen(false);
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const hasSelection = !!value.coordinates;

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 pointer-events-none" />
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={ac.query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (ac.query.length >= 2 && !hasSelection) ac.setOpen(true);
            }}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="w-full h-12 pl-10 pr-9 bg-surface-50 border border-surface-200 rounded-xl text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
          />

          {/* Right icon: checkmark / spinner / clear */}
          {hasSelection && (
            <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent-500" />
          )}
          {ac.loading && !hasSelection && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 animate-spin" />
          )}
          {ac.query && !hasSelection && !ac.loading && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-surface-400" />
            </button>
          )}
        </div>

        {/* Current location button */}
        {showCurrentLocation && (
          <button
            type="button"
            onClick={handleCurrentLocation}
            disabled={locating}
            className="h-12 w-12 shrink-0 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center hover:bg-brand-100 transition-colors btn-press disabled:opacity-50"
            title="Use current location"
          >
            {locating ? (
              <Loader2 className="h-4 w-4 text-brand-500 animate-spin" />
            ) : (
              <Crosshair className="h-4 w-4 text-brand-500" />
            )}
          </button>
        )}
      </div>

      {/* ── Suggestions dropdown ── */}
      {ac.open && ac.results.length > 0 && (
        <div className="absolute top-full left-0 right-12 mt-1.5 bg-white rounded-2xl border border-surface-200 shadow-xl z-30 max-h-72 overflow-y-auto animate-slide-up">
          {ac.results.map((feature) => {
            const { primary, secondary } = splitPlaceName(feature.place_name);
            const typeIcon = getPlaceTypeIcon(feature.place_type?.[0]);
            return (
              <button
                key={feature.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectPlace(feature)}
                className="w-full flex items-start gap-3 py-3 px-3.5 hover:bg-surface-50 active:bg-surface-100 transition-colors text-left first:rounded-t-2xl last:rounded-b-2xl border-b border-surface-100 last:border-0"
              >
                <div className="h-9 w-9 rounded-xl bg-surface-100 flex items-center justify-center shrink-0 mt-0.5">
                  {typeIcon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-900 truncate">
                    {primary}
                  </p>
                  {secondary && (
                    <p className="text-xs text-surface-400 truncate mt-0.5">
                      {secondary}
                    </p>
                  )}
                </div>
              </button>
            );
          })}

          {/* Mapbox attribution (required by TOS) */}
          <div className="py-1.5 px-3.5 text-center border-t border-surface-100">
            <span className="text-[9px] text-surface-300">Powered by Mapbox</span>
          </div>
        </div>
      )}

      {/* Empty state when typing but no results */}
      {ac.open && ac.query.length >= 2 && !ac.loading && ac.results.length === 0 && (
        <div className="absolute top-full left-0 right-12 mt-1.5 bg-white rounded-2xl border border-surface-200 shadow-xl z-30 py-6 px-4 text-center animate-slide-up">
          <MapPin className="h-5 w-5 text-surface-300 mx-auto mb-2" />
          <p className="text-sm text-surface-400">No locations found</p>
          <p className="text-xs text-surface-300 mt-1">Try a different search term</p>
        </div>
      )}
    </div>
  );
}

/** Return a contextual icon based on Mapbox place type */
function getPlaceTypeIcon(type?: string) {
  switch (type) {
    case 'poi':
      return <Navigation className="h-4 w-4 text-brand-500" />;
    case 'address':
      return <MapPin className="h-4 w-4 text-surface-500" />;
    case 'neighborhood':
    case 'locality':
      return <MapPin className="h-4 w-4 text-accent-500" />;
    default:
      return <MapPin className="h-4 w-4 text-surface-500" />;
  }
}

export default LocationInput;
