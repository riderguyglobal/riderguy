// ══════════════════════════════════════════════════════════
// Google Maps Loader — Singleton loader for all Google Maps
// APIs (Maps JS, Places, Geocoder, etc.)
//
// Ensures the Google Maps JS API is loaded only ONCE across
// the entire app, even when multiple components need it
// (map display, autocomplete, reverse geocoding).
// ══════════════════════════════════════════════════════════

import { GOOGLE_MAPS_API_KEY } from '@/lib/constants';

let loaderPromise: Promise<void> | null = null;

/**
 * Load the Google Maps JS API with all required libraries.
 * Returns immediately if already loaded. Safe to call multiple times.
 */
export async function loadGoogleMaps(): Promise<void> {
  // Already loaded
  if (typeof google !== 'undefined' && google.maps?.places) return;

  if (!loaderPromise) {
    loaderPromise = (async () => {
      const { Loader } = await import('@googlemaps/js-api-loader');
      const loader = new Loader({
        apiKey: GOOGLE_MAPS_API_KEY,
        version: 'weekly',
        libraries: ['marker', 'geometry', 'places'],
      });
      await loader.load();
    })();
  }

  return loaderPromise;
}

/**
 * Get a Google Maps Geocoder instance.
 * Loads the API if not already loaded.
 */
export async function getGeocoder(): Promise<google.maps.Geocoder> {
  await loadGoogleMaps();
  return new google.maps.Geocoder();
}

/**
 * Reverse geocode coordinates to a human-readable street address
 * using the Google Maps Geocoder (client-side).
 *
 * Never returns raw coordinates. Returns a descriptive fallback
 * if the geocoder fails.
 */
export async function reverseGeocodeWithGoogle(
  lat: number,
  lng: number,
): Promise<{ address: string; plusCode?: string }> {
  try {
    const geocoder = await getGeocoder();
    const response = await geocoder.geocode({
      location: { lat, lng },
    });

    if (response.results && response.results.length > 0) {
      // Find the most specific result (street_address > route > neighborhood > locality)
      const preferred = response.results.find(
        (r) =>
          r.types.includes('street_address') ||
          r.types.includes('premise') ||
          r.types.includes('subpremise'),
      ) ?? response.results.find(
        (r) => r.types.includes('route') || r.types.includes('intersection'),
      ) ?? response.results[0];

      const address = preferred!.formatted_address;

      // Extract Plus Code if available
      const plusCodeResult = response.results.find((r) =>
        r.types.includes('plus_code'),
      );
      const plusCode = plusCodeResult?.formatted_address
        ? plusCodeResult.formatted_address.split(' ')[0]
        : undefined;

      return { address, plusCode };
    }

    return { address: 'Unknown location. Please search for the address.' };
  } catch {
    return { address: 'Unable to find address. Please search for the address.' };
  }
}
