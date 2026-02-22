// ============================================================
// ZoneService — Delivery zone management (admin-only)
//
// Zones define geographic regions with their own base fares,
// per-km rates, surge multipliers, and commission rates.
// The polygon is stored as GeoJSON in a Json column.
// ============================================================

import { prisma } from '@riderguy/database';
import type { Prisma } from '@riderguy/database';
import { ApiError } from '../lib/api-error';

// --------------- types ------------------------------------------------

export interface CreateZoneInput {
  name: string;
  polygon: Array<{ lat: number; lng: number }>;
  centerLatitude: number;
  centerLongitude: number;
  baseFare: number;
  perKmRate: number;
  minimumFare: number;
  surgeMultiplier?: number;
  commissionRate?: number;
  currency?: string;
}

export type UpdateZoneInput = Partial<CreateZoneInput> & { status?: string };

// --------------- service class ----------------------------------------

export class ZoneService {
  // ---- Create a zone ----
  static async create(input: CreateZoneInput) {
    // Ensure no duplicate zone names
    const existing = await prisma.zone.findFirst({
      where: { name: input.name },
    });

    if (existing) {
      throw ApiError.conflict('A zone with this name already exists');
    }

    return prisma.zone.create({
      data: {
        name: input.name,
        polygon: input.polygon as unknown as Prisma.InputJsonValue,
        centerLatitude: input.centerLatitude,
        centerLongitude: input.centerLongitude,
        baseFare: input.baseFare,
        perKmRate: input.perKmRate,
        minimumFare: input.minimumFare,
        surgeMultiplier: input.surgeMultiplier ?? 1.0,
        commissionRate: input.commissionRate ?? 15,
        currency: input.currency ?? 'GHS',
        status: 'ACTIVE',
      },
    });
  }

  // ---- Update a zone ----
  static async update(zoneId: string, input: UpdateZoneInput) {
    const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
    if (!zone) throw ApiError.notFound('Zone not found');

    // Build update payload — only include provided fields
    const data: Prisma.ZoneUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.polygon !== undefined) data.polygon = input.polygon as unknown as Prisma.InputJsonValue;
    if (input.centerLatitude !== undefined) data.centerLatitude = input.centerLatitude;
    if (input.centerLongitude !== undefined) data.centerLongitude = input.centerLongitude;
    if (input.baseFare !== undefined) data.baseFare = input.baseFare;
    if (input.perKmRate !== undefined) data.perKmRate = input.perKmRate;
    if (input.minimumFare !== undefined) data.minimumFare = input.minimumFare;
    if (input.surgeMultiplier !== undefined) data.surgeMultiplier = input.surgeMultiplier;
    if (input.commissionRate !== undefined) data.commissionRate = input.commissionRate;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.status !== undefined) data.status = input.status as Prisma.ZoneUpdateInput['status'];

    return prisma.zone.update({ where: { id: zoneId }, data });
  }

  // ---- List all zones ----
  static async list(status?: string) {
    const where: Prisma.ZoneWhereInput = {};
    if (status) {
      where.status = status as Prisma.ZoneWhereInput['status'];
    }

    return prisma.zone.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  // ---- Get zone by ID ----
  static async getById(zoneId: string) {
    return prisma.zone.findUnique({ where: { id: zoneId } });
  }

  // ---- Delete (soft — set status to INACTIVE) ----
  static async deactivate(zoneId: string) {
    const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
    if (!zone) throw ApiError.notFound('Zone not found');

    return prisma.zone.update({
      where: { id: zoneId },
      data: { status: 'INACTIVE' },
    });
  }

  // ---- Activate ----
  static async activate(zoneId: string) {
    const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
    if (!zone) throw ApiError.notFound('Zone not found');

    return prisma.zone.update({
      where: { id: zoneId },
      data: { status: 'ACTIVE' },
    });
  }

  // ---- Update surge multiplier (shortcut for real-time ops) ----
  static async updateSurge(zoneId: string, surgeMultiplier: number) {
    if (surgeMultiplier < 1 || surgeMultiplier > 5) {
      throw ApiError.badRequest('Surge multiplier must be between 1.0 and 5.0');
    }

    const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
    if (!zone) throw ApiError.notFound('Zone not found');

    return prisma.zone.update({
      where: { id: zoneId },
      data: { surgeMultiplier },
    });
  }

  // ---- Find zone for a given lat/lng coordinate ----
  // NOTE: Uses simple point-in-polygon (ray casting).
  // For production, consider PostGIS or a geo library.
  static async findZoneForPoint(lat: number, lng: number) {
    const zones = await prisma.zone.findMany({
      where: { status: 'ACTIVE' },
    });

    for (const zone of zones) {
      const polygon = zone.polygon as unknown as Array<{ lat: number; lng: number }>;
      if (polygon && ZoneService.isPointInPolygon(lat, lng, polygon)) {
        return zone;
      }
    }

    return null;
  }

  // ---- Ray-casting point-in-polygon test ----
  private static isPointInPolygon(
    lat: number,
    lng: number,
    polygon: Array<{ lat: number; lng: number }>,
  ): boolean {
    let inside = false;
    const n = polygon.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const pi = polygon[i]!;
      const pj = polygon[j]!;

      const intersect =
        pi.lat > lat !== pj.lat > lat &&
        lng < ((pj.lng - pi.lng) * (lat - pi.lat)) / (pj.lat - pi.lat) + pi.lng;

      if (intersect) inside = !inside;
    }

    return inside;
  }
}
