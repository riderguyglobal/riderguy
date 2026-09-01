import { z } from 'zod';

export const assetFinancingInterestStatuses = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'DECLINED',
  'WITHDRAWN',
] as const;

export const assetFinancingAssetTypes = [
  'MOTORBIKE',
  'ELECTRIC_VEHICLE',
] as const;

/** Strict, bounded filters for the admin asset-financing work queue. */
export const listAssetFinancingInterestsQuerySchema = z.object({
  status: z.enum(assetFinancingInterestStatuses).optional(),
  assetType: z.enum(assetFinancingAssetTypes).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export type ListAssetFinancingInterestsQuery = z.infer<
  typeof listAssetFinancingInterestsQuerySchema
>;
