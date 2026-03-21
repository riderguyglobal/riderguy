// ══════════════════════════════════════════════════════════
// ETA Learning Service — Delivery-time-based Correction
//
// Learns from completed deliveries to correct ETA predictions.
// Compares predicted duration (from Mapbox/haversine) against
// actual delivery times, building correction factors per:
// • Zone (Accra traffic ≠ Tamale traffic)
// • Hour of day (rush hour corrections)
// • Day of week (weekday vs weekend patterns)
//
// The correction factor is applied as a multiplier on the
// raw ETA prediction:
//   corrected_eta = raw_eta × correction_factor
//
// Example: If Accra morning deliveries consistently take 1.4x
// the predicted time, the correction factor = 1.4.
//
// This replaces the static `distance / speed` formula with
// a data-driven approach that improves with every delivery.
// ══════════════════════════════════════════════════════════

import { prisma } from '@riderguy/database';

// In-memory cache of correction factors (refreshed periodically)
let factorCache: Map<string, { factor: number; confidence: number }> = new Map();
let lastCacheRefresh = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Build a cache key from zone + time dimensions.
 */
function buildCacheKey(zoneId: string, hourOfDay: number, dayOfWeek: number): string {
  return `${zoneId}:${hourOfDay}:${dayOfWeek}`;
}

/**
 * Refresh the in-memory factor cache from database.
 * Called lazily when cache is stale.
 */
async function refreshCache(): Promise<void> {
  try {
    const factors = await prisma.etaCorrectionFactor.findMany({
      where: { sampleCount: { gte: 5 } }, // Only use factors with enough data
    });

    const newCache = new Map<string, { factor: number; confidence: number }>();
    for (const f of factors) {
      const key = buildCacheKey(f.zoneId, f.hourOfDay, f.dayOfWeek);
      newCache.set(key, {
        factor: f.correctionFactor,
        confidence: f.confidence,
      });
    }

    factorCache = newCache;
    lastCacheRefresh = Date.now();
    console.log(`[EtaLearning] Refreshed ${newCache.size} correction factors`);
  } catch (err) {
    console.warn('[EtaLearning] Failed to refresh cache:', err);
  }
}

/**
 * Get the best correction factor for a given delivery context.
 *
 * Lookup order (most specific → least specific):
 * 1. zone + hour + day  (rush hour in specific zone)
 * 2. zone + hour        (time-of-day in zone)
 * 3. zone               (zone average)
 * 4. hour + day          (global time pattern)
 * 5. hour               (global time-of-day)
 * 6. global             (overall correction)
 * 7. 1.0                (no correction, raw prediction)
 *
 * @param zoneId The delivery zone ID
 * @param timestamp When the delivery starts (for time extraction)
 * @returns Correction multiplier and confidence
 */
export async function getCorrectionFactor(
  zoneId: string | null,
  timestamp: Date = new Date(),
): Promise<{ factor: number; confidence: number }> {
  // Lazy cache refresh
  if (Date.now() - lastCacheRefresh > CACHE_TTL_MS) {
    await refreshCache();
  }

  const zoneKey = zoneId ?? 'GLOBAL';
  const hour = timestamp.getHours();
  const day = timestamp.getDay();

  // Try from most specific to least specific
  const lookupOrder = [
    buildCacheKey(zoneKey, hour, day),
    buildCacheKey(zoneKey, hour, -1),
    buildCacheKey(zoneKey, -1, -1),
    buildCacheKey('GLOBAL', hour, day),
    buildCacheKey('GLOBAL', hour, -1),
    buildCacheKey('GLOBAL', -1, -1),
  ];

  for (const key of lookupOrder) {
    const cached = factorCache.get(key);
    if (cached && cached.confidence >= 0.3) {
      return cached;
    }
  }

  // No learned data — return neutral factor
  return { factor: 1.0, confidence: 0.0 };
}

/**
 * Apply ETA correction to a raw duration prediction.
 *
 * @param rawDurationMinutes Raw ETA from Mapbox or haversine formula
 * @param zoneId Delivery zone
 * @param timestamp Delivery time
 * @returns Corrected duration in minutes
 */
export async function correctEta(
  rawDurationMinutes: number,
  zoneId: string | null,
  timestamp: Date = new Date(),
): Promise<{ correctedMinutes: number; factor: number; confidence: number }> {
  const { factor, confidence } = await getCorrectionFactor(zoneId, timestamp);

  // Blend raw and corrected based on confidence
  // Low confidence → mostly raw, high confidence → mostly corrected
  const blendedFactor = 1.0 + (factor - 1.0) * confidence;
  const correctedMinutes = Math.max(5, Math.round(rawDurationMinutes * blendedFactor));

  return { correctedMinutes, factor: blendedFactor, confidence };
}

/**
 * Learn from a completed delivery by updating correction factors.
 *
 * Called when a delivery transitions to DELIVERED.
 * Compares the original estimated duration against actual time.
 *
 * Uses exponential moving average to update factors:
 *   new_factor = alpha * this_ratio + (1-alpha) * old_factor
 * where alpha = 1 / min(sampleCount, 50) (more weight to recent deliveries)
 *
 * @param orderId The completed order ID
 */
export async function learnFromDelivery(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        estimatedDurationMinutes: true,
        pickedUpAt: true,
        deliveredAt: true,
        zoneId: true,
        createdAt: true,
      },
    });

    if (!order || !order.pickedUpAt || !order.deliveredAt) return;

    const predictedMinutes = order.estimatedDurationMinutes;
    if (!predictedMinutes || predictedMinutes <= 0) return;

    // Actual duration = time from pickup to delivery
    const actualMs = order.deliveredAt.getTime() - order.pickedUpAt.getTime();
    const actualMinutes = actualMs / (1000 * 60);

    // Skip outliers: deliveries that took <2min or >300min aren't representative
    if (actualMinutes < 2 || actualMinutes > 300) return;

    // Correction ratio: how wrong was the prediction?
    const ratio = actualMinutes / predictedMinutes;

    // Skip extreme ratios (data quality issues)
    if (ratio < 0.2 || ratio > 5.0) return;

    const pickupTime = order.pickedUpAt;
    const hour = pickupTime.getHours();
    const day = pickupTime.getDay();
    const zoneId = order.zoneId ?? 'GLOBAL';

    // Update multiple granularity levels
    const updates = [
      // Zone + hour + day (most specific)
      { zoneId, hourOfDay: hour, dayOfWeek: day },
      // Zone + hour
      { zoneId, hourOfDay: hour, dayOfWeek: -1 },
      // Zone only
      { zoneId, hourOfDay: -1, dayOfWeek: -1 },
      // Global + hour
      { zoneId: 'GLOBAL', hourOfDay: hour, dayOfWeek: -1 },
      // Global
      { zoneId: 'GLOBAL', hourOfDay: -1, dayOfWeek: -1 },
    ];

    for (const dims of updates) {
      await upsertCorrectionFactor(dims.zoneId, dims.hourOfDay, dims.dayOfWeek, ratio, actualMinutes, predictedMinutes);
    }

    // Invalidate cache so next lookup gets fresh data
    lastCacheRefresh = 0;
  } catch (err) {
    console.warn('[EtaLearning] Failed to learn from delivery:', err);
  }
}

/**
 * Upsert a single correction factor record.
 * Uses exponential moving average for smooth updates.
 */
async function upsertCorrectionFactor(
  zoneId: string,
  hourOfDay: number,
  dayOfWeek: number,
  newRatio: number,
  actualMinutes: number,
  predictedMinutes: number,
): Promise<void> {
  const existing = await prisma.etaCorrectionFactor.findUnique({
    where: {
      zoneId_hourOfDay_dayOfWeek: {
        zoneId,
        hourOfDay,
        dayOfWeek,
      },
    },
  });

  if (existing) {
    // Exponential moving average: more recent data has more weight
    // but we cap at alpha=0.02 (50 samples) to prevent wild swings
    const alpha = 1 / Math.min(existing.sampleCount + 1, 50);
    const newFactor = alpha * newRatio + (1 - alpha) * existing.correctionFactor;

    // Running stats for standard deviation
    const newAvgPredicted = existing.avgPredictedMinutes
      ? (existing.avgPredictedMinutes * existing.sampleCount + predictedMinutes) / (existing.sampleCount + 1)
      : predictedMinutes;
    const newAvgActual = existing.avgActualMinutes
      ? (existing.avgActualMinutes * existing.sampleCount + actualMinutes) / (existing.sampleCount + 1)
      : actualMinutes;

    // Confidence ramps up with sample count
    // 5 samples = 0.3, 20 = 0.7, 50+ = 0.9+
    const newSampleCount = existing.sampleCount + 1;
    const confidence = Math.min(0.95, 1 - Math.exp(-newSampleCount / 15));

    await prisma.etaCorrectionFactor.update({
      where: { id: existing.id },
      data: {
        correctionFactor: Math.round(newFactor * 1000) / 1000, // 3 decimal places
        sampleCount: newSampleCount,
        avgPredictedMinutes: Math.round(newAvgPredicted * 10) / 10,
        avgActualMinutes: Math.round(newAvgActual * 10) / 10,
        confidence: Math.round(confidence * 100) / 100,
      },
    });
  } else {
    // First sample — create with low confidence
    await prisma.etaCorrectionFactor.create({
      data: {
        zoneId,
        hourOfDay,
        dayOfWeek,
        correctionFactor: newRatio,
        sampleCount: 1,
        avgPredictedMinutes: predictedMinutes,
        avgActualMinutes: actualMinutes,
        confidence: 0.1,
      },
    });
  }
}

/**
 * Get a summary of all learned ETA correction data.
 * Useful for admin dashboard / monitoring.
 */
export async function getEtaLearningSummary(): Promise<{
  totalFactors: number;
  totalSamples: number;
  avgCorrectionFactor: number;
  zoneBreakdown: Array<{
    zoneId: string | null;
    factor: number;
    samples: number;
    confidence: number;
  }>;
}> {
  const factors = await prisma.etaCorrectionFactor.findMany({
    where: { hourOfDay: -1, dayOfWeek: -1 }, // Zone-level only (sentinels for "all")
    orderBy: { sampleCount: 'desc' },
  });

  const totalFactors = factors.length;
  const totalSamples = factors.reduce((sum: number, f) => sum + f.sampleCount, 0);
  const avgCorrectionFactor = totalSamples > 0
    ? factors.reduce((sum: number, f) => sum + f.correctionFactor * f.sampleCount, 0) / totalSamples
    : 1.0;

  return {
    totalFactors,
    totalSamples,
    avgCorrectionFactor: Math.round(avgCorrectionFactor * 1000) / 1000,
    zoneBreakdown: factors.map((f) => ({
      zoneId: f.zoneId === 'GLOBAL' ? null : f.zoneId,
      factor: f.correctionFactor,
      samples: f.sampleCount,
      confidence: f.confidence,
    })),
  };
}
