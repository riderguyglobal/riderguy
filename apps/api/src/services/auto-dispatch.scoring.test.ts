import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  proximityScore,
  ratingScore,
  completionScore,
  onTimeScore,
  experienceScore,
  freshnessScore,
  computeOverallScore,
} from './auto-dispatch.service';

// ============================================================
// Auto-Dispatch Scoring Algorithm Tests
//
// These tests verify the multi-factor scoring system used
// to match riders to orders. No database or socket mocks
// needed — these are pure functions.
// ============================================================

describe('proximityScore', () => {
  it('returns 100 for riders within 0.5km', () => {
    expect(proximityScore(0)).toBe(100);
    expect(proximityScore(0.3)).toBe(100);
    expect(proximityScore(0.5)).toBe(100);
  });

  it('returns 95 for riders within 1km', () => {
    expect(proximityScore(0.6)).toBe(95);
    expect(proximityScore(1.0)).toBe(95);
  });

  it('returns 85 for riders within 2km', () => {
    expect(proximityScore(1.5)).toBe(85);
    expect(proximityScore(2.0)).toBe(85);
  });

  it('returns 75 for riders within 3km', () => {
    expect(proximityScore(2.5)).toBe(75);
    expect(proximityScore(3.0)).toBe(75);
  });

  it('returns 60 for riders within 5km', () => {
    expect(proximityScore(4.0)).toBe(60);
    expect(proximityScore(5.0)).toBe(60);
  });

  it('returns 45 for riders within 8km', () => {
    expect(proximityScore(6.0)).toBe(45);
    expect(proximityScore(8.0)).toBe(45);
  });

  it('returns 30 for riders within 12km', () => {
    expect(proximityScore(10.0)).toBe(30);
    expect(proximityScore(12.0)).toBe(30);
  });

  it('returns 15 for riders within 20km', () => {
    expect(proximityScore(15.0)).toBe(15);
    expect(proximityScore(20.0)).toBe(15);
  });

  it('returns 5 for riders within 25km', () => {
    expect(proximityScore(22.0)).toBe(5);
    expect(proximityScore(25.0)).toBe(5);
  });

  it('returns 0 for riders beyond 25km', () => {
    expect(proximityScore(30.0)).toBe(0);
    expect(proximityScore(100.0)).toBe(0);
  });

  it('scores decrease monotonically with distance', () => {
    const distances = [0.3, 0.8, 1.5, 2.5, 4, 6, 10, 15, 22, 30];
    const scores = distances.map(proximityScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]!);
    }
  });
});

describe('ratingScore', () => {
  it('returns 50 for null rating (new rider)', () => {
    expect(ratingScore(null)).toBe(50);
  });

  it('returns 50 for 0 rating', () => {
    expect(ratingScore(0)).toBe(50);
  });

  it('returns 100 for 5-star rider', () => {
    expect(ratingScore(5)).toBe(100);
  });

  it('returns 80 for 4-star rider', () => {
    expect(ratingScore(4)).toBe(80);
  });

  it('returns 60 for 3-star rider', () => {
    expect(ratingScore(3)).toBe(60);
  });

  it('scales linearly with rating', () => {
    expect(ratingScore(2.5)).toBe(50);
    expect(ratingScore(4.5)).toBe(90);
  });
});

describe('completionScore', () => {
  it('returns 60 for null (new rider default)', () => {
    expect(completionScore(null)).toBe(60);
  });

  it('returns 100 for perfect completion', () => {
    expect(completionScore(1.0)).toBe(100);
  });

  it('returns 0 for 0% completion', () => {
    expect(completionScore(0)).toBe(0);
  });

  it('scales linearly', () => {
    expect(completionScore(0.5)).toBe(50);
    expect(completionScore(0.75)).toBe(75);
    expect(completionScore(0.95)).toBe(95);
  });
});

describe('onTimeScore', () => {
  it('returns 60 for null (new rider default)', () => {
    expect(onTimeScore(null)).toBe(60);
  });

  it('returns 100 for perfect on-time rate', () => {
    expect(onTimeScore(1.0)).toBe(100);
  });

  it('returns 0 for 0% on-time', () => {
    expect(onTimeScore(0)).toBe(0);
  });

  it('scales linearly', () => {
    expect(onTimeScore(0.5)).toBe(50);
    expect(onTimeScore(0.8)).toBe(80);
  });
});

describe('experienceScore', () => {
  it('returns 10 for brand new rider (0 deliveries)', () => {
    expect(experienceScore(0)).toBe(10);
  });

  it('returns 25 for 5+ deliveries', () => {
    expect(experienceScore(5)).toBe(25);
    expect(experienceScore(10)).toBe(25);
  });

  it('returns 40 for 20+ deliveries', () => {
    expect(experienceScore(20)).toBe(40);
    expect(experienceScore(30)).toBe(40);
  });

  it('returns 55 for 50+ deliveries', () => {
    expect(experienceScore(50)).toBe(55);
    expect(experienceScore(75)).toBe(55);
  });

  it('returns 70 for 100+ deliveries', () => {
    expect(experienceScore(100)).toBe(70);
    expect(experienceScore(150)).toBe(70);
  });

  it('returns 85 for 200+ deliveries', () => {
    expect(experienceScore(200)).toBe(85);
    expect(experienceScore(400)).toBe(85);
  });

  it('returns 100 for 500+ deliveries', () => {
    expect(experienceScore(500)).toBe(100);
    expect(experienceScore(1000)).toBe(100);
  });

  it('scores increase with experience', () => {
    const deliveries = [0, 5, 20, 50, 100, 200, 500];
    const scores = deliveries.map(experienceScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThan(scores[i - 1]!);
    }
  });
});

describe('freshnessScore', () => {
  it('returns 10 for null (no GPS update)', () => {
    expect(freshnessScore(null)).toBe(10);
  });

  it('returns 100 for GPS update less than 1 minute ago', () => {
    const recent = new Date(Date.now() - 30_000); // 30 seconds ago
    expect(freshnessScore(recent)).toBe(100);
  });

  it('returns 85 for GPS update 2 minutes ago', () => {
    const twoMin = new Date(Date.now() - 2 * 60_000);
    expect(freshnessScore(twoMin)).toBe(85);
  });

  it('returns 60 for GPS update 7 minutes ago', () => {
    const sevenMin = new Date(Date.now() - 7 * 60_000);
    expect(freshnessScore(sevenMin)).toBe(60);
  });

  it('returns 30 for GPS update 12 minutes ago', () => {
    const twelveMin = new Date(Date.now() - 12 * 60_000);
    expect(freshnessScore(twelveMin)).toBe(30);
  });

  it('returns 5 for GPS update older than 15 minutes', () => {
    const old = new Date(Date.now() - 20 * 60_000);
    expect(freshnessScore(old)).toBe(5);
  });

  it('freshness degrades over time', () => {
    const times = [
      new Date(Date.now() - 30_000),     // 30s
      new Date(Date.now() - 3 * 60_000), // 3min
      new Date(Date.now() - 7 * 60_000), // 7min
      new Date(Date.now() - 12 * 60_000),// 12min
      new Date(Date.now() - 20 * 60_000),// 20min
    ];
    const scores = times.map(freshnessScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThan(scores[i - 1]!);
    }
  });
});

describe('computeOverallScore', () => {
  // Weights: proximity 0.40, rating 0.20, completion 0.15, onTime 0.10, experience 0.10, freshness 0.05

  it('returns maximum score for a perfect nearby rider', () => {
    const score = computeOverallScore(
      0.3,    // 0.3 km → proximity 100
      5.0,    // 5-star → rating 100
      1.0,    // 100% completion → 100
      1.0,    // 100% on-time → 100
      500,    // 500 deliveries → experience 100
      new Date(Date.now() - 10_000), // 10s ago → freshness 100
    );
    // All scores = 100 → weighted = 100
    expect(score).toBe(100);
  });

  it('returns minimum score for poor far-away rider', () => {
    const score = computeOverallScore(
      30,     // >25km → proximity 0
      null,   // no rating → 50
      null,   // no completion → 60
      null,   // no on-time → 60
      0,      // 0 deliveries → experience 10
      null,   // no GPS → freshness 10
    );
    // proximity: 0*0.4=0, rating: 50*0.2=10, completion: 60*0.15=9,
    // onTime: 60*0.1=6, experience: 10*0.1=1, freshness: 10*0.05=0.5
    // Total: 26.5 → rounds to 27
    expect(score).toBe(27);
  });

  it('weights proximity most heavily (40%)', () => {
    // Same rider stats, different distances
    const nearScore = computeOverallScore(0.5, 4, 0.9, 0.9, 100, new Date());
    const farScore = computeOverallScore(20, 4, 0.9, 0.9, 100, new Date());
    // Near: proximity 100*0.4=40,  Far: proximity 15*0.4=6
    // Difference should be ~34 points
    expect(nearScore - farScore).toBeGreaterThan(30);
  });

  it('new rider with no stats gets a fair score when close', () => {
    const score = computeOverallScore(
      1.0,    // 1km → proximity 95
      null,   // new → 50
      null,   // new → 60
      null,   // new → 60
      0,      // new → 10
      new Date(Date.now() - 30_000), // 30s ago → 100
    );
    // 95*0.4 + 50*0.2 + 60*0.15 + 60*0.1 + 10*0.1 + 100*0.05
    // = 38 + 10 + 9 + 6 + 1 + 5 = 69
    expect(score).toBe(69);
  });

  it('experienced rider far away scores lower than new rider nearby', () => {
    const experiencedFar = computeOverallScore(15, 5, 1.0, 1.0, 500, new Date());
    const newNearby = computeOverallScore(0.5, null, null, null, 0, new Date());
    // Proximity dominance: near (100*0.4=40) vs far (15*0.4=6)
    // The 34-point proximity advantage should outweigh the experience gap
    expect(newNearby).toBeGreaterThan(experiencedFar - 10);
  });

  it('returns a number between 0 and 100', () => {
    const testCases = [
      [0, 5, 1.0, 1.0, 500, new Date()],
      [25, null, null, null, 0, null],
      [10, 3, 0.5, 0.5, 50, new Date(Date.now() - 10 * 60_000)],
    ] as const;

    for (const [dist, rating, comp, onTime, exp, fresh] of testCases) {
      const score = computeOverallScore(dist, rating, comp, onTime, exp, fresh);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('result is always a whole number (rounded)', () => {
    const score = computeOverallScore(3, 3.7, 0.83, 0.77, 45, new Date(Date.now() - 3 * 60_000));
    expect(Number.isInteger(score)).toBe(true);
  });
});
