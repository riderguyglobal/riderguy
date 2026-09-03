import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createZoneSchema } from '@riderguy/validators';
import { prisma } from '@riderguy/database';

vi.mock('./pricing.service', () => ({ invalidateZoneCache: vi.fn() }));

import { ZoneService } from './zone.service';

const accraBoundary = [
  [
    [-0.35, 5.45],
    [0.05, 5.45],
    [0.05, 5.75],
    [-0.35, 5.75],
    [-0.35, 5.45],
  ],
];

describe('Zone geometry integrity', () => {
  beforeEach(() => vi.clearAllMocks());

  it('finds an Accra coordinate using the stored GeoJSON coordinate-ring format', async () => {
    vi.mocked(prisma.zone.findMany).mockResolvedValue([
      { id: 'accra', status: 'ACTIVE', polygon: accraBoundary },
    ] as never);

    await expect(ZoneService.findZoneForPoint(5.6037, -0.187)).resolves.toMatchObject({
      id: 'accra',
    });
    await expect(ZoneService.findZoneForPoint(4.0, -0.187)).resolves.toBeNull();
  });

  it('keeps legacy lat/lng object zones operational during migration', async () => {
    vi.mocked(prisma.zone.findMany).mockResolvedValue([
      {
        id: 'legacy-osu',
        status: 'ACTIVE',
        polygon: [
          { lat: 5.55, lng: -0.2 },
          { lat: 5.55, lng: -0.17 },
          { lat: 5.58, lng: -0.17 },
          { lat: 5.58, lng: -0.2 },
        ],
      },
    ] as never);

    await expect(ZoneService.findZoneForPoint(5.565, -0.1875)).resolves.toMatchObject({
      id: 'legacy-osu',
    });
  });

  it('accepts a closed Ghana polygon and rejects foreign or unclosed boundaries', () => {
    const valid = {
      name: 'Accra Central',
      polygon: accraBoundary,
      centerLatitude: 5.6037,
      centerLongitude: -0.187,
      baseFare: 15,
      perKmRate: 5,
      minimumFare: 20,
      commissionRate: 15,
      currency: 'GHS',
    };

    expect(createZoneSchema.parse(valid)).toEqual(valid);
    expect(() =>
      createZoneSchema.parse({
        ...valid,
        centerLatitude: -26.2041,
        centerLongitude: 28.0473,
      }),
    ).toThrow();
    expect(() =>
      createZoneSchema.parse({
        ...valid,
        polygon: [[...accraBoundary[0]!.slice(0, -1), [-0.2, 5.6]]],
      }),
    ).toThrow();
  });
});
