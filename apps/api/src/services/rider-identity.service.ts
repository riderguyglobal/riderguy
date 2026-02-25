// ============================================================
// Rider Identity Service — Sprint 12
// Profile upgrade, public card, spotlights
// ============================================================

import { prisma } from '@riderguy/database';
import { logger } from '../lib/logger';
import { ApiError } from '../lib/api-error';

// ────── Update Rider Profile (bio, publicProfileUrl) ──────

export async function updateRiderIdentity(
  userId: string,
  data: { bio?: string; publicProfileUrl?: string },
) {
  const rider = await prisma.riderProfile.findUnique({ where: { userId } });
  if (!rider) throw ApiError.notFound('Rider profile not found');

  // Check uniqueness of publicProfileUrl
  if (data.publicProfileUrl) {
    const existing = await prisma.riderProfile.findUnique({
      where: { publicProfileUrl: data.publicProfileUrl },
    });
    if (existing && existing.id !== rider.id) {
      throw ApiError.conflict('This profile URL is already taken');
    }
  }

  const updated = await prisma.riderProfile.update({
    where: { userId },
    data: {
      ...(data.bio !== undefined && { bio: data.bio }),
      ...(data.publicProfileUrl !== undefined && { publicProfileUrl: data.publicProfileUrl }),
    },
    select: {
      id: true,
      userId: true,
      bio: true,
      publicProfileUrl: true,
      currentLevel: true,
      totalDeliveries: true,
      averageRating: true,
      totalRatings: true,
      user: { select: { firstName: true, lastName: true, avatarUrl: true } },
      currentZone: { select: { id: true, name: true } },
    },
  });

  logger.info(`Rider ${userId} updated identity`);
  return updated;
}

// ────── Get Public Rider Card ──────

export async function getPublicRiderCard(slug: string) {
  const rider = await prisma.riderProfile.findUnique({
    where: { publicProfileUrl: slug },
    select: {
      id: true,
      bio: true,
      publicProfileUrl: true,
      currentLevel: true,
      totalDeliveries: true,
      averageRating: true,
      totalRatings: true,
      completionRate: true,
      onTimeRate: true,
      createdAt: true,
      user: { select: { firstName: true, lastName: true, avatarUrl: true } },
      currentZone: { select: { id: true, name: true } },
      badges: {
        take: 6,
        orderBy: { awardedAt: 'desc' },
        include: { badge: { select: { name: true, description: true, icon: true } } },
      },
      spotlights: {
        where: { isFeatured: true },
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: { title: true, month: true, year: true },
      },
    },
  });
  if (!rider) throw ApiError.notFound('Rider not found');

  return rider;
}

// ────── Get rider identity (own profile) ──────

export async function getMyRiderIdentity(userId: string) {
  const rider = await prisma.riderProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      bio: true,
      publicProfileUrl: true,
      currentLevel: true,
      totalDeliveries: true,
      averageRating: true,
      totalRatings: true,
      completionRate: true,
      onTimeRate: true,
      createdAt: true,
      user: { select: { firstName: true, lastName: true, avatarUrl: true } },
      currentZone: { select: { id: true, name: true } },
      badges: {
        take: 10,
        orderBy: { awardedAt: 'desc' },
        include: { badge: { select: { name: true, description: true, icon: true } } },
      },
    },
  });
  if (!rider) throw ApiError.notFound('Rider profile not found');
  return rider;
}

// ────── Spotlights (Rider of the Month) ──────

export async function createSpotlight(data: {
  riderId: string;
  title: string;
  story: string;
  imageUrl?: string;
  month: number;
  year: number;
}) {
  // Check rider exists
  const rider = await prisma.riderProfile.findUnique({ where: { id: data.riderId } });
  if (!rider) throw ApiError.notFound('Rider not found');

  // Check if spotlight for this month already exists
  const existing = await prisma.riderSpotlight.findUnique({
    where: { month_year: { month: data.month, year: data.year } },
  });
  if (existing) throw ApiError.conflict(`Spotlight for ${data.month}/${data.year} already exists`);

  const spotlight = await prisma.riderSpotlight.create({
    data: {
      riderId: data.riderId,
      title: data.title,
      story: data.story,
      imageUrl: data.imageUrl,
      month: data.month,
      year: data.year,
    },
    include: {
      rider: {
        select: {
          user: { select: { firstName: true, lastName: true, avatarUrl: true } },
          currentLevel: true,
          totalDeliveries: true,
          averageRating: true,
        },
      },
    },
  });

  logger.info(`Spotlight created for rider ${data.riderId}: ${data.month}/${data.year}`);
  return spotlight;
}

export async function updateSpotlight(
  spotlightId: string,
  data: { title?: string; story?: string; imageUrl?: string; isFeatured?: boolean },
) {
  const spotlight = await prisma.riderSpotlight.findUnique({ where: { id: spotlightId } });
  if (!spotlight) throw ApiError.notFound('Spotlight not found');

  return prisma.riderSpotlight.update({
    where: { id: spotlightId },
    data,
    include: {
      rider: {
        select: {
          user: { select: { firstName: true, lastName: true, avatarUrl: true } },
          currentLevel: true,
        },
      },
    },
  });
}

export async function listSpotlights(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [spotlights, total] = await Promise.all([
    prisma.riderSpotlight.findMany({
      where: { isFeatured: true },
      skip,
      take: limit,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        rider: {
          select: {
            id: true,
            publicProfileUrl: true,
            user: { select: { firstName: true, lastName: true, avatarUrl: true } },
            currentLevel: true,
            totalDeliveries: true,
            averageRating: true,
          },
        },
      },
    }),
    prisma.riderSpotlight.count({ where: { isFeatured: true } }),
  ]);

  return { spotlights, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getLatestSpotlight() {
  const spotlight = await prisma.riderSpotlight.findFirst({
    where: { isFeatured: true },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: {
      rider: {
        select: {
          id: true,
          publicProfileUrl: true,
          user: { select: { firstName: true, lastName: true, avatarUrl: true } },
          currentLevel: true,
          totalDeliveries: true,
          averageRating: true,
          currentZone: { select: { name: true } },
        },
      },
    },
  });

  return spotlight;
}
