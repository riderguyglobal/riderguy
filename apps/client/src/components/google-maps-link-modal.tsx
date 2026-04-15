'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Link2,
  MapPin,
  Loader2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { parseGoogleMapsUrl, parseRawCoordinates, isGoogleMapsShortLink } from '@riderguy/utils';
import { useAuth } from '@riderguy/auth';
import { reverseGeocode } from '@/hooks/use-autocomplete';
import type { LocationValue } from './location-input';

interface GoogleMapsLinkModalProps {
  open: boolean;
  onClose: () => void;
  onLocationFound: (value: LocationValue) => void;
}

type Step = 'input' | 'loading' | 'confirm' | 'error';

interface ResolvedLocation {
  address: string;
  coordinates: [number, number]; // [lng, lat]
  name?: string;
  plusCode?: string;
}

export function GoogleMapsLinkModal({
  open,
  onClose,
  onLocationFound,
}: GoogleMapsLinkModalProps) {
  const { api } = useAuth();
  const [step, setStep] = useState<Step>('input');
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [resolved, setResolved] = useState<ResolvedLocation | null>(null);

  // Android back button trap — close modal instead of navigating away
  useEffect(() => {
    if (!open) return;
    let pushed = true;
    history.pushState({ __backTrap: true }, '');
    const handlePop = () => { pushed = false; onClose(); };
    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
      if (pushed) history.back();
    };
  }, [open, onClose]);

  if (!open) return null;

  const reset = () => {
    setStep('input');
    setLink('');
    setError('');
    setResolved(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePasteLink = async () => {
    const trimmed = link.trim();
    if (!trimmed) {
      setError('Please paste a Google Maps link or coordinates');
      return;
    }

    setStep('loading');
    setError('');

    try {
      // Try parsing as a Google Maps URL
      let parsed = parseGoogleMapsUrl(trimmed);

      // Also try raw coordinates if URL parse failed
      if (!parsed) {
        parsed = parseRawCoordinates(trimmed);
      }

      // If still no result and it's a short link, resolve via API
      if (!parsed && isGoogleMapsShortLink(trimmed) && api) {
        try {
          const { data: resolveResult } = await api.post('/places/resolve-link', { url: trimmed });
          if (resolveResult?.success && resolveResult?.data) {
            parsed = {
              latitude: resolveResult.data.latitude,
              longitude: resolveResult.data.longitude,
              placeName: resolveResult.data.placeName,
              rawUrl: trimmed,
            };
          }
        } catch {
          console.warn('[GoogleMapsLink] Short link resolution failed');
        }
      }

      if (!parsed) {
        setStep('error');
        setError(
          'Could not find coordinates in the link. Try opening the location in Google Maps, ' +
          'tap "Share" and copy the link.',
        );
        return;
      }

      const { latitude, longitude, placeName } = parsed;

      // Reverse geocode to get a proper address
      const geo = await reverseGeocode(latitude, longitude);

      const displayAddress = geo.plusCode
        ? `${geo.address} (${geo.plusCode.display})`
        : geo.address;

      setResolved({
        address: placeName || displayAddress,
        coordinates: [longitude, latitude],
        name: placeName,
        plusCode: geo.plusCode?.display,
      });

      // Save to community places database
      try {
        if (api) {
          await api.post('/places/from-link', {
            googleMapsUrl: trimmed,
            name: placeName || undefined,
          });
        }
      } catch {
        // Don't block the user if saving fails
        console.warn('[GoogleMapsLink] Failed to save community place');
      }

      setStep('confirm');
    } catch {
      setStep('error');
      setError('Something went wrong. Please try again.');
    }
  };

  const handleConfirm = () => {
    if (resolved) {
      onLocationFound({
        address: resolved.address,
        coordinates: resolved.coordinates,
      });
      handleClose();
    }
  };

  const openGoogleMaps = () => {
    // Use location.href in standalone PWA to avoid breaking out of the app shell
    if (window.matchMedia('(display-mode: standalone)').matches) {
      window.location.href = 'https://maps.google.com';
    } else {
      window.open('https://maps.google.com', '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slide-up max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-100">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-brand-50 flex items-center justify-center">
              <Link2 className="h-4.5 w-4.5 text-brand-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-surface-900">
                Find via Google Maps
              </h3>
              <p className="text-xs text-surface-400">
                Search on Google Maps, then paste the link
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-surface-100 transition-colors"
          >
            <X className="h-4 w-4 text-surface-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Step 1: Input */}
          {step === 'input' && (
            <div className="space-y-4">
              {/* Instructions */}
              <div className="bg-brand-50 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-medium text-brand-900">How it works:</p>
                <ol className="space-y-2 text-sm text-brand-700">
                  <li className="flex gap-2">
                    <span className="font-semibold text-brand-600 shrink-0">1.</span>
                    <span>Open Google Maps and search for the location</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-brand-600 shrink-0">2.</span>
                    <span>Tap the location, then tap <strong>Share</strong> and copy the link</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-brand-600 shrink-0">3.</span>
                    <span>Paste the link below — we&apos;ll grab the exact location</span>
                  </li>
                </ol>
              </div>

              {/* Open Google Maps button */}
              <button
                type="button"
                onClick={openGoogleMaps}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-surface-50 border border-surface-200 rounded-xl text-sm font-medium text-surface-700 hover:bg-surface-100 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Open Google Maps
              </button>

              {/* Link input */}
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1.5">
                  Paste Google Maps link or coordinates
                </label>
                <textarea
                  value={link}
                  onChange={(e) => {
                    setLink(e.target.value);
                    setError('');
                  }}
                  placeholder="https://maps.google.com/... or 5.6037, -0.1870"
                  rows={3}
                  className="w-full px-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none transition-all"
                  autoFocus
                />
                {error && (
                  <p className="text-xs text-red-500 mt-1.5 flex items-start gap-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    {error}
                  </p>
                )}
              </div>

              {/* Submit button */}
              <button
                type="button"
                onClick={handlePasteLink}
                disabled={!link.trim()}
                className="w-full py-3.5 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors btn-press"
              >
                Find Location
              </button>
            </div>
          )}

          {/* Step 2: Loading */}
          {step === 'loading' && (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="h-8 w-8 text-brand-500 animate-spin mx-auto" />
              <p className="text-sm text-surface-500">Extracting location...</p>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && resolved && (
            <div className="space-y-4">
              <div className="bg-accent-50 rounded-2xl p-4 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-accent-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-accent-900">Location found!</p>
                  <p className="text-sm text-accent-700 mt-1">{resolved.address}</p>
                  {resolved.plusCode && (
                    <p className="text-xs text-accent-500 mt-0.5">
                      Plus Code: {resolved.plusCode}
                    </p>
                  )}
                </div>
              </div>

              <p className="text-xs text-surface-400 text-center">
                This location will be saved to help other users find it in the future.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { reset(); }}
                  className="flex-1 py-3 border border-surface-200 rounded-xl text-sm font-medium text-surface-600 hover:bg-surface-50 transition-colors"
                >
                  Try Different Link
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors btn-press"
                >
                  Use This Location
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Error */}
          {step === 'error' && (
            <div className="space-y-4">
              <div className="bg-red-50 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-900">
                    Couldn&apos;t extract location
                  </p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>

              <div className="bg-surface-50 rounded-2xl p-4 space-y-2">
                <p className="text-xs font-medium text-surface-600">Tips:</p>
                <ul className="text-xs text-surface-500 space-y-1.5">
                  <li className="flex gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-surface-400" />
                    Make sure you tap on the exact spot in Google Maps
                  </li>
                  <li className="flex gap-1.5">
                    <Link2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-surface-400" />
                    Use the &quot;Share&quot; button to copy the full link
                  </li>
                  <li className="flex gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-surface-400" />
                    You can also paste coordinates like &quot;5.6037, -0.1870&quot;
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={reset}
                className="w-full py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors btn-press"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
