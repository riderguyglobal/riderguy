// ============================================================
// Sprint 12 Validators — Mentorship, Events, Rider Identity,
// Feature Requests, Spotlights
// ============================================================

import { z } from 'zod';

// ────── Mentorship ──────

export const requestMentorshipSchema = z.object({
  body: z.object({
    mentorId: z.string().min(1, 'Mentor rider profile ID is required'),
    message: z.string().max(500, 'Message too long').optional(),
  }),
});

export const updateMentorshipStatusSchema = z.object({
  body: z.object({
    status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']),
    completionNote: z.string().max(1000).optional(),
  }),
});

export const createMentorCheckInSchema = z.object({
  body: z.object({
    note: z.string().min(3, 'Note too short').max(2000, 'Note too long'),
    rating: z.number().int().min(1).max(5).optional(),
  }),
});

export const mentorSearchSchema = z.object({
  query: z.object({
    zoneId: z.string().optional(),
    minLevel: z.coerce.number().int().min(1).max(7).optional(),
    minDeliveries: z.coerce.number().int().min(0).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

// ────── Events ──────

export const createEventSchema = z.object({
  body: z.object({
    title: z.string().min(3, 'Title too short').max(200, 'Title too long'),
    description: z.string().min(10, 'Description too short').max(5000, 'Description too long'),
    type: z.enum(['IN_PERSON', 'VIRTUAL', 'HYBRID']).default('IN_PERSON'),
    date: z.string().datetime({ message: 'Valid ISO date required' }),
    endDate: z.string().datetime().optional(),
    location: z.string().max(500).optional(),
    virtualLink: z.string().url('Must be a valid URL').optional(),
    imageUrl: z.string().url().optional(),
    zoneId: z.string().optional(),
    capacity: z.number().int().min(1).optional(),
  }),
});

export const updateEventSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().min(10).max(5000).optional(),
    type: z.enum(['IN_PERSON', 'VIRTUAL', 'HYBRID']).optional(),
    status: z.enum(['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED']).optional(),
    date: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    location: z.string().max(500).optional(),
    virtualLink: z.string().url().optional(),
    imageUrl: z.string().url().optional(),
    zoneId: z.string().optional(),
    capacity: z.number().int().min(1).optional(),
  }),
});

export const listEventsSchema = z.object({
  query: z.object({
    status: z.enum(['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED']).optional(),
    zoneId: z.string().optional(),
    type: z.enum(['IN_PERSON', 'VIRTUAL', 'HYBRID']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

// ────── Feature Requests ──────

export const createFeatureRequestSchema = z.object({
  body: z.object({
    title: z.string().min(5, 'Title must be at least 5 characters').max(200, 'Title too long'),
    description: z.string().min(20, 'Description must be at least 20 characters').max(5000, 'Description too long'),
  }),
});

export const updateFeatureRequestStatusSchema = z.object({
  body: z.object({
    status: z.enum(['REVIEWED', 'PLANNED', 'IN_PROGRESS', 'SHIPPED', 'DECLINED']),
    adminNote: z.string().max(1000).optional(),
  }),
});

export const listFeatureRequestsSchema = z.object({
  query: z.object({
    status: z.enum(['SUBMITTED', 'REVIEWED', 'PLANNED', 'IN_PROGRESS', 'SHIPPED', 'DECLINED']).optional(),
    sort: z.enum(['newest', 'oldest', 'most_upvoted']).default('most_upvoted'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

// ────── Rider Profile / Identity ──────

export const updateRiderProfileSchema = z.object({
  body: z.object({
    bio: z.string().max(500, 'Bio too long').optional(),
    publicProfileUrl: z
      .string()
      .min(3, 'URL slug too short')
      .max(40, 'URL slug too long')
      .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens allowed')
      .optional(),
  }),
});

// ────── Rider Spotlight ──────

export const createSpotlightSchema = z.object({
  body: z.object({
    riderId: z.string().min(1, 'Rider profile ID is required'),
    title: z.string().min(3, 'Title too short').max(200, 'Title too long'),
    story: z.string().min(50, 'Story must be at least 50 characters').max(5000, 'Story too long'),
    imageUrl: z.string().url().optional(),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2024).max(2100),
  }),
});

export const updateSpotlightSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(200).optional(),
    story: z.string().min(50).max(5000).optional(),
    imageUrl: z.string().url().optional(),
    isFeatured: z.boolean().optional(),
  }),
});
