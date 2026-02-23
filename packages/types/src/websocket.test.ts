import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  RiderLocationUpdate,
  OrderStatusUpdate,
  ChatMessage,
  TypingIndicator,
  NewJobNotification,
  JobOffer,
} from './websocket';

// ============================================================
// WebSocket Type Contract Tests
//
// These verify the type shapes compile correctly and that
// the event contracts are well-formed. Catches regressions
// if someone changes a type without updating consumers.
// ============================================================

describe('JobOffer type', () => {
  it('has all required fields', () => {
    const offer: JobOffer = {
      orderId: 'order-123',
      orderNumber: 'RG-0001',
      pickupAddress: '123 Oxford St, Accra',
      dropoffAddress: '456 Circle Rd, Accra',
      pickupLat: 5.6037,
      pickupLng: -0.1870,
      dropoffLat: 5.6200,
      dropoffLng: -0.1750,
      distanceKm: 3.2,
      estimatedDurationMinutes: 12,
      totalPrice: 15.00,
      serviceFee: 2.25,
      riderEarnings: 12.75,
      packageType: 'SMALL_PARCEL',
      currency: 'GHS',
      distanceToPickup: 1.5,
      expiresAt: new Date().toISOString(),
    };

    expect(offer.orderId).toBeDefined();
    expect(offer.orderNumber).toBeDefined();
    expect(offer.pickupAddress).toBeDefined();
    expect(offer.dropoffAddress).toBeDefined();
    expect(offer.pickupLat).toBeTypeOf('number');
    expect(offer.pickupLng).toBeTypeOf('number');
    expect(offer.dropoffLat).toBeTypeOf('number');
    expect(offer.dropoffLng).toBeTypeOf('number');
    expect(offer.distanceKm).toBeTypeOf('number');
    expect(offer.estimatedDurationMinutes).toBeTypeOf('number');
    expect(offer.totalPrice).toBeTypeOf('number');
    expect(offer.serviceFee).toBeTypeOf('number');
    expect(offer.riderEarnings).toBeTypeOf('number');
    expect(offer.packageType).toBeDefined();
    expect(offer.currency).toBe('GHS');
    expect(offer.distanceToPickup).toBeTypeOf('number');
    expect(offer.expiresAt).toBeDefined();
  });

  it('allows optional packageDescription', () => {
    const offer: JobOffer = {
      orderId: 'order-123',
      orderNumber: 'RG-0001',
      pickupAddress: '123 Oxford St',
      dropoffAddress: '456 Circle Rd',
      pickupLat: 5.6037,
      pickupLng: -0.1870,
      dropoffLat: 5.6200,
      dropoffLng: -0.1750,
      distanceKm: 3.2,
      estimatedDurationMinutes: 12,
      totalPrice: 15.00,
      serviceFee: 2.25,
      riderEarnings: 12.75,
      packageType: 'DOCUMENT',
      packageDescription: 'Important legal documents',
      currency: 'GHS',
      distanceToPickup: 0.8,
      expiresAt: new Date().toISOString(),
    };

    expect(offer.packageDescription).toBe('Important legal documents');
  });

  it('rider earnings should be less than total price', () => {
    const offer: JobOffer = {
      orderId: 'o1',
      orderNumber: 'RG-0001',
      pickupAddress: 'A',
      dropoffAddress: 'B',
      pickupLat: 5.6,
      pickupLng: -0.18,
      dropoffLat: 5.62,
      dropoffLng: -0.17,
      distanceKm: 3,
      estimatedDurationMinutes: 10,
      totalPrice: 20,
      serviceFee: 3,
      riderEarnings: 17,
      packageType: 'SMALL_PARCEL',
      currency: 'GHS',
      distanceToPickup: 1,
      expiresAt: new Date().toISOString(),
    };

    expect(offer.riderEarnings).toBeLessThanOrEqual(offer.totalPrice);
    expect(offer.riderEarnings).toBe(offer.totalPrice - offer.serviceFee);
  });
});

describe('RiderLocationUpdate type', () => {
  it('has required fields', () => {
    const update: RiderLocationUpdate = {
      orderId: 'order-1',
      riderId: 'rider-1',
      latitude: 5.6037,
      longitude: -0.1870,
      timestamp: new Date().toISOString(),
    };
    expect(update.latitude).toBeTypeOf('number');
    expect(update.longitude).toBeTypeOf('number');
    expect(update.timestamp).toBeDefined();
  });

  it('allows optional heading and speed', () => {
    const update: RiderLocationUpdate = {
      orderId: 'order-1',
      riderId: 'rider-1',
      latitude: 5.6037,
      longitude: -0.1870,
      heading: 270,
      speed: 35.5,
      timestamp: new Date().toISOString(),
    };
    expect(update.heading).toBe(270);
    expect(update.speed).toBe(35.5);
  });
});

describe('OrderStatusUpdate type', () => {
  it('has all required fields', () => {
    const update: OrderStatusUpdate = {
      orderId: 'order-1',
      orderNumber: 'RG-0001',
      status: 'ASSIGNED',
      previousStatus: 'PENDING',
      actor: 'system',
      timestamp: new Date().toISOString(),
    };
    expect(update.status).toBe('ASSIGNED');
    expect(update.previousStatus).toBe('PENDING');
    expect(update.actor).toBe('system');
  });

  it('allows optional note', () => {
    const update: OrderStatusUpdate = {
      orderId: 'order-1',
      orderNumber: 'RG-0001',
      status: 'ASSIGNED',
      previousStatus: 'SEARCHING_RIDER',
      actor: 'system',
      note: 'Auto-dispatch assigned rider John',
      timestamp: new Date().toISOString(),
    };
    expect(update.note).toBeDefined();
  });
});

describe('ChatMessage type', () => {
  it('has all required fields', () => {
    const msg: ChatMessage = {
      id: 'msg-1',
      orderId: 'order-1',
      senderId: 'user-1',
      senderName: 'Kwame Mensah',
      senderRole: 'rider',
      content: 'I am on my way!',
      timestamp: new Date().toISOString(),
    };
    expect(msg.senderRole).toBe('rider');
    expect(msg.content).toBe('I am on my way!');
  });

  it('accepts valid sender roles', () => {
    const roles: ChatMessage['senderRole'][] = ['rider', 'client', 'admin'];
    roles.forEach((role) => {
      const msg: ChatMessage = {
        id: 'msg-1',
        orderId: 'order-1',
        senderId: 'user-1',
        senderName: 'Test User',
        senderRole: role,
        content: 'Hello',
        timestamp: new Date().toISOString(),
      };
      expect(['rider', 'client', 'admin']).toContain(msg.senderRole);
    });
  });
});

describe('NewJobNotification type', () => {
  it('has all required fields', () => {
    const notif: NewJobNotification = {
      orderId: 'order-1',
      orderNumber: 'RG-0042',
      pickupAddress: '12 Spintex Road, Accra',
      dropoffAddress: '5 Airport Residential, Accra',
      distanceKm: 6.5,
      totalPrice: 28.50,
      packageType: 'LARGE_PARCEL',
    };
    expect(notif.orderNumber).toMatch(/^RG-/);
    expect(notif.distanceKm).toBeGreaterThan(0);
    expect(notif.totalPrice).toBeGreaterThan(0);
  });
});

describe('TypingIndicator type', () => {
  it('has all required fields', () => {
    const indicator: TypingIndicator = {
      orderId: 'order-1',
      senderId: 'user-1',
      senderName: 'Ama Darko',
    };
    expect(indicator.orderId).toBeDefined();
    expect(indicator.senderId).toBeDefined();
    expect(indicator.senderName).toBeDefined();
  });
});

describe('ServerToClientEvents contract', () => {
  it('defines all required event handlers', () => {
    // This is a compile-time test — if ServerToClientEvents is missing
    // any of these keys, TypeScript will fail at build time.
    type EventNames = keyof ServerToClientEvents;
    const expectedEvents: EventNames[] = [
      'rider:location',
      'order:status',
      'message:new',
      'message:typing',
      'job:new',
      'job:cancelled',
      'job:offer',
      'job:offer:expired',
      'job:offer:taken',
      'notification',
      'error',
    ];
    // Runtime check that the array compiles (proves the event names exist)
    expect(expectedEvents.length).toBe(11);
  });
});

describe('ClientToServerEvents contract', () => {
  it('defines all required event handlers', () => {
    type EventNames = keyof ClientToServerEvents;
    const expectedEvents: EventNames[] = [
      'rider:updateLocation',
      'order:subscribe',
      'order:unsubscribe',
      'message:send',
      'message:typing',
      'job:offer:respond',
    ];
    expect(expectedEvents.length).toBe(6);
  });
});
