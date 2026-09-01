import { VehicleType } from './enums';

export type VehicleReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** Rider vehicle */
export interface Vehicle {
  id: string;
  riderId: string;
  type: VehicleType;
  make: string;
  model: string;
  year: number | null;
  color: string | null;
  plateNumber: string;
  isPrimary: boolean;
  photoFrontUrl: string | null;
  photoBackUrl: string | null;
  photoLeftUrl: string | null;
  photoRightUrl: string | null;
  isApproved: boolean;
  reviewStatus: VehicleReviewStatus;
  rejectionReason: string | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Input for registering a vehicle */
export interface RegisterVehicleInput {
  type: VehicleType;
  make: string;
  model: string;
  year?: number;
  color?: string;
  plateNumber: string;
}
