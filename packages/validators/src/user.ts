import { z } from 'zod';
import { emailSchema, requiredStringSchema } from './common';

export const updateProfileSchema = z.object({
  firstName: requiredStringSchema.max(50).optional(),
  lastName: requiredStringSchema.max(50).optional(),
  email: emailSchema.optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
