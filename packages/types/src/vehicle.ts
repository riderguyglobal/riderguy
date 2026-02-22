import { VehicleType } from './enums';

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
