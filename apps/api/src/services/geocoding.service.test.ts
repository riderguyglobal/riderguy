import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockConfig = vi.hoisted(() => ({
  isProduction: false,
  google: { mapsApiKey: '' },
}));

vi.mock('../config', () => ({ config: mockConfig }));
vi.mock('@riderguy/database', () => ({ prisma: {} }));
vi.mock('./popularity.service', () => ({
  recordLocationSelection: vi.fn(),
  getPopularityBoosts: vi.fn().mockResolvedValue(new Map()),
}));

import { forwardGeocode, retrievePlace, reverseGeocode } from './geocoding.service';

describe('geocoding provider safety', () => {
  beforeEach(() => {
    mockConfig.isProduction = false;
    mockConfig.google.mapsApiKey = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fails closed in production when Google Maps is not configured', async () => {
    mockConfig.isProduction = true;

    await expect(forwardGeocode('1 High Street, Accra'))
      .rejects.toMatchObject({ statusCode: 500, message: 'Geocoding service unavailable' });
  });

  it('does not invent coordinates for an unmatched local-development address', async () => {
    const address = 'zzzz-unmapped-nonexistent-address-9f3a';

    await expect(forwardGeocode(address)).resolves.toEqual([]);
  });

  it('still resolves verified local gazetteer IDs without a Google key', async () => {
    mockConfig.isProduction = true;

    await expect(retrievePlace('gaz-0-east-legon')).resolves.toMatchObject({
      name: 'East Legon',
      latitude: 5.635,
      longitude: -0.1572,
    });
  });

  it('fails closed for Google place details when production has no key', async () => {
    mockConfig.isProduction = true;

    await expect(retrievePlace('google-unconfigured-place'))
      .rejects.toMatchObject({ statusCode: 500, message: 'Geocoding service unavailable' });
  });

  it('rejects reverse-geocoding coordinates outside the Ghana launch boundary', async () => {
    await expect(reverseGeocode(6.5244, 3.3792))
      .rejects.toMatchObject({ statusCode: 400, message: 'Location must be within Ghana' });
  });

  it('filters out-of-country results returned by the upstream geocoder', async () => {
    mockConfig.google.mapsApiKey = 'configured-test-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'OK',
        results: [
          {
            formatted_address: 'Lagos, Nigeria',
            geometry: { location: { lat: 6.5244, lng: 3.3792 } },
            types: ['locality'],
          },
          {
            formatted_address: 'Accra, Ghana',
            geometry: { location: { lat: 5.6037, lng: -0.187 } },
            types: ['locality'],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(forwardGeocode('Accra')).resolves.toEqual([
      expect.objectContaining({ address: 'Accra, Ghana', latitude: 5.6037, longitude: -0.187 }),
    ]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('components=country%3AGH');
  });

  it('does not retrieve a Google place outside Ghana', async () => {
    mockConfig.google.mapsApiKey = 'configured-test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'outside',
        displayName: { text: 'Lagos' },
        formattedAddress: 'Lagos, Nigeria',
        location: { latitude: 6.5244, longitude: 3.3792 },
        types: ['locality'],
      }),
    }));

    await expect(retrievePlace('googleplaces-outside')).resolves.toBeNull();
  });
});
