import { z } from 'zod';
import { currencyAmountSchema } from './common';

const payoutCodePlaceholders = new Set([
  'bank code',
  'network',
  'none',
  'n/a',
  'na',
  'optional',
  'placeholder',
  'select',
  'select bank',
  'select network',
]);

export function normalizeGhanaMobileMoneyNumber(value: string): string {
  const digits = value.replace(/\D/g, '');

  if (digits.startsWith('233')) {
    const nationalNumber = digits.slice(3);
    if (/^\d{9}$/.test(nationalNumber)) return `0${nationalNumber}`;
    if (/^0\d{9}$/.test(nationalNumber)) return nationalNumber;
  }

  if (/^\d{9}$/.test(digits)) return `0${digits}`;
  return digits;
}

export const requestWithdrawalSchema = z
  .object({
    // Modern clients preserve one UUID per user-confirmed attempt while
    // retrying. Omission remains accepted for already-released legacy APKs.
    requestId: z.string().uuid('A valid withdrawal request ID is required').optional(),
    amount: currencyAmountSchema,
    method: z.enum(['BANK_TRANSFER', 'MOBILE_MONEY']),
    destination: z.string().trim().min(1, 'Destination account is required').max(50),
    destinationName: z.string().trim().min(2, 'Account name is required').max(100),
    bankCode: z
      .string({ required_error: 'Payout provider is required' })
      .trim()
      .min(2, 'Payout provider is required')
      .max(20)
      .regex(/^[A-Za-z0-9_-]+$/, 'Select a valid payout provider'),
  })
  .superRefine((value, ctx) => {
    if (payoutCodePlaceholders.has(value.bankCode.toLowerCase())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bankCode'],
        message: 'Select a valid payout provider',
      });
    }

    if (value.method === 'MOBILE_MONEY') {
      const mobileNumber = normalizeGhanaMobileMoneyNumber(value.destination);
      if (!/^0\d{9}$/.test(mobileNumber)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['destination'],
          message: 'Enter a valid 10-digit Ghana Mobile Money number',
        });
      }
      return;
    }

    const accountNumber = value.destination.replace(/[\s-]/g, '');
    if (!/^\d{6,20}$/.test(accountNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['destination'],
        message: 'Enter a valid bank account number',
      });
    }
  })
  .transform((value) => ({
    ...value,
    destination:
      value.method === 'MOBILE_MONEY'
        ? normalizeGhanaMobileMoneyNumber(value.destination)
        : value.destination.replace(/[\s-]/g, ''),
    destinationName: value.destinationName.trim(),
    bankCode: value.bankCode.trim(),
  }));

export type RequestWithdrawalInput = z.infer<typeof requestWithdrawalSchema>;
