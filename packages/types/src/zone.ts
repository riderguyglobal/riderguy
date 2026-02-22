import { ZoneStatus } from './enums';

/** Geographic zone for operations */
export interface Zone {
  id: string;
  name: string;
  description: string | null;
  status: ZoneStatus;
  /** GeoJSON polygon coordinates */
  polygon: number[][][];
  /** Center point for quick distance calculations */
  centerLatitude: number;
  centerLongitude: number;
  /** Pricing config for this zone */
  baseFare: number;
  perKmRate: number;
  minimumFare: number;
  surgeMultiplier: number;
  commissionRate: number; // platform commission percentage (0-100)
  currency: string;
  totalRiders: number;
  activeRiders: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Input for creating/updating a zone */
export interface UpsertZoneInput {
  name: string;
  description?: string;
  polygon: number[][][];
  centerLatitude: number;
  centerLongitude: number;
  baseFare: number;
  perKmRate: number;
  minimumFare: number;
  commissionRate: number;
  currency: string;
}
