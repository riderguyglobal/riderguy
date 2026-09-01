import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  executeRawMock,
  riderProfileMock,
  storageMock,
  transactionMock,
  vehicleMock,
} = vi.hoisted(() => {
  const riderProfileMock = { findUnique: vi.fn(), updateMany: vi.fn() };
  const vehicleMock = {
    count: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  };
  const executeRawMock = vi.fn().mockResolvedValue(1);
  const transactionClient = {
    $executeRaw: executeRawMock,
    riderProfile: riderProfileMock,
    vehicle: vehicleMock,
  };
  return {
    executeRawMock,
    riderProfileMock,
    storageMock: {
    isAllowedImageType: vi.fn(),
    upload: vi.fn(),
    ownerFolder: vi.fn(),
    delete: vi.fn(),
    },
    transactionMock: vi.fn(async (callback: (tx: typeof transactionClient) => unknown) => callback(transactionClient)),
    vehicleMock,
  };
});

vi.mock('@riderguy/database', () => ({
  prisma: {
    $transaction: transactionMock,
    riderProfile: riderProfileMock,
    vehicle: vehicleMock,
  },
}));

vi.mock('./storage.service', () => ({ StorageService: storageMock }));

import { VehicleService } from './vehicle.service';

describe('VehicleService.register plate integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    riderProfileMock.findUnique.mockResolvedValue({ id: 'rider-1' });
    vehicleMock.findFirst.mockResolvedValue(null);
    vehicleMock.count.mockResolvedValue(0);
    vehicleMock.create.mockResolvedValue({ id: 'vehicle-1' });
  });

  it('canonicalizes plates before duplicate lookup and persistence', async () => {
    await VehicleService.register({
      riderId: 'rider-1',
      type: 'MOTORCYCLE',
      make: 'Honda',
      model: 'CB 125',
      plateNumber: ' gr 1234 - 25 ',
    });

    expect(vehicleMock.findFirst).toHaveBeenCalledWith({
      where: { plateNumber: { equals: 'GR-1234-25', mode: 'insensitive' } },
    });
    expect(vehicleMock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ plateNumber: 'GR-1234-25' }),
    });
    expect(executeRawMock).toHaveBeenCalledTimes(2);
  });
});

describe('VehicleService.update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vehicleMock.findFirst.mockResolvedValue(null);
    vehicleMock.findUnique.mockResolvedValue({
      id: 'vehicle-1',
      riderId: 'rider-1',
      type: 'MOTORCYCLE',
      make: 'Existing make',
      model: 'Existing model',
      year: 2020,
      color: 'Black',
      plateNumber: 'GT-0001-20',
      isApproved: false,
      reviewStatus: 'PENDING',
    });
    vehicleMock.update.mockResolvedValue({
      id: 'vehicle-1',
      riderId: 'rider-1',
      make: 'Honda',
    });
  });

  it('passes legitimate editable fields to Prisma', async () => {
    await VehicleService.update('vehicle-1', 'rider-1', {
      type: 'MOTORCYCLE',
      make: 'Honda',
      model: 'CB 125',
      year: 2025,
      color: 'Green',
      plateNumber: 'GR-1234-25',
    });

    expect(vehicleMock.update).toHaveBeenCalledWith({
      where: { id: 'vehicle-1' },
      data: expect.objectContaining({
        type: 'MOTORCYCLE',
        make: 'Honda',
        model: 'CB 125',
        year: 2025,
        color: 'Green',
        plateNumber: 'GR-1234-25',
        isApproved: false,
        reviewStatus: 'PENDING',
      }),
    });
  });

  it('drops protected fields even when a caller bypasses request validation', async () => {
    await VehicleService.update('vehicle-1', 'rider-1', {
      make: 'Honda',
      riderId: 'other-rider',
      isApproved: true,
      isPrimary: true,
      photoFrontUrl: 'https://attacker.example/vehicle.jpg',
    } as never);

    expect(vehicleMock.update).toHaveBeenCalledWith({
      where: { id: 'vehicle-1' },
      data: expect.objectContaining({ make: 'Honda', isApproved: false, reviewStatus: 'PENDING' }),
    });
  });

  it('rejects a bypass attempt containing only protected fields', async () => {
    await expect(VehicleService.update('vehicle-1', 'rider-1', {
      riderId: 'other-rider',
      isApproved: true,
    } as never)).rejects.toMatchObject({ statusCode: 400 });

    expect(vehicleMock.update).not.toHaveBeenCalled();
  });

  it('resets approval when an approved material detail changes', async () => {
    vehicleMock.findUnique.mockResolvedValue({
      id: 'vehicle-1',
      riderId: 'rider-1',
      type: 'MOTORCYCLE',
      make: 'Honda',
      model: 'CB 125',
      year: 2024,
      color: 'Green',
      plateNumber: 'GR-1234-25',
      isApproved: true,
      reviewStatus: 'APPROVED',
    });

    await VehicleService.update('vehicle-1', 'rider-1', { color: 'Black' });

    expect(vehicleMock.update).toHaveBeenCalledWith({
      where: { id: 'vehicle-1' },
      data: expect.objectContaining({ color: 'Black', isApproved: false, reviewStatus: 'PENDING' }),
    });
  });

  it('keeps approval when a normalized edit does not change the reviewed value', async () => {
    vehicleMock.findUnique.mockResolvedValue({
      id: 'vehicle-1',
      riderId: 'rider-1',
      type: 'MOTORCYCLE',
      make: 'Honda',
      model: 'CB 125',
      year: 2024,
      color: 'Green',
      plateNumber: 'GR-1234-25',
      isApproved: true,
      reviewStatus: 'APPROVED',
    });

    await VehicleService.update('vehicle-1', 'rider-1', { plateNumber: 'gr 1234 25' });

    expect(vehicleMock.findFirst).not.toHaveBeenCalled();
    expect(vehicleMock.update).toHaveBeenCalledWith({
      where: { id: 'vehicle-1' },
      data: { plateNumber: 'GR-1234-25' },
    });
  });

  it('rejects another vehicle with the same canonical plate number', async () => {
    vehicleMock.findUnique.mockResolvedValue({
      id: 'vehicle-1',
      riderId: 'rider-1',
      plateNumber: 'GT-9876-25',
      isApproved: false,
      reviewStatus: 'PENDING',
    });
    vehicleMock.findFirst.mockResolvedValue({ id: 'vehicle-2' });

    await expect(VehicleService.update('vehicle-1', 'rider-1', {
      plateNumber: 'gr 1234 25',
    })).rejects.toMatchObject({ statusCode: 409 });

    expect(vehicleMock.findFirst).toHaveBeenCalledWith({
      where: {
        id: { not: 'vehicle-1' },
        plateNumber: { equals: 'GR-1234-25', mode: 'insensitive' },
      },
    });
    expect(vehicleMock.update).not.toHaveBeenCalled();
  });
});

describe('VehicleService.uploadPhoto approval integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMock.isAllowedImageType.mockReturnValue(true);
    storageMock.ownerFolder.mockReturnValue('vehicles/rider-user-1');
    storageMock.upload.mockResolvedValue({ url: 'https://cdn.example/new-front.jpg' });
    storageMock.delete.mockResolvedValue(undefined);
    vehicleMock.findUnique.mockResolvedValue({
      id: 'vehicle-1',
      riderId: 'rider-profile-1',
      rider: { userId: 'rider-user-1' },
      photoFrontUrl: 'https://cdn.example/old-front.jpg',
      isApproved: true,
      reviewStatus: 'APPROVED',
    });
    vehicleMock.update.mockResolvedValue({ id: 'vehicle-1', isApproved: false });
  });

  it('resets approval whenever reviewed photo evidence is replaced', async () => {
    await VehicleService.uploadPhoto({
      vehicleId: 'vehicle-1',
      riderId: 'rider-profile-1',
      position: 'front',
      buffer: Buffer.from('image'),
      originalName: 'front.jpg',
      mimeType: 'image/jpeg',
    });

    expect(vehicleMock.update).toHaveBeenCalledWith({
      where: { id: 'vehicle-1' },
      data: {
        photoFrontUrl: 'https://cdn.example/new-front.jpg',
        isApproved: false,
        reviewStatus: 'PENDING',
        rejectionReason: null,
        reviewedById: null,
        reviewedAt: null,
      },
    });
  });
});

describe('VehicleService.review', () => {
  const completeVehicle = {
    id: 'vehicle-1',
    riderId: 'rider-profile-1',
    rider: { userId: 'rider-user-1' },
    photoFrontUrl: 'front.jpg',
    photoBackUrl: 'back.jpg',
    photoLeftUrl: 'left.jpg',
    photoRightUrl: 'right.jpg',
    isApproved: false,
    reviewStatus: 'PENDING',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vehicleMock.findUnique.mockResolvedValue(completeVehicle);
    vehicleMock.update.mockResolvedValue({ ...completeVehicle, isApproved: true });
  });

  it('approves only a complete vehicle belonging to the target Rider', async () => {
    await VehicleService.review({
      vehicleId: 'vehicle-1',
      riderUserId: 'rider-user-1',
      reviewerUserId: 'admin-user-1',
      status: 'APPROVED',
    });

    expect(vehicleMock.update).toHaveBeenCalledWith({
      where: { id: 'vehicle-1' },
      data: {
        isApproved: true,
        reviewStatus: 'APPROVED',
        rejectionReason: null,
        reviewedById: 'admin-user-1',
        reviewedAt: expect.any(Date),
      },
    });
  });

  it('does not reveal a vehicle associated with a different Rider application', async () => {
    await expect(VehicleService.review({
      vehicleId: 'vehicle-1',
      riderUserId: 'another-rider-user',
      reviewerUserId: 'admin-user-1',
      status: 'APPROVED',
    })).rejects.toMatchObject({ statusCode: 404 });

    expect(vehicleMock.update).not.toHaveBeenCalled();
  });

  it('blocks approval and identifies every missing required photo', async () => {
    vehicleMock.findUnique.mockResolvedValue({
      ...completeVehicle,
      photoBackUrl: null,
      photoRightUrl: null,
    });

    await expect(VehicleService.review({
      vehicleId: 'vehicle-1',
      riderUserId: 'rider-user-1',
      reviewerUserId: 'admin-user-1',
      status: 'APPROVED',
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'VEHICLE_PHOTOS_INCOMPLETE',
      details: { missingPhotos: ['back', 'right'] },
    });

    expect(vehicleMock.update).not.toHaveBeenCalled();
  });

  it('allows an admin to reject or revoke approval even if photos are incomplete', async () => {
    vehicleMock.findUnique.mockResolvedValue({
      ...completeVehicle,
      photoRightUrl: null,
      isApproved: true,
    });

    await VehicleService.review({
      vehicleId: 'vehicle-1',
      riderUserId: 'rider-user-1',
      reviewerUserId: 'admin-user-1',
      status: 'REJECTED',
      rejectionReason: 'Right-side photo is missing',
    });

    expect(vehicleMock.update).toHaveBeenCalledWith({
      where: { id: 'vehicle-1' },
      data: {
        isApproved: false,
        reviewStatus: 'REJECTED',
        rejectionReason: 'Right-side photo is missing',
        reviewedById: 'admin-user-1',
        reviewedAt: expect.any(Date),
      },
    });
  });
});
