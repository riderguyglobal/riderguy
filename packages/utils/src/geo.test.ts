import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  estimateDuration,
  isPointInPolygon,
  calculateBearing,
} from './geo';

// ============================================================
// Geo Utility Tests
// ============================================================

describe('haversineDistance', () => {
  it('returns 0 for identical coordinates', () => {
    const d = haversineDistance(5.6037, -0.1870, 5.6037, -0.1870);
    expect(d).toBe(0);
  });

  it('calculates known distance: Accra to Kumasi (~252 km)', () => {
    // Accra: 5.6037° N, 0.1870° W  →  Kumasi: 6.6885° N, 1.6244° W
    const d = haversineDistance(5.6037, -0.1870, 6.6885, -1.6244);
    expect(d).toBeGreaterThan(180);
    expect(d).toBeLessThan(280);
  });

  it('calculates short distance: 1km apart', () => {
    // ~1 degree latitude ≈ 111 km, so 0.009° ≈ ~1 km
    const d = haversineDistance(5.6037, -0.1870, 5.6127, -0.1870);
    expect(d).toBeGreaterThan(0.8);
    expect(d).toBeLessThan(1.2);
  });

  it('calculates across Equator correctly', () => {
    const d = haversineDistance(-1, 0, 1, 0);
    // 2 degrees latitude ≈ 222 km
    expect(d).toBeGreaterThan(200);
    expect(d).toBeLessThan(230);
  });

  it('calculates across Prime Meridian correctly', () => {
    const d = haversineDistance(0, -1, 0, 1);
    expect(d).toBeGreaterThan(200);
    expect(d).toBeLessThan(230);
  });

  it('handles negative coordinates (Southern Hemisphere)', () => {
    const d = haversineDistance(-33.8688, 151.2093, -37.8136, 144.9631);
    // Sydney to Melbourne ≈ 714 km
    expect(d).toBeGreaterThan(650);
    expect(d).toBeLessThan(780);
  });

  it('returns consistent results regardless of direction', () => {
    const d1 = haversineDistance(5.6037, -0.1870, 6.6885, -1.6244);
    const d2 = haversineDistance(6.6885, -1.6244, 5.6037, -0.1870);
    expect(d1).toBeCloseTo(d2, 10);
  });
});

describe('estimateDuration', () => {
  it('calculates duration with default speed (25 km/h)', () => {
    // 25 km at 25 km/h = 60 minutes
    const d = estimateDuration(25);
    expect(d).toBe(60);
  });

  it('calculates duration with custom speed', () => {
    // 100 km at 50 km/h = 120 minutes
    const d = estimateDuration(100, 50);
    expect(d).toBe(120);
  });

  it('returns 0 for 0 distance', () => {
    expect(estimateDuration(0)).toBe(0);
  });

  it('calculates short distances correctly', () => {
    // 2 km at 25 km/h = 4.8 minutes
    const d = estimateDuration(2);
    expect(d).toBeCloseTo(4.8, 1);
  });

  it('handles very small distances', () => {
    const d = estimateDuration(0.1);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(1);
  });
});

describe('isPointInPolygon', () => {
  // Simple square polygon around central Accra
  // [lng, lat] format for each vertex
  const accraSquare: number[][][] = [[
    [-0.22, 5.58],  // SW corner
    [-0.15, 5.58],  // SE corner
    [-0.15, 5.63],  // NE corner
    [-0.22, 5.63],  // NW corner
    [-0.22, 5.58],  // close the ring
  ]];

  it('returns true for point inside polygon', () => {
    // Central Accra (inside the square)
    expect(isPointInPolygon(5.6037, -0.1870, accraSquare)).toBe(true);
  });

  it('returns false for point outside polygon', () => {
    // Kumasi (far outside)
    expect(isPointInPolygon(6.6885, -1.6244, accraSquare)).toBe(false);
  });

  it('returns false for point just outside', () => {
    // Slightly south of the polygon
    expect(isPointInPolygon(5.57, -0.19, accraSquare)).toBe(false);
  });

  it('returns true for point just inside', () => {
    expect(isPointInPolygon(5.59, -0.19, accraSquare)).toBe(true);
  });

  it('returns false for empty polygon', () => {
    expect(isPointInPolygon(5.6, -0.19, [[]])).toBe(false);
  });

  it('returns false for polygon with less than 3 points', () => {
    expect(isPointInPolygon(5.6, -0.19, [[[-0.22, 5.58], [-0.15, 5.58]]])).toBe(false);
  });

  it('works with triangular polygon', () => {
    const triangle: number[][][] = [[
      [0, 0],
      [10, 0],
      [5, 10],
      [0, 0],
    ]];
    // Center should be inside
    expect(isPointInPolygon(3, 5, triangle)).toBe(true);
    // Far outside
    expect(isPointInPolygon(20, 20, triangle)).toBe(false);
  });
});

describe('calculateBearing', () => {
  it('returns ~0 for due north', () => {
    const bearing = calculateBearing(5.0, 0, 6.0, 0);
    // Due north = 0° (or very close to 360°)
    expect(bearing).toBeLessThan(5);
  });

  it('returns ~90 for due east', () => {
    const bearing = calculateBearing(0, 0, 0, 1);
    expect(bearing).toBeCloseTo(90, 0);
  });

  it('returns ~180 for due south', () => {
    const bearing = calculateBearing(6.0, 0, 5.0, 0);
    expect(bearing).toBeCloseTo(180, 0);
  });

  it('returns ~270 for due west', () => {
    const bearing = calculateBearing(0, 1, 0, 0);
    expect(bearing).toBeCloseTo(270, 0);
  });

  it('returns value between 0 and 360', () => {
    const bearing = calculateBearing(5.6037, -0.1870, 6.6885, -1.6244);
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThan(360);
  });

  it('returns 0 for identical points', () => {
    const bearing = calculateBearing(5.0, 5.0, 5.0, 5.0);
    expect(bearing).toBe(0);
  });

  it('calculates NE bearing (Accra → Kumasi)', () => {
    // Kumasi is NW of Accra
    const bearing = calculateBearing(5.6037, -0.1870, 6.6885, -1.6244);
    // Should be roughly NW: ~300-340 degrees
    expect(bearing).toBeGreaterThan(290);
    expect(bearing).toBeLessThan(350);
  });
});
