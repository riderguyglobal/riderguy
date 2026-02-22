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
  fileName: z.string().min(1).max(255),
  mimeType: z.enum([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ]),
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024, 'File size must be under 10MB'),
});

export const reviewDocumentSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().max(500).optional(),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type ReviewDocumentInput = z.infer<typeof reviewDocumentSchema>;
