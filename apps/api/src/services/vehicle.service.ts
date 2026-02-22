// ============================================================
// VehicleService — Vehicle registration and management
// ============================================================

import { prisma } from '@riderguy/database';
import { ApiError } from '../lib/api-error';
import { StorageService } from './storage.service';
import type { VehicleType } from '@prisma/client';

// --------------- types ------------------------------------------------

export interface RegisterVehicleInput {
  riderId: string;
  type: VehicleType;
  make: string;
  model: string;
  year?: number;
  color?: string;
  plateNumber: string;
}

export interface VehiclePhotoInput {
  vehicleId: string;
  riderId: string;
  position: 'front' | 'back' | 'left' | 'right';
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

// --------------- service class ----------------------------------------

export class VehicleService {
  // ---- Register a vehicle ----
  static async register(input: RegisterVehicleInput) {
    // Verify rider exists
    const rider = await prisma.riderProfile.findUnique({
      where: { id: input.riderId },
    });

    if (!rider) {
      throw ApiError.notFound('Rider profile not found');
    }

    // Check for duplicate plate number globally (no two vehicles should share a plate)
    const existingPlate = await prisma.vehicle.findFirst({
      where: { plateNumber: input.plateNumber },
    });

    if (existingPlate) {
      throw ApiError.conflict('A vehicle with this plate number is already registered.');
    }

    // Check how many vehicles this rider has
    const vehicleCount = await prisma.vehicle.count({
      where: { riderId: input.riderId },
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        riderId: input.riderId,
        type: input.type,
        make: input.make,
        model: input.model,
        year: input.year ?? null,
        color: input.color ?? null,
        plateNumber: input.plateNumber,
        isPrimary: vehicleCount === 0, // First vehicle is primary
      },
    });

    return vehicle;
  }

  // ---- Upload vehicle photo ----
  static async uploadPhoto(input: VehiclePhotoInput) {
    if (!StorageService.isAllowedImageType(input.mimeType)) {
      throw ApiError.badRequest(
        'Invalid file type. Allowed: JPEG, PNG, WebP.',
        'INVALID_FILE_TYPE',
      );
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: input.vehicleId },
    });

    if (!vehicle) {
      throw ApiError.notFound('Vehicle not found');
    }

    if (vehicle.riderId !== input.riderId) {
      throw ApiError.forbidden('You do not own this vehicle');
    }

    // Upload to storage
    const result = await StorageService.upload(
      input.buffer,
      input.originalName,
      input.mimeType,
      'vehicles',
    );

    // Map position to field
    const fieldMap: Record<string, string> = {
      front: 'photoFrontUrl',
      back: 'photoBackUrl',
      left: 'photoLeftUrl',
      right: 'photoRightUrl',
    };

    const field = fieldMap[input.position]!;

    // Delete old photo if exists
    const oldUrl = vehicle[field as keyof typeof vehicle] as string | null;
    if (oldUrl) {
      await StorageService.delete(oldUrl).catch(() => {});
    }

    const updated = await prisma.vehicle.update({
      where: { id: input.vehicleId },
      data: { [field]: result.url },
    });

    return updated;
  }

  // ---- List vehicles for a rider ----
  static async listByRider(riderId: string) {
    return prisma.vehicle.findMany({
      where: { riderId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // ---- Get a vehicle by ID ----
  static async getById(vehicleId: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw ApiError.notFound('Vehicle not found');
    }

    return vehicle;
  }

  // ---- Update vehicle details ----
  static async update(
    vehicleId: string,
    riderId: string,
    data: Partial<Pick<RegisterVehicleInput, 'type' | 'make' | 'model' | 'year' | 'color' | 'plateNumber'>>,
  ) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw ApiError.notFound('Vehicle not found');
    }

    if (vehicle.riderId !== riderId) {
      throw ApiError.forbidden('You do not own this vehicle');
    }

    return prisma.vehicle.update({
      where: { id: vehicleId },
      data,
    });
  }

  // ---- Delete a vehicle ----
  static async remove(vehicleId: string, riderId: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw ApiError.notFound('Vehicle not found');
    }

    if (vehicle.riderId !== riderId) {
      throw ApiError.forbidden('You do not own this vehicle');
    }

    // Delete vehicle photos from storage
    const urls = [vehicle.photoFrontUrl, vehicle.photoBackUrl, vehicle.photoLeftUrl, vehicle.photoRightUrl];
    await Promise.all(
      urls.filter(Boolean).map((url) => StorageService.delete(url!).catch(() => {})),
    );

    await prisma.vehicle.delete({ where: { id: vehicleId } });
  }

  // ---- Set as primary ----
  static async setPrimary(vehicleId: string, riderId: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw ApiError.notFound('Vehicle not found');
    }

    if (vehicle.riderId !== riderId) {
      throw ApiError.forbidden('You do not own this vehicle');
    }

    // Atomically unset all others and set new primary
    return prisma.$transaction(async (tx) => {
      await tx.vehicle.updateMany({
        where: { riderId, id: { not: vehicleId } },
        data: { isPrimary: false },
      });

      return tx.vehicle.update({
        where: { id: vehicleId },
        data: { isPrimary: true },
      });
    });
  }
}
