// ══════════════════════════════════════════════════════════
// Location Popularity Service — Usage-based Learning
//
// Tracks which locations users actually select from autocomplete
// results, and uses that data to boost popular locations in
// future searches. This is the "learning" layer that makes the
// system smarter over time.
//
// How it works:
// 1. When a user selects a location from autocomplete, we record
//    the (normalizedQuery → selectedPlace) pair.
// 2. When a new autocomplete runs, we check popularity data
//    for the query and boost matching places.
// 3. More selections = higher boost (logarithmic scaling).
//
// This provides:
// • Popular places rank higher ("Accra Mall" beats obscure matches)
// • Regional patterns emerge (Tamale users get Tamale-relevant results)
// • Organic learning without any ML pipeline
// ══════════════════════════════════════════════════════════

import { prisma } from '@riderguy/database';
import { normalizeAddress } from '../lib/fuzzy-search';

/**
 * Record a location selection from autocomplete.
 * Called when a user picks a suggestion.
 * Uses upsert to increment count for existing pairs.
 */
export async function recordLocationSelection(
  searchQuery: string,
  selectedName: string,
  latitude: number,
  longitude: number,
  source: string,
  region?: string,
): Promise<void> {
  try {
    const normalizedQuery = normalizeAddress(searchQuery);
    const normalizedName = normalizeAddress(selectedName);

    // Skip very short queries (meaningless)
    if (normalizedQuery.length < 2) return;

    await prisma.locationPopularity.upsert({
      where: {
        searchQuery_selectedName: {
          searchQuery: normalizedQuery,
          selectedName: normalizedName,
        },
      },
      create: {
        searchQuery: normalizedQuery,
        selectedName: normalizedName,
        latitude,
        longitude,
        source,
        region,
        selectionCount: 1,
        lastSelectedAt: new Date(),
      },
      update: {
        selectionCount: { increment: 1 },
        lastSelectedAt: new Date(),
        // Update coordinates if they differ (user might have refined)
        latitude,
        longitude,
      },
    });
  } catch (err) {
    // Non-critical — don't break the flow if popularity tracking fails
    console.warn('[PopularityService] Failed to record selection:', err);
  }
}

/**
 * Get popularity boosts for a search query.
 * Returns a map of normalizedPlaceName → boost score.
 *
 * Boost formula: log2(selectionCount + 1) * recencyFactor
 * - Selection count gives logarithmic scaling (diminishing returns)
 * - Recency factor decays over time (last 30 days = full boost)
 *
 * @param query The search query to find popularity data for
 * @param limit Max entries to check
 */
export async function getPopularityBoosts(
  query: string,
  limit = 20,
): Promise<Map<string, number>> {
  const boosts = new Map<string, number>();

  try {
    const normalizedQuery = normalizeAddress(query);
    if (normalizedQuery.length < 2) return boosts;

    // Find exact query matches AND prefix matches
    const records = await prisma.locationPopularity.findMany({
      where: {
        OR: [
          { searchQuery: normalizedQuery },
          { searchQuery: { startsWith: normalizedQuery } },
        ],
      },
      orderBy: { selectionCount: 'desc' },
      take: limit,
    });

    const now = Date.now();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    for (const record of records) {
      // Logarithmic scaling: 1 selection = 1.0, 10 = 3.5, 100 = 6.7
      const countFactor = Math.log2(record.selectionCount + 1);

      // Recency decay: full boost within 30 days, halves every 30 days after
      const age = now - record.lastSelectedAt.getTime();
      const recencyFactor = age < THIRTY_DAYS_MS
        ? 1.0
        : Math.pow(0.5, age / THIRTY_DAYS_MS);

      // Exact query match gets full boost, prefix match gets 60%
      const matchFactor = record.searchQuery === normalizedQuery ? 1.0 : 0.6;

      const boost = countFactor * recencyFactor * matchFactor;

      // Store using normalized name as key
      const existing = boosts.get(record.selectedName) ?? 0;
      boosts.set(record.selectedName, Math.max(existing, boost));
    }
  } catch (err) {
    console.warn('[PopularityService] Failed to get boosts:', err);
  }

  return boosts;
}

/**
 * Get globally popular locations (most selected overall).
 * Useful for "trending" or default suggestions.
 *
 * @param limit Max results
 * @param region Optional region filter
 */
export async function getGloballyPopular(
  limit = 10,
  region?: string,
): Promise<Array<{ name: string; lat: number; lng: number; count: number }>> {
  try {
    const where = region ? { region } : {};

    const records = await prisma.locationPopularity.findMany({
      where,
      orderBy: { selectionCount: 'desc' },
      take: limit,
      distinct: ['selectedName'],
    });

    return records.map((r) => ({
      name: r.selectedName,
      lat: r.latitude,
      lng: r.longitude,
      count: r.selectionCount,
    }));
  } catch (err) {
    console.warn('[PopularityService] Failed to get popular locations:', err);
    return [];
  }
}
