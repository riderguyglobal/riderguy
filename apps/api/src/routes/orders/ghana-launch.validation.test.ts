import { describe, expect, it } from 'vitest';
import {
  createInHouseInvitationSchema,
  createOrderSchema,
  createScheduledDeliverySchema,
  ghanaOrderLongitudeSchema,
  googleAuthSchema,
  loginWithPasswordSchema,
  loginWithPinSchema,
  phoneSchema,
  priceEstimateSchema,
  updateAvailabilitySchema,
} from '@riderguy/validators';

const validOrder = {
  pickupAddress: 'Osu, Accra',
  pickupLatitude: 5.556,
  pickupLongitude: -0.182,
  pickupContactPhone: '024 123 4567',
  dropoffAddress: 'East Legon, Accra',
  dropoffLatitude: 5.635,
  dropoffLongitude: -0.154,
  dropoffContactPhone: '233501234567',
  packageType: 'SMALL_PARCEL' as const,
  paymentMethod: 'MOBILE_MONEY' as const,
};

describe('Ghana phone launch boundary', () => {
  it.each([
    ['024 123 4567', '+233241234567'],
    ['+233 (24) 123-4567', '+233241234567'],
    ['233241234567', '+233241234567'],
    ['241234567', '+233241234567'],
  ])('normalizes %s to Ghana E.164', (input, expected) => {
    expect(phoneSchema.parse(input)).toBe(expected);
  });

  it.each(['+2348012345678', '+1 202 555 0123', '024123456', 'phone0241234567'])(
    'rejects non-Ghana or malformed input %s',
    (input) => {
      expect(phoneSchema.safeParse(input).success).toBe(false);
    },
  );

  it('normalizes phone identifiers and targeted invitations', () => {
    expect(loginWithPinSchema.parse({ identifier: '0241234567', pin: '123456' }).identifier).toBe(
      '+233241234567',
    );
    expect(
      loginWithPasswordSchema.parse({ identifier: '0501234567', password: 'secret' }).identifier,
    ).toBe('+233501234567');
    expect(
      createInHouseInvitationSchema.parse({
        phone: '0551234567',
        idempotencyKey: 'c61b01d0-ab71-4cff-9046-7b7fabd8e824',
      }).phone,
    ).toBe('+233551234567');
  });

  it('requires a stable request ID and exactly one invitation delivery channel', () => {
    const idempotencyKey = 'c61b01d0-ab71-4cff-9046-7b7fabd8e824';

    expect(createInHouseInvitationSchema.safeParse({ phone: '0551234567' }).success).toBe(false);
    expect(
      createInHouseInvitationSchema.safeParse({
        email: 'rider@example.com',
        phone: '0551234567',
        idempotencyKey,
      }).success,
    ).toBe(false);
  });

  it('keeps Google authentication independent of internal placeholder phones', () => {
    expect(
      googleAuthSchema.safeParse({ credential: 'google-id-token', role: 'RIDER' }).success,
    ).toBe(true);
    expect(
      googleAuthSchema.safeParse({ credential: 'google-id-token', role: 'CLIENT' }).success,
    ).toBe(true);
    expect(
      googleAuthSchema.safeParse({ credential: 'google-id-token', role: 'PARTNER' }).success,
    ).toBe(false);
    expect(
      googleAuthSchema.safeParse({ credential: 'x'.repeat(4097), role: 'CLIENT' }).success,
    ).toBe(false);
  });
});

describe('Ghana order coordinate boundary', () => {
  it('accepts Ghana coordinates and normalizes contact phones', () => {
    const result = createOrderSchema.parse(validOrder);
    expect(result.pickupContactPhone).toBe('+233241234567');
    expect(result.dropoffContactPhone).toBe('+233501234567');
  });

  it('rejects pickup or drop-off coordinates outside the Ghana launch bounds', () => {
    expect(
      createOrderSchema.safeParse({
        ...validOrder,
        pickupLatitude: 6.5244,
        pickupLongitude: 3.3792,
      }).success,
    ).toBe(false);
    expect(
      createOrderSchema.safeParse({
        ...validOrder,
        dropoffLatitude: 5.36,
        dropoffLongitude: -4.0,
      }).success,
    ).toBe(false);
  });

  it('rejects out-of-country extra stops and estimates', () => {
    expect(
      createOrderSchema.safeParse({
        ...validOrder,
        stops: [
          {
            type: 'DROPOFF',
            sequence: 0,
            address: 'Outside launch area',
            latitude: 6.5,
            longitude: 3.4,
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      priceEstimateSchema.safeParse({
        pickupLatitude: 5.556,
        pickupLongitude: -0.182,
        dropoffLatitude: 6.5,
        dropoffLongitude: 3.4,
        packageType: 'SMALL_PARCEL',
      }).success,
    ).toBe(false);
  });

  it('uses the same boundary for scheduled order creation and updates', () => {
    expect(
      createScheduledDeliverySchema.safeParse({
        frequency: 'DAILY',
        pickupAddress: 'Accra',
        pickupLatitude: 5.556,
        pickupLongitude: -0.182,
        dropoffAddress: 'Outside launch area',
        dropoffLatitude: 6.5,
        dropoffLongitude: 3.4,
      }).success,
    ).toBe(false);
    expect(ghanaOrderLongitudeSchema.safeParse(3.4).success).toBe(false);
  });
});

describe('Rider availability state ownership', () => {
  it('requires a complete current position before going online', () => {
    expect(updateAvailabilitySchema.safeParse({ availability: 'ONLINE' }).success).toBe(false);
    expect(
      updateAvailabilitySchema.safeParse({ availability: 'ONLINE', latitude: 5.56 }).success,
    ).toBe(false);
    expect(
      updateAvailabilitySchema.safeParse({
        availability: 'ONLINE',
        latitude: 5.56,
        longitude: -0.187,
      }).success,
    ).toBe(true);
  });

  it.each(['ON_DELIVERY', 'ON_BREAK'])('rejects client-owned %s transitions', (availability) => {
    expect(updateAvailabilitySchema.safeParse({ availability }).success).toBe(false);
  });
});
