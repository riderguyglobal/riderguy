import { z } from 'zod';

export const uploadDocumentSchema = z.object({
  type: z.enum([
    'NATIONAL_ID',
    'DRIVERS_LICENSE',
    'VEHICLE_REGISTRATION',
    'INSURANCE_CERTIFICATE',
    'PROOF_OF_ADDRESS',
    'SELFIE',
    'VEHICLE_PHOTO_FRONT',
    'VEHICLE_PHOTO_BACK',
    'VEHICLE_PHOTO_LEFT',
    'VEHICLE_PHOTO_RIGHT',
  ]),
  fileName: z.string().min(1).max(255).optional(),
  mimeType: z.enum([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ]).optional(),
  fileSizeBytes: z.coerce
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024, 'File size must be under 10MB')
    .optional(),
});

export const reviewDocumentSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().trim().min(5).max(500).optional(),
}).strict().superRefine((data, context) => {
  if (data.status === 'REJECTED' && !data.rejectionReason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rejectionReason'],
      message: 'A meaningful rejection reason is required',
    });
  }
  if (data.status === 'APPROVED' && data.rejectionReason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rejectionReason'],
      message: 'A rejection reason is only allowed when rejecting a document',
    });
  }
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type ReviewDocumentInput = z.infer<typeof reviewDocumentSchema>;
