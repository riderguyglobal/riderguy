import {
  OrderStatus,
  PackageType,
  PaymentMethod,
  PaymentStatus,
  ProofOfDeliveryType,
} from './enums';

/** Delivery order */
export interface Order {
  id: string;
  orderNumber: string; // Human-readable: RG-2026-000001
  clientId: string;
  riderId: string | null;
  zoneId: string | null;

  // Pickup
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupContactName: string | null;
  pickupContactPhone: string | null;
  pickupInstructions: string | null;

  // Dropoff
  dropoffAddress: string;
  dropoffLatitude: number;
  dropoffLongitude: number;
  dropoffContactName: string | null;
  dropoffContactPhone: string | null;
  dropoffInstructions: string | null;

  // Package
  packageType: PackageType;
  packageDescription: string | null;
  packagePhotoUrl: string | null;

  // Pricing
  distanceKm: number;
  routeDistanceKm: number | null;
  estimatedDurationMinutes: number;
  baseFare: number;
  distanceCharge: number;
  surgeMultiplier: number;
  timeOfDayMultiplier: number;
  weatherMultiplier: number;
  crossZoneMultiplier: number;
  expressMultiplier: number;
  weightSurcharge: number;
  packageWeightKg: number | null;
  waitTimeCharge: number;
  waitTimeMinutes: number;
  businessDiscount: number;
  promoDiscount: number;
  promoCodeId: string | null;
  serviceFee: number;
  serviceFeeRate: number;
  totalPrice: number;
  currency: string;
  isExpress: boolean;

  // Payment
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference: string | null;

  // Status
  status: OrderStatus;
  statusHistory: OrderStatusEntry[];

  // Proof of delivery
  proofOfDeliveryType: ProofOfDeliveryType | null;
  proofOfDeliveryUrl: string | null;
  deliveryPinCode: string | null;

  // Rider earnings
  riderEarnings: number | null;
  platformCommission: number | null;
  tipAmount: number;

  // Ratings
  clientRating: number | null;
  clientReview: string | null;
  riderRating: number | null;

  // Scheduling
  isScheduled: boolean;
  scheduledAt: Date | null;

  // Failure
  failureReason: string | null;
  failurePhotoUrl: string | null;

  // Timestamps
  assignedAt: Date | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A single status change in the order timeline */
export interface OrderStatusEntry {
  status: OrderStatus;
  timestamp: Date;
  note: string | null;
  actor: 'system' | 'rider' | 'client' | 'admin';
}

/** Input for creating a new order */
export interface CreateOrderInput {
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupContactName?: string;
  pickupContactPhone?: string;
  pickupInstructions?: string;
  dropoffAddress: string;
  dropoffLatitude: number;
  dropoffLongitude: number;
  dropoffContactName?: string;
  dropoffContactPhone?: string;
  dropoffInstructions?: string;
  packageType: PackageType;
  packageDescription?: string;
  paymentMethod: PaymentMethod;
  isScheduled?: boolean;
  scheduledAt?: Date;
}

/** Price estimate returned before order creation */
export interface PriceEstimate {
  distanceKm: number;
  routeDistanceKm: number | null;
  haversineDistanceKm: number;
  roadFactor: number;
  estimatedDurationMinutes: number;
  baseFare: number;
  distanceCharge: number;
  stopSurcharges: number;
  additionalStops: number;
  packageMultiplier: number;
  packageType: string;
  surgeMultiplier: number;
  timeOfDayMultiplier: number;
  weatherMultiplier: number;
  crossZoneMultiplier: number;
  expressMultiplier: number;
  weightSurcharge: number;
  waitTimeCharge: number;
  businessDiscount: number;
  promoDiscount: number;
  scheduleDiscount: number;
  subtotal: number;
  serviceFee: number;
  serviceFeeRate: number;
  totalPrice: number;
  currency: string;
  isExpress: boolean;
  zoneId: string | null;
  zoneName: string | null;
  riderEarnings: number;
  platformCommission: number;
  commissionRate: number;
  /** Dynamic surge info for UI display */
  surgeLevel: string;
  weatherCondition: string;
  timeOfDayPeriod: string;
}
