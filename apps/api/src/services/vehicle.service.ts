// ============================================================
// VehicleService — Vehicle registration and management
// ============================================================

import { prisma } from '@riderguy/database';
import { normalizeVehiclePlateNumber } from '@riderguy/validators';
import { ApiError } from '../lib/api-error';
import { acquireTransactionAdvisoryLock } from '../lib/postgres-advisory-lock';
import { logger } from '../lib/logger';
import { StorageService } from './storage.service';
import type { Prisma, VehicleType } from '@prisma/client';
import { AdminAuditService, type AdminAuditContext } from './admin-audit.service';

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

export type UpdateVehicleInput = Partial<
  Pick<RegisterVehicleInput, 'type' | 'make' | 'model' | 'year' | 'color' | 'plateNumber'>
>;

export interface VehiclePhotoInput {
  vehicleId: string;
  riderId: string;
  position: 'front' | 'back' | 'left' | 'right';
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

export interface ReviewVehicleInput {
  vehicleId: string;
  riderUserId: string;
  reviewerUserId: string;
  status: 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  auditContext?: AdminAuditContext;
}

type VehiclePhotoField = 'photoFrontUrl' | 'photoBackUrl' | 'photoLeftUrl' | 'photoRightUrl';

const resetVehicleReviewData = {
  isApproved: false,
  reviewStatus: 'PENDING' as const,
  rejectionReason: null,
  reviewedById: null,
  reviewedAt: null,
};

async function takeRiderOfflineIfNoApprovedVehicle(
  tx: Prisma.TransactionClient,
  riderId: string,
): Promise<void> {
  const approvedVehicleCount = await tx.vehicle.count({
    where: { riderId, reviewStatus: 'APPROVED' },
  });
  if (approvedVehicleCount > 0) return;

  // Do not interrupt an in-progress delivery. Every path that offers or assigns
  // new work independently checks the approved-vehicle relationship.
  await tx.riderProfile.updateMany({
    where: { id: riderId, availability: { not: 'ON_DELIVERY' } },
    data: { availability: 'OFFLINE' },
  });
}

// --------------- service class ----------------------------------------

export class VehicleService {
  // ---- Register a vehicle ----
  static async register(input: RegisterVehicleInput) {
    const plateNumber = normalizeVehiclePlateNumber(input.plateNumber);
    return prisma.$transaction(async (tx) => {
      await acquireTransactionAdvisoryLock(tx, 'rider-vehicle-state', input.riderId);

      const rider = await tx.riderProfile.findUnique({ where: { id: input.riderId } });
      if (!rider) throw ApiError.notFound('Rider profile not found');

      // This lock makes the duplicate check + write atomic without deploying a
      // unique constraint that could fail on unknown historical duplicates.
      await acquireTransactionAdvisoryLock(tx, 'vehicle-plate', plateNumber);
      const existingPlate = await tx.vehicle.findFirst({
        where: { plateNumber: { equals: plateNumber, mode: 'insensitive' } },
      });
      if (existingPlate) {
        throw ApiError.conflict('A vehicle with this plate number is already registered.');
      }

      const vehicleCount = await tx.vehicle.count({ where: { riderId: input.riderId } });
      return tx.vehicle.create({
        data: {
          riderId: input.riderId,
          type: input.type,
          make: input.make,
          model: input.model,
          year: input.year ?? null,
          color: input.color ?? null,
          plateNumber,
          isPrimary: vehicleCount === 0,
        },
      });
    });
  }

  // ---- Upload vehicle photo ----
  static async uploadPhoto(input: VehiclePhotoInput) {
    if (!StorageService.isAllowedImageType(input.mimeType)) {
      throw ApiError.badRequest(
        'Invalid file type. Allowed: JPEG, PNG, WebP.',
        'INVALID_FILE_TYPE',
      );
    }

    const initialVehicle = await prisma.vehicle.findUnique({
      where: { id: input.vehicleId },
      include: { rider: { select: { userId: true } } },
    });

    if (!initialVehicle) {
      throw ApiError.notFound('Vehicle not found');
    }

    if (initialVehicle.riderId !== input.riderId) {
      throw ApiError.forbidden('You do not own this vehicle');
    }

    const result = await StorageService.upload(
      input.buffer,
      input.originalName,
      input.mimeType,
      StorageService.ownerFolder('vehicles', initialVehicle.rider.userId),
    );

    const fieldMap: Record<VehiclePhotoInput['position'], VehiclePhotoField> = {
      front: 'photoFrontUrl',
      back: 'photoBackUrl',
      left: 'photoLeftUrl',
      right: 'photoRightUrl',
    };
    const field = fieldMap[input.position];
    let oldUrl: string | null = null;

    try {
      const updated = await prisma.$transaction(async (tx) => {
        await acquireTransactionAdvisoryLock(tx, 'vehicle-review', input.vehicleId);
        const vehicle = await tx.vehicle.findUnique({ where: { id: input.vehicleId } });
        if (!vehicle) throw ApiError.notFound('Vehicle not found');
        if (vehicle.riderId !== input.riderId) {
          throw ApiError.forbidden('You do not own this vehicle');
        }

        await acquireTransactionAdvisoryLock(tx, 'rider-vehicle-state', vehicle.riderId);
        oldUrl = vehicle[field];
        const saved = await tx.vehicle.update({
          where: { id: input.vehicleId },
          // A new photo is unreviewed evidence even when the prior decision was
          // already pending or rejected.
          data: { [field]: result.url, ...resetVehicleReviewData },
        });
        await takeRiderOfflineIfNoApprovedVehicle(tx, vehicle.riderId);
        return saved;
      });

      // The database now references the new object. Failure to remove the old
      // object creates only a harmless orphan, never a broken live reference.
      if (oldUrl && oldUrl !== result.url) {
        await StorageService.delete(oldUrl).catch((error) => {
          logger.warn({ error, oldUrl, vehicleId: input.vehicleId }, 'Old vehicle photo cleanup failed');
        });
      }
      return updated;
    } catch (error) {
      // The transaction did not adopt the new object, so clean it up and leave
      // the still-referenced old object untouched.
      await StorageService.delete(result.url).catch((cleanupError) => {
        logger.warn(
          { error: cleanupError, url: result.url, vehicleId: input.vehicleId },
          'Uncommitted vehicle photo cleanup failed',
        );
      });
      throw error;
    }
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
    data: UpdateVehicleInput,
  ) {
    // Keep a service-boundary allowlist as defense in depth. TypeScript types do
    // not exist at runtime, so an internal caller could otherwise pass protected
    // Prisma fields such as riderId, isApproved, or photo URLs.
    const editableData: UpdateVehicleInput = {};
    if (data.type !== undefined) editableData.type = data.type;
    if (data.make !== undefined) editableData.make = data.make;
    if (data.model !== undefined) editableData.model = data.model;
    if (data.year !== undefined) editableData.year = data.year;
    if (data.color !== undefined) editableData.color = data.color;
    if (data.plateNumber !== undefined) {
      editableData.plateNumber = normalizeVehiclePlateNumber(data.plateNumber);
    }

    if (Object.keys(editableData).length === 0) {
      throw ApiError.badRequest('At least one editable vehicle field is required.');
    }

    return prisma.$transaction(async (tx) => {
      await acquireTransactionAdvisoryLock(tx, 'vehicle-review', vehicleId);
      const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } });
      if (!vehicle) throw ApiError.notFound('Vehicle not found');
      if (vehicle.riderId !== riderId) throw ApiError.forbidden('You do not own this vehicle');

      await acquireTransactionAdvisoryLock(tx, 'rider-vehicle-state', vehicle.riderId);
      const plateChanged = editableData.plateNumber !== undefined
        && normalizeVehiclePlateNumber(vehicle.plateNumber) !== editableData.plateNumber;
      if (plateChanged) {
        await acquireTransactionAdvisoryLock(tx, 'vehicle-plate', editableData.plateNumber!);
        const duplicate = await tx.vehicle.findFirst({
          where: {
            id: { not: vehicleId },
            plateNumber: { equals: editableData.plateNumber!, mode: 'insensitive' },
          },
        });
        if (duplicate) {
          throw ApiError.conflict('A vehicle with this plate number is already registered.');
        }
      }

      const materialDetailsChanged = (
        (editableData.type !== undefined && editableData.type !== vehicle.type)
        || (editableData.make !== undefined && editableData.make !== vehicle.make)
        || (editableData.model !== undefined && editableData.model !== vehicle.model)
        || (editableData.year !== undefined && editableData.year !== vehicle.year)
        || (editableData.color !== undefined && editableData.color !== vehicle.color)
        || plateChanged
      );

      const updated = await tx.vehicle.update({
        where: { id: vehicleId },
        data: { ...editableData, ...(materialDetailsChanged ? resetVehicleReviewData : {}) },
      });
      if (materialDetailsChanged) {
        await takeRiderOfflineIfNoApprovedVehicle(tx, vehicle.riderId);
      }
      return updated;
    });
  }

  // ---- Admin review ----
  static async review(input: ReviewVehicleInput) {
    const rejectionReason = input.rejectionReason?.trim();
    if (input.status !== 'APPROVED' && input.status !== 'REJECTED') {
      throw ApiError.badRequest('Vehicle review status must be APPROVED or REJECTED.');
    }
    if (input.status === 'REJECTED' && (!rejectionReason || rejectionReason.length < 5)) {
      throw ApiError.badRequest('A rejection reason of at least 5 characters is required.');
    }
    if (input.status === 'APPROVED' && rejectionReason) {
      throw ApiError.badRequest('A rejection reason is only allowed when rejecting a vehicle.');
    }

    return prisma.$transaction(async (tx) => {
      await acquireTransactionAdvisoryLock(tx, 'vehicle-review', input.vehicleId);
      const vehicle = await tx.vehicle.findUnique({
        where: { id: input.vehicleId },
        include: { rider: { select: { userId: true } } },
      });

      // Use the same response for a missing vehicle and a mismatched Rider to
      // prevent cross-application vehicle enumeration.
      if (!vehicle || vehicle.rider.userId !== input.riderUserId) {
        throw ApiError.notFound('Vehicle not found for this Rider');
      }

      await acquireTransactionAdvisoryLock(tx, 'rider-vehicle-state', vehicle.riderId);
      if (input.status === 'APPROVED') {
        const missingPhotos = [
          ['front', vehicle.photoFrontUrl],
          ['back', vehicle.photoBackUrl],
          ['left', vehicle.photoLeftUrl],
          ['right', vehicle.photoRightUrl],
        ].filter(([, url]) => !url).map(([position]) => position);

        if (missingPhotos.length > 0) {
          throw ApiError.badRequest(
            'Front, back, left, and right vehicle photos are required before approval.',
            'VEHICLE_PHOTOS_INCOMPLETE',
            { missingPhotos },
          );
        }
      }

      const reviewed = await tx.vehicle.update({
        where: { id: input.vehicleId },
        data: {
          isApproved: input.status === 'APPROVED',
          reviewStatus: input.status,
          rejectionReason: input.status === 'REJECTED' ? rejectionReason! : null,
          reviewedById: input.reviewerUserId,
          reviewedAt: new Date(),
        },
      });
      if (input.status === 'REJECTED') {
        await takeRiderOfflineIfNoApprovedVehicle(tx, vehicle.riderId);
      }
      await AdminAuditService.record({
        actorUserId: input.reviewerUserId,
        ipAddress: input.auditContext?.ipAddress,
        userAgent: input.auditContext?.userAgent,
        action: input.status === 'APPROVED' ? 'rider_vehicle.approved' : 'rider_vehicle.rejected',
        entityType: 'Vehicle',
        entityId: vehicle.id,
        oldData: {
          riderUserId: input.riderUserId,
          reviewStatus: vehicle.reviewStatus,
          rejectionReason: vehicle.rejectionReason,
          reviewedById: vehicle.reviewedById,
          reviewedAt: vehicle.reviewedAt,
        },
        newData: {
          riderUserId: input.riderUserId,
          reviewStatus: reviewed.reviewStatus,
          rejectionReason: reviewed.rejectionReason,
          reviewedById: reviewed.reviewedById,
          reviewedAt: reviewed.reviewedAt,
        },
      }, tx);
      return reviewed;
    });
  }

  // ---- Delete a vehicle ----
  static async remove(vehicleId: string, riderId: string) {
    const urls = await prisma.$transaction(async (tx) => {
      await acquireTransactionAdvisoryLock(tx, 'vehicle-review', vehicleId);
      const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } });
      if (!vehicle) throw ApiError.notFound('Vehicle not found');
      if (vehicle.riderId !== riderId) throw ApiError.forbidden('You do not own this vehicle');

      await acquireTransactionAdvisoryLock(tx, 'rider-vehicle-state', vehicle.riderId);
      await tx.vehicle.delete({ where: { id: vehicleId } });
      await takeRiderOfflineIfNoApprovedVehicle(tx, vehicle.riderId);
      return [vehicle.photoFrontUrl, vehicle.photoBackUrl, vehicle.photoLeftUrl, vehicle.photoRightUrl];
    });

    // Delete blobs only after the row is gone. A storage failure leaves an
    // orphan for later cleanup, never a live database reference to a missing file.
    await Promise.all(
      urls.filter(Boolean).map((url) => StorageService.delete(url!).catch(() => {})),
    );
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

    // Clear all other vehicles, then set new primary
    await prisma.vehicle.updateMany({
      where: { riderId, id: { not: vehicleId } },
      data: { isPrimary: false },
    });

    return prisma.vehicle.update({
      where: { id: vehicleId },
      data: { isPrimary: true },
    });
  }
}
