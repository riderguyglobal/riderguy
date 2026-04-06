// ============================================================
// Enums — All enumerated types used across the platform
// ============================================================

/** Roles that a user can have on the platform */
export enum UserRole {
  RIDER = 'RIDER',
  CLIENT = 'CLIENT',
  BUSINESS_CLIENT = 'BUSINESS_CLIENT',
  PARTNER = 'PARTNER',
  DISPATCHER = 'DISPATCHER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

/** Account status for any user */
export enum AccountStatus {
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATED = 'DEACTIVATED',
  BANNED = 'BANNED',
}

/** Rider-specific onboarding status */
export enum RiderOnboardingStatus {
  REGISTERED = 'REGISTERED',
  DOCUMENTS_PENDING = 'DOCUMENTS_PENDING',
  DOCUMENTS_SUBMITTED = 'DOCUMENTS_SUBMITTED',
  DOCUMENTS_UNDER_REVIEW = 'DOCUMENTS_UNDER_REVIEW',
  DOCUMENTS_APPROVED = 'DOCUMENTS_APPROVED',
  DOCUMENTS_REJECTED = 'DOCUMENTS_REJECTED',
  TRAINING_PENDING = 'TRAINING_PENDING',
  TRAINING_COMPLETE = 'TRAINING_COMPLETE',
  ACTIVATED = 'ACTIVATED',
}

/** Rider's real-time availability */
export enum RiderAvailability {
  OFFLINE = 'OFFLINE',
  ONLINE = 'ONLINE',
  ON_DELIVERY = 'ON_DELIVERY',
  ON_BREAK = 'ON_BREAK',
}

/** Vehicle types supported */
export enum VehicleType {
  BICYCLE = 'BICYCLE',
  MOTORCYCLE = 'MOTORCYCLE',
  CAR = 'CAR',
  VAN = 'VAN',
  TRUCK = 'TRUCK',
}

/** Types of documents riders upload */
export enum DocumentType {
  NATIONAL_ID = 'NATIONAL_ID',
  DRIVERS_LICENSE = 'DRIVERS_LICENSE',
  VEHICLE_REGISTRATION = 'VEHICLE_REGISTRATION',
  INSURANCE_CERTIFICATE = 'INSURANCE_CERTIFICATE',
  PROOF_OF_ADDRESS = 'PROOF_OF_ADDRESS',
  SELFIE = 'SELFIE',
  VEHICLE_PHOTO_FRONT = 'VEHICLE_PHOTO_FRONT',
  VEHICLE_PHOTO_BACK = 'VEHICLE_PHOTO_BACK',
  VEHICLE_PHOTO_LEFT = 'VEHICLE_PHOTO_LEFT',
  VEHICLE_PHOTO_RIGHT = 'VEHICLE_PHOTO_RIGHT',
}

/** Document verification status */
export enum DocumentStatus {
  PENDING = 'PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

/** Order lifecycle */
export enum OrderStatus {
  PENDING = 'PENDING',
  SEARCHING_RIDER = 'SEARCHING_RIDER',
  ASSIGNED = 'ASSIGNED',
  PICKUP_EN_ROUTE = 'PICKUP_EN_ROUTE',
  AT_PICKUP = 'AT_PICKUP',
  PICKED_UP = 'PICKED_UP',
  IN_TRANSIT = 'IN_TRANSIT',
  AT_DROPOFF = 'AT_DROPOFF',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  CANCELLED_BY_CLIENT = 'CANCELLED_BY_CLIENT',
  CANCELLED_BY_RIDER = 'CANCELLED_BY_RIDER',
  CANCELLED_BY_ADMIN = 'CANCELLED_BY_ADMIN',
}

/** Package types for delivery */
export enum PackageType {
  DOCUMENT = 'DOCUMENT',
  SMALL_PARCEL = 'SMALL_PARCEL',
  MEDIUM_PARCEL = 'MEDIUM_PARCEL',
  LARGE_PARCEL = 'LARGE_PARCEL',
  FOOD = 'FOOD',
  FRAGILE = 'FRAGILE',
  HIGH_VALUE = 'HIGH_VALUE',
  OTHER = 'OTHER',
}

/** Proof of delivery method */
export enum ProofOfDeliveryType {
  PHOTO = 'PHOTO',
  PIN_CODE = 'PIN_CODE',
  LEFT_AT_DOOR = 'LEFT_AT_DOOR',
}

/** Payment methods */
export enum PaymentMethod {
  CARD = 'CARD',
  MOBILE_MONEY = 'MOBILE_MONEY',
  WALLET = 'WALLET',
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

/** Payment status */
export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

/** Wallet transaction types */
export enum TransactionType {
  DELIVERY_EARNING = 'DELIVERY_EARNING',
  TIP = 'TIP',
  BONUS = 'BONUS',
  COMMISSION_DEDUCTION = 'COMMISSION_DEDUCTION',
  WITHDRAWAL = 'WITHDRAWAL',
  DEPOSIT = 'DEPOSIT',
  REFERRAL_COMMISSION = 'REFERRAL_COMMISSION',
  REFUND = 'REFUND',
  PENALTY = 'PENALTY',
  ADJUSTMENT = 'ADJUSTMENT',
}

/** Withdrawal status */
export enum WithdrawalStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/** Partner tiers */
export enum PartnerTier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}

/** Rider level tiers */
export enum RiderLevel {
  ROOKIE = 1,
  RUNNER = 2,
  STREAKER = 3,
  PRO = 4,
  ACE = 5,
  CAPTAIN = 6,
  LEGEND = 7,
}

/** Notification channels */
export enum NotificationChannel {
  PUSH = 'PUSH',
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
}

/** Zone status */
export enum ZoneStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  FULL = 'FULL',
}

/** Stop type within a multi-stop order */
export enum StopType {
  PICKUP = 'PICKUP',
  DROPOFF = 'DROPOFF',
}

/** Status of an individual stop */
export enum StopStatus {
  PENDING = 'PENDING',
  EN_ROUTE = 'EN_ROUTE',
  ARRIVED = 'ARRIVED',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
  FAILED = 'FAILED',
}

/** Schedule frequency for recurring deliveries */
export enum ScheduleFrequency {
  ONCE = 'ONCE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  CUSTOM = 'CUSTOM',
}

/** Notification type categories */
export enum NotificationType {
  ORDER = 'ORDER',
  PAYMENT = 'PAYMENT',
  SYSTEM = 'SYSTEM',
  COMMUNITY = 'COMMUNITY',
  TRAINING = 'TRAINING',
  GAMIFICATION = 'GAMIFICATION',
  PROMOTION = 'PROMOTION',
}
