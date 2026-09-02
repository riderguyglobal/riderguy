import { z } from 'zod';
import { latitudeSchema, longitudeSchema, phoneSchema } from './common';

export const updateAvailabilitySchema = z.object({
  // ON_DELIVERY is dispatch-owned. ON_BREAK has no implemented server
  // transition, so neither state is accepted from a public client.
  availability: z.enum(['OFFLINE', 'ONLINE']),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.availability !== 'ONLINE') return;
  if (value.latitude === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['latitude'], message: 'Current latitude is required to go online' });
  }
  if (value.longitude === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['longitude'], message: 'Current longitude is required to go online' });
  }
});

export const updateLocationSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});

export const selectRiderChannelSchema = z.object({
  channel: z.enum(['GUEST', 'IN_HOUSE']),
  invitationCode: z.string().trim().min(8).max(80).optional(),
});

export const createInHouseInvitationSchema = z.object({
  email: z.string().trim().email().optional(),
  phone: phoneSchema.optional(),
  expiresInDays: z.coerce.number().int().min(1).max(30).optional(),
}).refine((value) => Boolean(value.email || value.phone), {
  message: 'An email address or phone number is required',
});

export const rejectRiderApplicationSchema = z.object({
  reason: z.string().trim().min(5, 'A meaningful rejection reason is required').max(500),
});

export const adminClassifyRiderChannelSchema = z.object({
  channel: z.enum(['GUEST', 'IN_HOUSE']),
});

export const riderOperationsQueues = [
  'ALL',
  'PENDING',
  'ACTION_REQUIRED',
  'READY',
  'BLOCKED',
  'REJECTED',
  'ACTIVATED',
] as const;

export const riderOnboardingStatuses = [
  'REGISTERED',
  'DOCUMENTS_PENDING',
  'DOCUMENTS_SUBMITTED',
  'DOCUMENTS_UNDER_REVIEW',
  'DOCUMENTS_APPROVED',
  'DOCUMENTS_REJECTED',
  'TRAINING_PENDING',
  'TRAINING_COMPLETE',
  'APPLICATION_REJECTED',
  'ACTIVATED',
] as const;

/** Strict, bounded filters for the consolidated Rider Operations queue. */
export const listRiderOperationsCasesQuerySchema = z.object({
  queue: z.enum(riderOperationsQueues).default('PENDING'),
  status: z.enum(riderOnboardingStatuses).optional(),
  channel: z.enum(['GUEST', 'IN_HOUSE', 'UNCLASSIFIED']).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const listRiderAuditHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
}).strict();

export const revokeInHouseInvitationSchema = z.object({
  reason: z.string().trim().min(5, 'A meaningful revocation reason is required').max(500),
}).strict();

export const reviewTrainingModuleSchema = z.object({
  decision: z.enum(['VERIFIED', 'REVOKED']),
  reason: z.string().trim().min(5).max(500).optional(),
}).strict().superRefine((data, context) => {
  if (data.decision === 'REVOKED' && !data.reason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reason'],
      message: 'A meaningful reason is required when revoking training verification',
    });
  }
});

/**
 * A trained Rider can register interest in the 12-month asset lease program.
 * Eligibility is always re-checked by the API; clients cannot assert it.
 */
export const createAssetFinancingInterestSchema = z.object({
  assetType: z.enum(['MOTORBIKE', 'ELECTRIC_VEHICLE']),
  notes: z.string().trim().max(1000).optional(),
}).strict();

export const updateAssetFinancingInterestStatusSchema = z.object({
  status: z.enum(['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DECLINED', 'WITHDRAWN']),
  reviewNotes: z.string().trim().min(3).max(1000).optional(),
  expectedUpdatedAt: z.string().datetime(),
}).strict().superRefine((data, context) => {
  if (data.status === 'DECLINED' && !data.reviewNotes) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reviewNotes'],
      message: 'Review notes of at least 3 characters are required when declining an interest',
    });
  }
});

export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
export type SelectRiderChannelInput = z.infer<typeof selectRiderChannelSchema>;
export type CreateInHouseInvitationInput = z.infer<typeof createInHouseInvitationSchema>;
export type ListRiderOperationsCasesQuery = z.infer<typeof listRiderOperationsCasesQuerySchema>;
export type ListRiderAuditHistoryQuery = z.infer<typeof listRiderAuditHistoryQuerySchema>;
export type ReviewTrainingModuleInput = z.infer<typeof reviewTrainingModuleSchema>;
export type CreateAssetFinancingInterestInput = z.infer<typeof createAssetFinancingInterestSchema>;
export type UpdateAssetFinancingInterestStatusInput = z.infer<typeof updateAssetFinancingInterestStatusSchema>;
